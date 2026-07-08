/**
 * Medium-tier hospitality + delivery + rental services.
 * Batched together to keep the surface tight.
 */
import { execute, query, transaction } from "@/lib/db";

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

// ─── Bar inventory (Task 46) ───────────────────────────
export interface BarCount {
  id: string;
  count_date: string;
  bottle_product_id: string;
  product_name?: string;
  opening_ml: number;
  received_ml: number;
  sold_theoretical_ml: number;
  closing_ml: number;
  variance_ml: number;
  variance_pct: number | null;
}

export async function recordBarCount(input: {
  count_date: string;
  bottle_product_id: string;
  opening_ml: number;
  received_ml?: number;
  sold_theoretical_ml?: number;
  closing_ml: number;
  counted_by?: string;
  notes?: string;
}): Promise<string> {
  const id = newId();
  const variance = (input.opening_ml + (input.received_ml ?? 0)) - (input.sold_theoretical_ml ?? 0) - input.closing_ml;
  const opening = input.opening_ml + (input.received_ml ?? 0);
  const variancePct = opening > 0 ? (variance / opening) * 100 : null;
  await execute(
    `INSERT INTO bar_inventory_counts
      (id, count_date, bottle_product_id, opening_ml, received_ml, sold_theoretical_ml, closing_ml, variance_ml, variance_pct, counted_by, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [id, input.count_date, input.bottle_product_id, input.opening_ml, input.received_ml ?? 0, input.sold_theoretical_ml ?? 0, input.closing_ml, variance, variancePct, input.counted_by ?? null, input.notes ?? null],
  );
  return id;
}

export async function listBarCounts(days = 30): Promise<BarCount[]> {
  return query<BarCount>(
    `SELECT bc.id, bc.count_date, bc.bottle_product_id, p.name AS product_name,
            bc.opening_ml, bc.received_ml, bc.sold_theoretical_ml, bc.closing_ml,
            bc.variance_ml, bc.variance_pct
     FROM bar_inventory_counts bc
     JOIN products p ON p.id = bc.bottle_product_id
     WHERE bc.count_date >= date('now', ?1)
     ORDER BY bc.count_date DESC LIMIT 200`,
    [`-${days} days`],
  ).catch(() => []);
}

// ─── Deliveries (Task 51) ──────────────────────────────
export interface Delivery {
  id: string;
  delivery_number: string;
  sale_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  rider_id: string | null;
  rider_name?: string | null;
  status: "pending" | "assigned" | "picked_up" | "en_route" | "delivered" | "failed";
  scheduled_at: string | null;
  delivery_fee: number;
}

async function nextDeliveryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(delivery_number, 10) AS INTEGER)), 0) AS n
     FROM deliveries WHERE delivery_number LIKE ?1`,
    [`DEL-${year}-%`],
  );
  return `DEL-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

export async function createDelivery(input: {
  sale_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  rider_id?: string;
  scheduled_at?: string;
  delivery_fee?: number;
  notes?: string;
}): Promise<string> {
  const id = newId();
  const number = await nextDeliveryNumber();
  await execute(
    `INSERT INTO deliveries
      (id, delivery_number, sale_id, customer_id, customer_name, customer_phone,
       delivery_address, rider_id, status, scheduled_at, delivery_fee, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    [
      id, number, input.sale_id ?? null, input.customer_id ?? null,
      input.customer_name ?? null, input.customer_phone ?? null,
      input.delivery_address,
      input.rider_id ?? null,
      input.rider_id ? "assigned" : "pending",
      input.scheduled_at ?? null, input.delivery_fee ?? 0, input.notes ?? null,
    ],
  );
  return id;
}

