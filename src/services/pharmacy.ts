import { query, execute } from "@/lib/db";
import type { CartItem } from "@/services/sales";

export interface Prescription {
  id: string;
  rx_number: number;
  customer_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_age: number | null;
  doctor_name: string | null;
  doctor_license: string | null;
  doctor_id: string | null;
  hospital: string | null;
  diagnosis: string | null;
  notes: string | null;
  status: string;
  refills_authorized: number;
  refills_used: number;
  parent_prescription_id: string | null;
  sale_id: string | null;
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

/**
 * Format a numeric rx_number as the canonical "RX-XXXXX" display string
 * used across labels, PDF exports, and the UI. Zero-pads to 5 digits.
 *
 * Kept as a helper (not a stored column) so we don't need a table
 * migration; the numeric rx_number continues to be the source of truth
 * and this function derives the display form everywhere.
 */
export function formatRxNumber(rxNumber: number): string {
  return `RX-${String(rxNumber).padStart(5, "0")}`;
}

export interface CreatePrescriptionInput {
  /** Optional FK to customers.id — set when the patient was picked from
   *  the Patients tab (or auto-created via the dispense Combobox). Old
   *  prescriptions created via free-text patient_name keep customer_id = null. */
  customer_id?: string;
  patient_name: string;
  patient_phone?: string;
  patient_age?: number;
  /** Doctor DB link. When the prescription-panel picks a prescriber from
   *  the doctors combobox, the id lands here so `doctors.prescription_count`
   *  in the Doctors list actually reflects reality. */
  doctor_id?: string;
  doctor_name?: string;
  doctor_license?: string;
  hospital?: string;
  diagnosis?: string;
  notes?: string;
  /** How many refills the prescriber authorised. 0 (default) = one-off.
   *  Values > 0 make the prescription eligible for the Refills page flow. */
  refills_authorized?: number;
  items: Omit<PrescriptionItem, "id" | "prescription_id" | "quantity_dispensed">[];
}

export async function createPrescription(input: CreatePrescriptionInput, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const rxNumber = await getNextRxNumber();

  await execute(
    `INSERT INTO prescriptions (
       id, rx_number, customer_id, patient_name, patient_phone, patient_age,
       doctor_id, doctor_name, doctor_license, hospital, diagnosis, notes,
       dispensed_by, refills_authorized
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    [
      id, rxNumber, input.customer_id || null, input.patient_name,
      input.patient_phone || null, input.patient_age || null,
      input.doctor_id || null, input.doctor_name || null,
      input.doctor_license || null, input.hospital || null,
      input.diagnosis || null, input.notes || null,
      userId, Math.max(0, input.refills_authorized ?? 0),
    ]
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

export async function preparePrescriptionForPosCheckout(
  prescriptionId: string
): Promise<{
  items: CartItem[];
  prescriptionNumber: number;
  patientName: string;
  customerId: string | null;
  expiringSoon: Array<{
    product_id: string;
    product_name: string;
    days_to_expiry: number;
    batch_number: string | null;
  }>;
  interactions: import("./interactions").InteractionWarning[];
  allergyAlerts: import("./clinical").AllergyAlert[];
  coldChainExcursions: Array<{
    unit_name: string;
    reading_at: string;
    temperature_c: number;
    affected_products: string[];
  }>;
} | null> {
  const rxs = await query<Prescription>("SELECT * FROM prescriptions WHERE id = ?1", [prescriptionId]);
  if (rxs.length === 0) return null;
  const rx = rxs[0];
  if (rx.status === "dispensed") return null;

  const items = await query<PrescriptionItem>(
    "SELECT * FROM prescription_items WHERE prescription_id = ?1",
    [prescriptionId]
  );
  if (items.length === 0) return null;

  const cartItems: CartItem[] = items.map((it) => ({
    id: crypto.randomUUID(),
    product_id: it.product_id,
    name: it.product_name,
    quantity: it.quantity_prescribed,
    unit_price: 0,
    discount: 0,
    tax_rate: 0,
    total: 0,
  }));

  const productIds = [...new Set(items.map((it) => it.product_id))];
  const placeholders = productIds.map(() => "?").join(",");
  // Prices moved from `products` to `product_prices` (default list).
  // Join + COALESCE handles products that don't yet have a price row.
  const prices = await query<{ id: string; selling_price: number; tax_rate: number }>(
    `SELECT p.id,
            COALESCE(pp.selling_price, 0) AS selling_price,
            COALESCE(p.tax_rate, 0)      AS tax_rate
       FROM products p
       LEFT JOIN product_prices pp
         ON pp.product_id = p.id AND pp.price_list_id = 'default'
      WHERE p.id IN (${placeholders})`,
    productIds
  );
  const priceMap = new Map(prices.map((p) => [p.id, p]));

  for (const item of cartItems) {
    const p = priceMap.get(item.product_id);
    if (p) {
      item.unit_price = p.selling_price;
      item.tax_rate = p.tax_rate;
    }
    item.total = item.unit_price * item.quantity - item.discount;
  }

  // Amber warning: for any product whose oldest available batch is < 30
  // days from expiry, surface it so the pharmacist consciously dispenses
  // the older stock (FEFO) and doesn't accidentally hand out a batch
  // that's about to expire in the customer's hands.
  const expiringSoon = await query<{
    product_id: string;
    product_name: string;
    days_to_expiry: number;
    batch_number: string | null;
  }>(
    `SELECT p.id AS product_id,
            p.name AS product_name,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry,
            b.batch_number
       FROM batches b
       JOIN products p ON p.id = b.product_id
      WHERE b.product_id IN (${placeholders})
        AND b.quantity > 0
        AND b.expiry_date IS NOT NULL
        AND julianday(b.expiry_date) - julianday('now') <= 30
      ORDER BY b.expiry_date ASC`,
    productIds,
  );

  // Interaction + allergy checks. Non-blocking here — POS surfaces them
  // via InteractionAlerts + AllergyAlertBanner. The dispensing flow may
  // choose to hard-block a contraindicated pair upstream.
  const { checkInteractions } = await import("./interactions");
  const interactions = await checkInteractions(productIds);
  let allergyAlerts: import("./clinical").AllergyAlert[] = [];
  if (rx.customer_id) {
    const { checkDrugAllergies } = await import("./clinical");
    allergyAlerts = await checkDrugAllergies(rx.customer_id, productIds);
  }

  // Cold-chain excursion check — for any cold_chain = 1 product on the
  // prescription, look at the last 24h of readings on all active cold-
  // chain units and surface any out-of-range readings. If a fridge
  // spiked overnight, dispensing insulin / vaccines from it is unsafe.
  const coldChainRows = await query<{ product_id: string; product_name: string }>(
    `SELECT p.id AS product_id, p.name AS product_name
       FROM pharmacy_products pp
       JOIN products p ON p.id = pp.product_id
      WHERE pp.product_id IN (${placeholders})
        AND pp.cold_chain = 1`,
    productIds,
  );

  const coldChainExcursions: Array<{
    unit_name: string;
    reading_at: string;
    temperature_c: number;
    affected_products: string[];
  }> = [];
  if (coldChainRows.length > 0) {
    const excursions = await query<{ unit_name: string; reading_at: string; temperature_c: number }>(
      `SELECT u.name AS unit_name, l.reading_at, l.temperature_c
         FROM cold_chain_logs l
         JOIN cold_chain_units u ON u.id = l.unit_id
        WHERE l.in_range = 0
          AND julianday('now') - julianday(l.reading_at) <= 1
          AND u.active = 1
        ORDER BY l.reading_at DESC`,
    );
    const affected = coldChainRows.map((r) => r.product_name);
    for (const ex of excursions) {
      coldChainExcursions.push({ ...ex, affected_products: affected });
    }
  }

  return {
    items: cartItems,
    prescriptionNumber: rx.rx_number,
    patientName: rx.patient_name,
    customerId: rx.customer_id,
    expiringSoon,
    interactions,
    allergyAlerts,
    coldChainExcursions,
  };
}

/**
 * Formats a product's display label combining generic name, brand, and
 * strength when the row has pharmacy_products metadata. Falls back to
 * the plain product name for non-pharmacy SKUs.
 *
 * Examples:
 *   "Panadol 500mg tab"           — brand + strength + form
 *   "Paracetamol (Panadol) 500mg" — generic + brand + strength
 *   "Chair" (retail)              — plain name
 */
export function formatPharmacyDisplay(fallbackName: string, meta?: {
  generic_name?: string | null;
  brand_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
}): string {
  if (!meta) return fallbackName;
  const parts: string[] = [];
  if (meta.generic_name && meta.brand_name) {
    parts.push(`${meta.generic_name} (${meta.brand_name})`);
  } else if (meta.brand_name) {
    parts.push(meta.brand_name);
  } else if (meta.generic_name) {
    parts.push(meta.generic_name);
  } else {
    parts.push(fallbackName);
  }
  if (meta.strength) parts.push(meta.strength);
  if (meta.dosage_form) parts.push(meta.dosage_form);
  return parts.join(" ");
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
     ORDER BY b.expiry_date ASC
     LIMIT 500`,
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

/**
 * Returns pharmacy-metadata flags for the given product IDs. Callers use
 * this to gate POS actions on `requires_prescription` and to auto-post
 * controlled-substance ledger rows on `is_controlled`.
 *
 * Undocumented products (no pharmacy_products row) get { requires_prescription: 0,
 * is_controlled: 0, cold_chain: 0 } so retail SKUs sold at pharmacies
 * don't accidentally trigger any pharmacy gate.
 */
export async function getPharmacyFlags(productIds: string[]): Promise<Map<string, {
  requires_prescription: number;
  is_controlled: number;
  cold_chain: number;
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
}>> {
  if (productIds.length === 0) return new Map();
  const placeholders = productIds.map((_, i) => `?${i + 1}`).join(",");
  const rows = await query<{
    product_id: string;
    requires_prescription: number;
    is_controlled: number;
    cold_chain: number;
    generic_name: string | null;
    brand_name: string | null;
    strength: string | null;
  }>(
    `SELECT product_id, requires_prescription, is_controlled, cold_chain,
            generic_name, brand_name, strength
       FROM pharmacy_products
      WHERE product_id IN (${placeholders})`,
    productIds,
  );
  return new Map(rows.map((r) => [r.product_id, {
    requires_prescription: r.requires_prescription,
    is_controlled: r.is_controlled,
    cold_chain: r.cold_chain,
    generic_name: r.generic_name,
    brand_name: r.brand_name,
    strength: r.strength,
  }]));
}

/**
 * Auto-populates the controlled_log ledger for any sale line whose product
 * is flagged is_controlled = 1. Called from completeSale as a post-commit
 * side effect — a failure here logs but never rolls back a paid sale
 * (the pharmacist can manually reconcile the register in that case).
 *
 * Populates statutory PPB fields where possible:
 *   • patient_name + patient_id_number from the linked prescription
 *   • prescribed_by + prescription_number from the prescription
 *   • pharmacist_id from the dispensing user (falls back to user_id)
 *   • balance_after computed from summed batches for the product
 */
export async function autoPostControlledLog(
  _saleId: string,
  saleNumber: number,
  items: Array<{ product_id: string; product_name: string; quantity: number }>,
  userId: string,
  prescriptionId: string | null,
): Promise<void> {
  const productIds = [...new Set(items.map((i) => i.product_id))];
  if (productIds.length === 0) return;
  const flags = await getPharmacyFlags(productIds);
  const controlledLines = items.filter((it) => flags.get(it.product_id)?.is_controlled === 1);
  if (controlledLines.length === 0) return;

  // Fetch prescription context if the sale sourced from one.
  let ctx: {
    patient_name: string;
    patient_id_number: string | null;
    prescribed_by: string | null;
    prescription_number: string | null;
  } | null = null;
  if (prescriptionId) {
    const rows = await query<{
      patient_name: string;
      customer_id: string | null;
      doctor_name: string | null;
      rx_number: number;
    }>(
      `SELECT patient_name, customer_id, doctor_name, rx_number
         FROM prescriptions WHERE id = ?1`,
      [prescriptionId],
    );
    if (rows[0]) {
      let idNumber: string | null = null;
      if (rows[0].customer_id) {
        const custRows = await query<{ national_id: string | null }>(
          `SELECT national_id FROM customers WHERE id = ?1`,
          [rows[0].customer_id],
        ).catch(() => []);
        idNumber = custRows[0]?.national_id ?? null;
      }
      ctx = {
        patient_name: rows[0].patient_name,
        patient_id_number: idNumber,
        prescribed_by: rows[0].doctor_name,
        prescription_number: `RX-${rows[0].rx_number}`,
      };
    }
  }

  for (const line of controlledLines) {
    // Recompute balance_after from the sum of batches — this is what
    // PPB inspectors will reconcile against the physical count.
    const [bal] = await query<{ balance: number }>(
      `SELECT COALESCE(SUM(quantity), 0) AS balance FROM batches WHERE product_id = ?1`,
      [line.product_id],
    );
    await execute(
      `INSERT INTO controlled_log (
         id, product_id, product_name, action, quantity,
         patient_name, patient_id_number, prescribed_by, prescription_number,
         prescription_id, balance_after, user_id, notes
       ) VALUES (?1, ?2, ?3, 'dispensed', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      [
        crypto.randomUUID(),
        line.product_id,
        line.product_name,
        line.quantity,
        ctx?.patient_name ?? "Walk-in",
        ctx?.patient_id_number ?? null,
        ctx?.prescribed_by ?? null,
        ctx?.prescription_number ?? null,
        prescriptionId,
        bal?.balance ?? 0,
        userId,
        `Auto from sale #${saleNumber}`,
      ],
    );
  }
}
