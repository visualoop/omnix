/**
 * Clinical helpers — chronic conditions, drug-allergy detection, pharmacist on duty.
 *
 * Patient allergies are managed by `services/erp.ts` (existing). This module adds:
 * - patient conditions (chronic illnesses)
 * - drug-allergy detection at point-of-dispense
 * - pharmacist roster
 */
import { query, execute } from "@/lib/db";
import type { PatientAllergy } from "@/services/erp";
export type { PatientAllergy };
export { addAllergy, removeAllergy } from "@/services/erp";

export interface PatientCondition {
  id: string;
  customer_id: string;
  condition: string;
  icd10_code: string | null;
  diagnosed_date: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
}

// ─── Conditions ────────────────────────────────────────────────────────
export async function listConditions(customerId: string, activeOnly = false): Promise<PatientCondition[]> {
  const where = activeOnly ? "AND is_active = 1" : "";
  return query<PatientCondition>(
    `SELECT * FROM patient_conditions WHERE customer_id = ?1 ${where} ORDER BY diagnosed_date DESC`,
    [customerId],
  );
}

export async function addCondition(input: {
  customer_id: string;
  condition: string;
  icd10_code?: string;
  diagnosed_date?: string;
  notes?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO patient_conditions (id, customer_id, condition, icd10_code, diagnosed_date, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, input.customer_id, input.condition, input.icd10_code || null,
      input.diagnosed_date || null, input.notes || null],
  );
  return id;
}

export async function setConditionActive(id: string, active: boolean): Promise<void> {
  await execute(`UPDATE patient_conditions SET is_active = ?2 WHERE id = ?1`, [id, active ? 1 : 0]);
}

export async function removeCondition(id: string): Promise<void> {
  await execute(`DELETE FROM patient_conditions WHERE id = ?1`, [id]);
}

// ─── Drug-allergy detection ────────────────────────────────────────────
export interface AllergyAlert {
  product_id: string;
  product_name: string;
  patient_allergen: string;
  matched_allergy_class: string;
  severity: string;
  reason: string;
}

/**
 * Given a patient and a list of products to dispense, return any allergy alerts.
 * Logic: for each product, check if its name (lowercased) matches a drug_allergy_class entry,
 * and if the patient has an allergy in that class.
 */
export async function checkDrugAllergies(
  customerId: string,
  productIds: string[],
): Promise<AllergyAlert[]> {
  if (productIds.length === 0) return [];

  // Get patient allergies (uses existing schema with `reaction` column)
  const allergies = await query<PatientAllergy>(
    `SELECT * FROM patient_allergies WHERE customer_id = ?1`,
    [customerId],
  );
  if (allergies.length === 0) return [];

  // Get product names
  const productList = await query<{ id: string; name: string }>(
    `SELECT id, name FROM products WHERE id IN (${productIds.map((_, i) => `?${i + 1}`).join(",")})`,
    productIds,
  );

  // Get drug-class mappings
  const classes = await query<{ drug_pattern: string; allergy_class: string; severity: string }>(
    `SELECT drug_pattern, allergy_class, severity FROM drug_allergy_class`,
  );

  const alerts: AllergyAlert[] = [];

  for (const product of productList) {
    const productLower = product.name.toLowerCase();
    for (const cls of classes) {
      if (!productLower.includes(cls.drug_pattern.toLowerCase())) continue;

      // Find matching patient allergy (substring either direction)
      const matchingAllergy = allergies.find((a) =>
        a.allergen.toLowerCase().includes(cls.allergy_class.toLowerCase()) ||
        cls.allergy_class.toLowerCase().includes(a.allergen.toLowerCase()),
      );
      if (!matchingAllergy) continue;

      alerts.push({
        product_id: product.id,
        product_name: product.name,
        patient_allergen: matchingAllergy.allergen,
        matched_allergy_class: cls.allergy_class,
        severity: matchingAllergy.severity,
        reason: `Patient is allergic to ${matchingAllergy.allergen}; ${product.name} is a ${cls.allergy_class}-class drug.`,
      });
    }
  }

  return alerts;
}

// ─── Pharmacists on duty ───────────────────────────────────────────────
export interface Pharmacist {
  id: string;
  full_name: string;
  pharmacist_license_number: string | null;
  pharmacist_license_expiry: string | null;
}

export async function listPharmacists(): Promise<Pharmacist[]> {
  return query<Pharmacist>(
    `SELECT id, full_name, pharmacist_license_number, pharmacist_license_expiry
     FROM employees
     WHERE active = 1 AND is_pharmacist = 1
     ORDER BY full_name`,
  );
}