export async function listDeliveries(status?: Delivery["status"]): Promise<Delivery[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 0;
  if (status) { clauses.push(`d.status = ?${++i}`); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<Delivery>(
    `SELECT d.id, d.delivery_number, d.sale_id, d.customer_name, d.customer_phone,
            d.delivery_address, d.rider_id, e.full_name AS rider_name,
            d.status, d.scheduled_at, d.delivery_fee
     FROM deliveries d
     LEFT JOIN employees e ON e.id = d.rider_id
     ${where}
     ORDER BY d.scheduled_at ASC NULLS LAST
     LIMIT 200`,
    params,
  ).catch(() => []);
}

export async function updateDeliveryStatus(id: string, status: Delivery["status"], proofPhotoUrl?: string): Promise<void> {
  const stampCol =
    status === "picked_up" ? "picked_up_at" :
    status === "delivered" ? "delivered_at" : null;
  if (stampCol) {
    await execute(
      `UPDATE deliveries SET status = ?2, ${stampCol} = datetime('now'), proof_photo_url = COALESCE(?3, proof_photo_url) WHERE id = ?1`,
      [id, status, proofPhotoUrl ?? null],
    );
  } else {
    await execute(`UPDATE deliveries SET status = ?2 WHERE id = ?1`, [id, status]);
  }
}

// ─── Compounded prescriptions (Task 50) ─────────────────
export async function createCompounded(input: {
  prescription_id: string;
  output_name: string;
  output_quantity: number;
  output_unit: string;
  components: Array<{ product_id: string; quantity: number }>;
  labour_cost?: number;
  compounded_by?: string;
  notes?: string;
}): Promise<string> {
  const id = newId();
  let totalCost = input.labour_cost ?? 0;

  await execute(
    `INSERT INTO compounded_prescriptions
      (id, prescription_id, output_name, output_quantity, output_unit,
       labour_cost, total_cost, compounded_by, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [id, input.prescription_id, input.output_name, input.output_quantity, input.output_unit,
      input.labour_cost ?? 0, totalCost, input.compounded_by ?? null, input.notes ?? null],
  );

  for (const c of input.components) {
    const [cost] = await query<{ price: number }>(
      `SELECT COALESCE(AVG(buying_price), 0) AS price FROM batches WHERE product_id = ?1 AND quantity > 0`,
      [c.product_id],
    );
    const unitCost = cost?.price ?? 0;
    const lineCost = unitCost * c.quantity;
    totalCost += lineCost;

    await execute(
      `INSERT INTO compounded_components (id, compounded_id, product_id, quantity_used, unit_cost, line_cost)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [newId(), id, c.product_id, c.quantity, unitCost, lineCost],
    );

    // Deduct from stock (FIFO).
    let remaining = c.quantity;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches
       WHERE product_id = ?1 AND quantity > 0
         AND (expiry_date IS NULL OR expiry_date > date('now'))
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
      [c.product_id],
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      await execute(`UPDATE batches SET quantity = quantity - ?2 WHERE id = ?1`, [b.id, take]);
      remaining -= take;
    }
  }

  // Update final total_cost.
  await execute(`UPDATE compounded_prescriptions SET total_cost = ?2 WHERE id = ?1`, [id, totalCost]);
  return id;
}

// ─── Contractor account auto-hold (Task 52) ────────────
export async function evaluateContractorHolds(): Promise<{ placed: number; released: number }> {
  const accounts = await query<{
    id: string;
    customer_id: string;
    days_overdue_hold: number;
    balance_due: number;
    oldest_overdue_days: number;
    on_hold: number;
  }>(
    `SELECT ca.id, ca.customer_id, ca.days_overdue_hold, ca.on_hold,
            COALESCE(ca.balance_due, 0) AS balance_due,
            COALESCE(ca.oldest_overdue_days, 0) AS oldest_overdue_days
     FROM customer_accounts ca`,
  ).catch(() => []);

  let placed = 0;
  let released = 0;
  for (const a of accounts) {
    if (a.oldest_overdue_days >= a.days_overdue_hold && !a.on_hold) {
      await execute(
        `UPDATE customer_accounts SET on_hold = 1, on_hold_at = datetime('now'),
                                       on_hold_reason = 'Auto-hold: overdue ' || ?2 || ' days'
         WHERE id = ?1`,
        [a.id, a.oldest_overdue_days],
      );
      placed++;
    } else if (a.oldest_overdue_days < a.days_overdue_hold && a.on_hold) {
      await execute(
        `UPDATE customer_accounts SET on_hold = 0, on_hold_at = NULL, on_hold_reason = NULL WHERE id = ?1`,
        [a.id],
      );
      released++;
    }
  }
  return { placed, released };
}

