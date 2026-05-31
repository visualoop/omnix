/**
 * Drug substitutions + prescription refills.
 *
 * Substitution: when a branded drug is unavailable or expensive, suggest
 * therapeutically equivalent generics from the pharmacy_products inventory.
 *
 * Refills: track repeat-prescriptions. Doctor authorizes N refills, each
 * dispense decrements the counter. One-click "refill from prescription"
 * creates a new prescription linked to the original.
 */
import { query, execute } from "@/lib/db";

// ─── Substitutions ─────────────────────────────────────────────────────
export interface Substitution {
  id: string;
  product_id: string;
  substitute_product_id: string;
  strength_match: number;
  therapeutic_match: number;
  notes: string | null;
  created_at: string;
}

export interface SubstitutionWithProduct extends Substitution {
  substitute_name: string;
  substitute_sku: string;
  substitute_price: number;
  substitute_stock: number;
  substitute_generic: string | null;
}

/** Get suggested substitutions for a product. */
export async function getSubstitutions(productId: string): Promise<SubstitutionWithProduct[]> {
  return query<SubstitutionWithProduct>(
    `SELECT
       s.*,
       p.name AS substitute_name,
       p.sku AS substitute_sku,
       COALESCE(pp.selling_price, 0) AS substitute_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS substitute_stock,
       ph.generic_name AS substitute_generic
     FROM drug_substitutions s
     JOIN products p ON p.id = s.substitute_product_id
     LEFT JOIN pharmacy_products ph ON ph.product_id = p.id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE s.product_id = ?1
       AND p.active = 1
     ORDER BY s.therapeutic_match DESC, s.strength_match DESC, substitute_price`,
    [productId],
  );
}

/** Auto-discover substitutions: drugs with same generic_name. */
export async function suggestSubstitutionsFromGeneric(productId: string): Promise<Array<{
  id: string; name: string; sku: string; selling_price: number; stock: number; generic_name: string;
}>> {
  return query<any>(
    `WITH origin AS (
       SELECT generic_name FROM pharmacy_products WHERE product_id = ?1
     )
     SELECT
       p.id, p.name, p.sku,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock,
       ph.generic_name
     FROM products p
     JOIN pharmacy_products ph ON ph.product_id = p.id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE p.active = 1
       AND p.id != ?1
       AND ph.generic_name IS NOT NULL
       AND ph.generic_name = (SELECT generic_name FROM origin)
     ORDER BY selling_price
     LIMIT 8`,
    [productId],
  );
}

export async function addSubstitution(
  productId: string,
  substituteProductId: string,
  strengthMatch = 1,
  therapeuticMatch = 1,
  notes?: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT OR IGNORE INTO drug_substitutions (id, product_id, substitute_product_id, strength_match, therapeutic_match, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, productId, substituteProductId, strengthMatch, therapeuticMatch, notes || null],
  );
  return id;
}

export async function removeSubstitution(productId: string, substituteProductId: string): Promise<void> {
  await execute(
    `DELETE FROM drug_substitutions WHERE product_id = ?1 AND substitute_product_id = ?2`,
    [productId, substituteProductId],
  );
}

// ─── Refills ────────────────────────────────────────────────────────────
export interface RefillablePrescription {
  id: string;
  rx_number: number;
  patient_name: string;
  patient_phone: string | null;
  doctor_name: string | null;
  refills_authorized: number;
  refills_used: number;
  refills_remaining: number;
  last_dispensed: string;
  item_count: number;
}

/** List prescriptions that have refills remaining. */
export async function getRefillablePrescriptions(searchTerm?: string): Promise<RefillablePrescription[]> {
  const params: any[] = [];
  let where = "p.refills_authorized > p.refills_used AND p.parent_prescription_id IS NULL";
  if (searchTerm?.trim()) {
    where += ` AND (p.patient_name LIKE ?1 OR p.patient_phone LIKE ?1 OR CAST(p.rx_number AS TEXT) LIKE ?1)`;
    params.push(`%${searchTerm.trim()}%`);
  }
  return query<RefillablePrescription>(
    `SELECT
       p.id, p.rx_number, p.patient_name, p.patient_phone, p.doctor_name,
       p.refills_authorized, p.refills_used,
       (p.refills_authorized - p.refills_used) AS refills_remaining,
       p.created_at AS last_dispensed,
       (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = p.id) AS item_count
     FROM prescriptions p
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT 50`,
    params,
  );
}

/** Create a refill: copy original prescription to a new one and increment counter. */
export async function refillPrescription(
  originalPrescriptionId: string,
  userId: string,
): Promise<string> {
  const [original] = await query<{
    rx_number: number; patient_name: string; patient_phone: string | null;
    patient_age: number | null; doctor_name: string | null; doctor_license: string | null;
    doctor_id: string | null; hospital: string | null; diagnosis: string | null;
    notes: string | null; refills_authorized: number; refills_used: number;
  }>(`SELECT * FROM prescriptions WHERE id = ?1`, [originalPrescriptionId]);

  if (!original) throw new Error("Original prescription not found");
  if (original.refills_used >= original.refills_authorized) {
    throw new Error("No refills remaining on this prescription");
  }

  // Get next rx_number
  const [maxRx] = await query<{ next: number }>(
    `SELECT COALESCE(MAX(rx_number), 0) + 1 AS next FROM prescriptions`,
  );

  const newId = crypto.randomUUID();
  await execute(
    `INSERT INTO prescriptions (
       id, rx_number, patient_name, patient_phone, patient_age,
       doctor_name, doctor_license, doctor_id, hospital, diagnosis, notes,
       dispensed_by, status, parent_prescription_id,
       refills_authorized, refills_used
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending', ?13, 0, 0)`,
    [
      newId, maxRx.next, original.patient_name, original.patient_phone, original.patient_age,
      original.doctor_name, original.doctor_license, original.doctor_id, original.hospital,
      original.diagnosis, original.notes, userId, originalPrescriptionId,
    ],
  );

  // Copy items
  const items = await query<{
    product_id: string; product_name: string; dosage: string | null;
    frequency: string | null; duration: string | null;
    quantity_prescribed: number; substitution_allowed: number; instructions: string | null;
  }>(`SELECT * FROM prescription_items WHERE prescription_id = ?1`, [originalPrescriptionId]);

  for (const item of items) {
    const itemId = crypto.randomUUID();
    await execute(
      `INSERT INTO prescription_items (
         id, prescription_id, product_id, product_name, dosage,
         frequency, duration, quantity_prescribed, quantity_dispensed,
         substitution_allowed, instructions
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)`,
      [
        itemId, newId, item.product_id, item.product_name, item.dosage,
        item.frequency, item.duration, item.quantity_prescribed,
        item.substitution_allowed, item.instructions,
      ],
    );
  }

  // Increment refills_used on original
  await execute(
    `UPDATE prescriptions SET refills_used = refills_used + 1 WHERE id = ?1`,
    [originalPrescriptionId],
  );

  return newId;
}
