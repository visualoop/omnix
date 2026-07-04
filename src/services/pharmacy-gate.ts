/**
 * POS-side pharmacy gate.
 *
 * Enforces `pharmacy_products.requires_prescription = 1`: any prescription-
 * only (POM / scheduled) drug can only be added to a cart that is already
 * sourced from a prescription. A raw walk-in POS session that tries to
 * scan a POM SKU gets a toast + refused add.
 *
 * Returns { ok: true } for retail SKUs, non-pharmacy carts (hardware,
 * hospitality, etc.), and for any product without a `pharmacy_products`
 * row (no metadata = no gate).
 */
import { getPharmacyFlags } from "@/services/pharmacy";

export interface PharmacyGateInput {
  productId: string;
  productName: string;
  sourceType: string | null;
  activeModule: string | null;
}

export interface PharmacyGateResult {
  ok: boolean;
  reason?: string;
  isControlled?: boolean;
  requiresPrescription?: boolean;
}

export async function checkPharmacyAdd(input: PharmacyGateInput): Promise<PharmacyGateResult> {
  // Gate only fires inside the pharmacy (Dawa) module. Retail cashiers
  // selling OTC vitamins should never hit this. If Dawa is inactive, the
  // caller shouldn't even be selling scheduled drugs — but leave it open.
  if (input.activeModule !== "dawa") return { ok: true };

  const flags = await getPharmacyFlags([input.productId]);
  const f = flags.get(input.productId);
  if (!f) return { ok: true }; // no metadata = plain retail SKU

  const isPrescriptionSourced = input.sourceType === "prescription";
  if (f.requires_prescription && !isPrescriptionSourced) {
    return {
      ok: false,
      reason: `${input.productName} requires a prescription. Attach a script via /pharmacy → Dispense before selling.`,
      requiresPrescription: true,
    };
  }

  // Controlled substances demand prescription linkage AND a pharmacist on
  // duty. The controlled_log auto-post from completeSale reconstructs a
  // Walk-in row if none is set, but PPB inspectors want the prescription
  // number. Block if not linked.
  if (f.is_controlled && !isPrescriptionSourced) {
    return {
      ok: false,
      reason: `${input.productName} is a controlled substance. Prescription linkage is mandatory for the register.`,
      isControlled: true,
      requiresPrescription: true,
    };
  }

  return { ok: true, isControlled: !!f.is_controlled, requiresPrescription: !!f.requires_prescription };
}
