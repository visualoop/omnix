import { query, execute } from "@/lib/db";

export interface Prescription {
  id: string;
  rx_number: number;
  patient_name: string;
  patient_phone: string | null;
  patient_age: number | null;
  doctor_name: string | null;
  doctor_license: string | null;
  hospital: string | null;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface PrescriptionItem {
  id?: string;
  prescription_id?: string;
  product_id: string;
  product_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
  substitution_allowed: number;
  instructions: string | null;
}

export interface PharmacyProduct {
  product_id: string;
  generic_name: string | null;
  brand_name: string | null;
  dosage_form: string | null;
  strength: string | null;
  manufacturer: string | null;
  requires_prescription: number;
  is_controlled: number;
  schedule_class: string | null;
  storage_conditions: string | null;
  cold_chain: number;
}

export async function getPrescriptions(search?: string): Promise<Prescription[]> {
  const sql = `
    SELECT * FROM prescriptions
    ${search ? "WHERE patient_name LIKE ?1 OR patient_phone LIKE ?1" : ""}
    ORDER BY created_at DESC LIMIT 100
  `;
  return query<Prescription>(sql, search ? [`%${search}%`] : []);
}

export async function getPrescription(id: string): Promise<{ prescription: Prescription; items: PrescriptionItem[] } | null> {
  const rxs = await query<Prescription>("SELECT * FROM prescriptions WHERE id = ?1", [id]);
  if (rxs.length === 0) return null;
  const items = await query<PrescriptionItem>(
    "SELECT * FROM prescription_items WHERE prescription_id = ?1",
    [id]
  );
  return { prescription: rxs[0], items };
}

export async function getNextRxNumber(): Promise<number> {
  await execute("UPDATE sequences SET value = value + 1 WHERE name = 'rx_number'");
  const rows = await query<{ value: number }>("SELECT value FROM sequences WHERE name = 'rx_number'");
  return rows[0].value;
}

export interface CreatePrescriptionInput {
  patient_name: string;
  patient_phone?: string;
  patient_age?: number;
  doctor_name?: string;
  doctor_license?: string;
  hospital?: string;
  diagnosis?: string;
  notes?: string;
  items: Omit<PrescriptionItem, "id" | "prescription_id" | "quantity_dispensed">[];
}

export async function createPrescription(input: CreatePrescriptionInput, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const rxNumber = await getNextRxNumber();

  await execute(
    `INSERT INTO prescriptions (id, rx_number, patient_name, patient_phone, patient_age, doctor_name, doctor_license, hospital, diagnosis, notes, dispensed_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [id, rxNumber, input.patient_name, input.patient_phone || null, input.patient_age || null,
     input.doctor_name || null, input.doctor_license || null, input.hospital || null,
     input.diagnosis || null, input.notes || null, userId]
  );

  for (const item of input.items) {
    await execute(
      `INSERT INTO prescription_items (id, prescription_id, product_id, product_name, dosage, frequency, duration, quantity_prescribed, substitution_allowed, instructions)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      [crypto.randomUUID(), id, item.product_id, item.product_name, item.dosage, item.frequency, item.duration, item.quantity_prescribed, item.substitution_allowed, item.instructions || null]
    );
  }

  return id;
}

export async function dispensePrescription(prescriptionId: string, saleId: string): Promise<void> {
  await execute(
    `UPDATE prescriptions SET status = 'dispensed', sale_id = ?1 WHERE id = ?2`,
    [saleId, prescriptionId]
  );
  // Mark all items as dispensed (assumes full dispense)
  await execute(
    `UPDATE prescription_items SET quantity_dispensed = quantity_prescribed WHERE prescription_id = ?1`,
    [prescriptionId]
  );
}

// Pharmacy product extensions
export async function getPharmacyProduct(productId: string): Promise<PharmacyProduct | null> {
  const rows = await query<PharmacyProduct>(
    "SELECT * FROM pharmacy_products WHERE product_id = ?1",
    [productId]
  );
  return rows[0] || null;
}

export async function upsertPharmacyProduct(product: PharmacyProduct): Promise<void> {
  await execute(
    `INSERT INTO pharmacy_products (product_id, generic_name, brand_name, dosage_form, strength, manufacturer, requires_prescription, is_controlled, schedule_class, storage_conditions, cold_chain)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT(product_id) DO UPDATE SET
       generic_name = excluded.generic_name,
       brand_name = excluded.brand_name,
       dosage_form = excluded.dosage_form,
       strength = excluded.strength,
       manufacturer = excluded.manufacturer,
       requires_prescription = excluded.requires_prescription,
       is_controlled = excluded.is_controlled,
       schedule_class = excluded.schedule_class,
       storage_conditions = excluded.storage_conditions,
       cold_chain = excluded.cold_chain`,
    [product.product_id, product.generic_name, product.brand_name, product.dosage_form,
     product.strength, product.manufacturer, product.requires_prescription, product.is_controlled,
     product.schedule_class, product.storage_conditions, product.cold_chain]
  );
}

// Expiry alerts
export interface ExpiryItem {
  product_id: string;
  product_name: string;
  batch_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
}

export async function getExpiringItems(daysWindow: number = 90): Promise<ExpiryItem[]> {
  return query<ExpiryItem>(
    `SELECT 
       p.id as product_id, 
       p.name as product_name,
       b.id as batch_id,
       COALESCE(b.batch_number, '—') as batch_number,
       b.quantity,
       b.expiry_date,
       CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_to_expiry
     FROM batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.expiry_date IS NOT NULL 
       AND b.quantity > 0
       AND julianday(b.expiry_date) - julianday('now') <= ?1
     ORDER BY b.expiry_date ASC`,
    [daysWindow]
  );
}

// Controlled substances log
export async function getControlledLog(productId?: string): Promise<Array<{
  id: string; product_name: string; action: string; quantity: number;
  patient_name: string | null; balance_after: number; created_at: string;
}>> {
  return query(
    `SELECT id, product_name, action, quantity, patient_name, balance_after, created_at
     FROM controlled_log
     ${productId ? "WHERE product_id = ?1" : ""}
     ORDER BY created_at DESC LIMIT 100`,
    productId ? [productId] : []
  );
}