// ─── Rental agreements (Task 69) ────────────────────────
export async function createRentalAgreement(input: {
  customer_id: string;
  starts_at: string;
  ends_at: string;
  deposit_amount?: number;
  items: Array<{ product_id: string; serial?: string; quantity?: number; daily_rate: number; equipment_unit_id?: string; meter_out?: number }>;
  branch_id?: string;
  notes?: string;
}): Promise<string> {
  const id = newId();
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(agreement_number, 9) AS INTEGER)), 0) AS n
     FROM rental_agreements WHERE agreement_number LIKE ?1`,
    [`RA-${year}-%`],
  );
  const number = `RA-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;

  // Guard: any serialized unit on the agreement must be free to hire.
  const unitIds = input.items.map((i) => i.equipment_unit_id).filter((x): x is string => !!x);
  if (unitIds.length) {
    const rows = await query<{ id: string; status: string }>(
      `SELECT id, status FROM equipment_units WHERE id IN (${unitIds.map((_, i) => `?${i + 1}`).join(",")})`,
      unitIds,
    );
    const blocked = rows.filter((r) => !["in_stock", "sold"].includes(r.status));
    if (blocked.length) throw new Error(`Unit not available to hire (status ${blocked[0].status}).`);
  }

  const now = new Date().toISOString();
  const stmts: { sql: string; params: unknown[] }[] = [{
    sql: `INSERT INTO rental_agreements
            (id, agreement_number, customer_id, branch_id, starts_at, ends_at, deposit_amount, notes)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    params: [id, number, input.customer_id, input.branch_id ?? null, input.starts_at, input.ends_at, input.deposit_amount ?? 0, input.notes ?? null],
  }];
  for (const it of input.items) {
    stmts.push({
      sql: `INSERT INTO rental_items (id, agreement_id, product_id, serial, quantity, daily_rate, equipment_unit_id, meter_out)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      params: [newId(), id, it.product_id, it.serial ?? null, it.quantity ?? 1, it.daily_rate, it.equipment_unit_id ?? null, it.meter_out ?? null],
    });
    if (it.equipment_unit_id) {
      stmts.push({
        sql: `UPDATE equipment_units SET status = 'rented', updated_at = ?2 WHERE id = ?1 AND status IN ('in_stock','sold')`,
        params: [it.equipment_unit_id, now],
      });
    }
  }
  await transaction(stmts);
  return id;
}

/**
 * Return a rental. Flips each hired unit back to its resting state (sold if
 * it had been sold, else in_stock) and records the meter-in reading against
 * the unit's running total. Damage / late fees + condition are captured on
 * the agreement.
 */
export async function returnRental(
  agreementId: string,
  opts?: { damageFee?: number; lateFee?: number; condition?: string; meterIn?: Record<string, number> },
): Promise<void> {
  const now = new Date().toISOString();
  const items = await query<{ id: string; equipment_unit_id: string | null }>(
    `SELECT id, equipment_unit_id FROM rental_items WHERE agreement_id = ?1`,
    [agreementId],
  );
  const stmts: { sql: string; params: unknown[] }[] = [{
    sql: `UPDATE rental_agreements
          SET status = 'returned', actual_returned_at = ?2, damage_fee = ?3, late_fee = ?4
          WHERE id = ?1`,
    params: [agreementId, now, opts?.damageFee ?? 0, opts?.lateFee ?? 0],
  }];
  for (const it of items) {
    const meterIn = opts?.meterIn?.[it.id];
    stmts.push({
      sql: `UPDATE rental_items SET condition_on_return = ?2, returned_quantity = quantity, meter_in = ?3 WHERE id = ?1`,
      params: [it.id, opts?.condition ?? null, meterIn ?? null],
    });
    if (it.equipment_unit_id) {
      // Back to resting state; a machine that had been sold stays 'sold'.
      stmts.push({
        sql: `UPDATE equipment_units
              SET status = CASE WHEN sale_id IS NOT NULL THEN 'sold' ELSE 'in_stock' END,
                  meter_value = COALESCE(?2, meter_value),
                  updated_at = ?3
              WHERE id = ?1 AND status = 'rented'`,
        params: [it.equipment_unit_id, meterIn ?? null, now],
      });
    }
  }
  await transaction(stmts);
}

// ─── Rental reads ──────────────────────────────────────

export interface RentalAgreementRow {
  id: string;
  agreement_number: string;
  customer_id: string;
  customer_name: string | null;
  starts_at: string;
  ends_at: string;
  actual_returned_at: string | null;
  status: string;
  deposit_amount: number;
  damage_fee: number;
  late_fee: number;
  item_count: number;
  daily_total: number;
}

export async function listRentalAgreements(opts?: { status?: string; search?: string }): Promise<RentalAgreementRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.status) { params.push(opts.status); where.push(`a.status = ?${params.length}`); }
  if (opts?.search) { params.push(`%${opts.search.trim()}%`, `%${opts.search.trim()}%`); where.push(`(a.agreement_number LIKE ?${params.length - 1} OR c.name LIKE ?${params.length})`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return query<RentalAgreementRow>(
    `SELECT a.*, c.name AS customer_name,
            (SELECT COUNT(*) FROM rental_items ri WHERE ri.agreement_id = a.id) AS item_count,
            (SELECT COALESCE(SUM(ri.daily_rate * ri.quantity), 0) FROM rental_items ri WHERE ri.agreement_id = a.id) AS daily_total
     FROM rental_agreements a
     LEFT JOIN customers c ON c.id = a.customer_id
     ${clause}
     ORDER BY a.created_at DESC LIMIT 300`,
    params,
  );
}

export interface RentalItemRow {
  id: string;
  product_id: string;
  product_name: string | null;
  serial: string | null;
  equipment_unit_id: string | null;
  quantity: number;
  daily_rate: number;
  returned_quantity: number;
  condition_on_return: string | null;
  meter_out: number | null;
  meter_in: number | null;
}

export async function getRentalAgreement(id: string): Promise<{ agreement: RentalAgreementRow; items: RentalItemRow[] } | null> {
  const [agreement] = await listRentalAgreementsById(id);
  if (!agreement) return null;
  const items = await query<RentalItemRow>(
    `SELECT ri.*, p.name AS product_name
     FROM rental_items ri JOIN products p ON p.id = ri.product_id
     WHERE ri.agreement_id = ?1`,
    [id],
  );
  return { agreement, items };
}

async function listRentalAgreementsById(id: string): Promise<RentalAgreementRow[]> {
  return query<RentalAgreementRow>(
    `SELECT a.*, c.name AS customer_name,
            (SELECT COUNT(*) FROM rental_items ri WHERE ri.agreement_id = a.id) AS item_count,
            (SELECT COALESCE(SUM(ri.daily_rate * ri.quantity), 0) FROM rental_items ri WHERE ri.agreement_id = a.id) AS daily_total
     FROM rental_agreements a LEFT JOIN customers c ON c.id = a.customer_id
     WHERE a.id = ?1`,
    [id],
  );
}

/** The current active hire for a unit, if any (for the unit detail sheet). */
export async function getActiveHireForUnit(unitId: string): Promise<{ agreement_number: string; customer_name: string | null; ends_at: string } | null> {
  const [row] = await query<{ agreement_number: string; customer_name: string | null; ends_at: string }>(
    `SELECT a.agreement_number, c.name AS customer_name, a.ends_at
     FROM rental_items ri
     JOIN rental_agreements a ON a.id = ri.agreement_id
     LEFT JOIN customers c ON c.id = a.customer_id
     WHERE ri.equipment_unit_id = ?1 AND a.status = 'active'
     ORDER BY a.created_at DESC LIMIT 1`,
    [unitId],
  );
  return row ?? null;
}
