/**
 * Cycle counts, damages, stock aging, dead stock reports.
 *
 * Cycle counts: schedule + start + record + close. Variance rolls up to a
 * stock adjustment posting (future patch).
 *
 * Damages: separate ledger from shrinkage. Discovered at receipt / in-store / in-transit.
 *
 * Aging: how long has each batch sat, in days. Sorted descending.
 * Dead stock: SKUs with zero sales in N days (default 60).
 */
import { execute, query } from "@/lib/db";

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

// ─── Cycle counts ───────────────────────────────────────
export interface CycleCount {
  id: string;
  schedule_id: string | null;
  count_date: string;
  status: "in_progress" | "completed" | "cancelled";
  counted_by: string | null;
  notes: string | null;
  completed_at: string | null;
  items_count?: number;
}

export interface CycleCountItem {
  id: string;
  cycle_count_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
  reason: string | null;
}

export async function startCycleCount(input: {
  schedule_id?: string;
  category_id?: string;
  counted_by?: string;
  notes?: string;
  top_n_by_velocity?: number;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO cycle_counts (id, schedule_id, count_date, status, counted_by, notes)
     VALUES (?1, ?2, date('now'), 'in_progress', ?3, ?4)`,
    [id, input.schedule_id ?? null, input.counted_by ?? null, input.notes ?? null],
  );
  // Populate items — either all in a category, or top-N by sales velocity.
  let productsSql = `SELECT p.id AS product_id, COALESCE(SUM(b.quantity), 0) AS system_qty
     FROM products p LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.deleted_at IS NULL AND p.active = 1`;
  const params: unknown[] = [];
  let i = 0;
  if (input.category_id) {
    productsSql += ` AND p.category_id = ?${++i}`;
    params.push(input.category_id);
  }
  productsSql += ` GROUP BY p.id`;
  if (input.top_n_by_velocity) {
    productsSql += ` ORDER BY (
       SELECT COUNT(*) FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id = p.id AND s.created_at >= datetime('now', '-30 days')
     ) DESC
     LIMIT ${input.top_n_by_velocity}`;
  }
  const products = await query<{ product_id: string; system_qty: number }>(productsSql, params).catch(() => []);
  for (const p of products) {
    await execute(
      `INSERT INTO cycle_count_items (id, cycle_count_id, product_id, system_qty)
       VALUES (?1, ?2, ?3, ?4)`,
      [newId(), id, p.product_id, p.system_qty],
    );
  }
  return id;
}

export async function recordCount(itemId: string, countedQty: number, reason?: string): Promise<void> {
  const [row] = await query<{ system_qty: number }>(
    `SELECT system_qty FROM cycle_count_items WHERE id = ?1`,
    [itemId],
  );
  const variance = countedQty - (row?.system_qty ?? 0);
  await execute(
    `UPDATE cycle_count_items SET counted_qty = ?2, variance = ?3, reason = ?4 WHERE id = ?1`,
    [itemId, countedQty, variance, reason ?? null],
  );
}

export async function completeCycleCount(id: string): Promise<void> {
  await execute(
    `UPDATE cycle_counts SET status = 'completed', completed_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}

export async function listCycleCounts(): Promise<CycleCount[]> {
  return query<CycleCount>(
    `SELECT c.id, c.schedule_id, c.count_date, c.status, c.counted_by, c.notes, c.completed_at,
            (SELECT COUNT(*) FROM cycle_count_items WHERE cycle_count_id = c.id) AS items_count
     FROM cycle_counts c
     ORDER BY c.count_date DESC LIMIT 100`,
  );
}

export async function listCycleCountItems(cycleCountId: string): Promise<CycleCountItem[]> {
  return query<CycleCountItem>(
    `SELECT
        ci.id, ci.cycle_count_id, ci.product_id,
        p.name AS product_name, p.sku AS product_sku,
        ci.system_qty, ci.counted_qty, ci.variance, ci.reason
     FROM cycle_count_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cycle_count_id = ?1
     ORDER BY p.name ASC`,
    [cycleCountId],
  );
}

// ─── Damages ──────────────────────────────────────────
export interface DamageEntry {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  occurred_at: string;
  discovered_at_stage: "on_receipt" | "in_store" | "in_transit";
  reason: string | null;
  reported_by: string | null;
}

export async function recordDamage(input: {
  product_id: string;
  batch_id?: string;
  quantity: number;
  discovered_at_stage: DamageEntry["discovered_at_stage"];
  reason?: string;
  reported_by?: string;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO damages (id, product_id, batch_id, quantity, discovered_at_stage, reason, reported_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, input.product_id, input.batch_id ?? null, input.quantity, input.discovered_at_stage, input.reason ?? null, input.reported_by ?? null],
  );
  // Deduct from batch if specified.
  if (input.batch_id) {
    await execute(
      `UPDATE batches SET quantity = MAX(0, quantity - ?2) WHERE id = ?1`,
      [input.batch_id, input.quantity],
    );
  }
  return id;
}

export async function listDamages(sinceDays = 90): Promise<DamageEntry[]> {
  return query<DamageEntry>(
    `SELECT d.id, d.product_id, p.name AS product_name, d.quantity, d.occurred_at,
            d.discovered_at_stage, d.reason, d.reported_by
     FROM damages d
     JOIN products p ON p.id = d.product_id
     WHERE d.occurred_at >= datetime('now', ?1)
     ORDER BY d.occurred_at DESC LIMIT 500`,
    [`-${sinceDays} days`],
  );
}

// ─── Stock aging ──────────────────────────────────────
export interface AgingBatch {
  batch_id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  received_at: string;
  age_days: number;
  cost_value: number;
}

export async function stockAging(): Promise<AgingBatch[]> {
  return query<AgingBatch>(
    `SELECT
        b.id AS batch_id, b.product_id, p.name AS product_name,
        b.batch_number, b.quantity, b.received_at,
        CAST(julianday('now') - julianday(b.received_at) AS INTEGER) AS age_days,
        b.quantity * COALESCE(b.buying_price, 0) AS cost_value
     FROM batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.quantity > 0 AND b.received_at IS NOT NULL
     ORDER BY age_days DESC
     LIMIT 500`,
  ).catch(() => []);
}

// ─── Dead stock ───────────────────────────────────────
export interface DeadStockItem {
  product_id: string;
  product_name: string;
  sku: string;
  qty_on_hand: number;
  cost_value: number;
  last_sold_at: string | null;
  days_since_sold: number | null;
}

export async function deadStock(daysThreshold = 60): Promise<DeadStockItem[]> {
  return query<DeadStockItem>(
    `SELECT
        p.id AS product_id, p.name AS product_name, p.sku,
        COALESCE(SUM(b.quantity), 0) AS qty_on_hand,
        COALESCE(SUM(b.quantity * b.buying_price), 0) AS cost_value,
        (SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = p.id AND s.status = 'completed') AS last_sold_at,
        (SELECT CAST(julianday('now') - julianday(MAX(s.created_at)) AS INTEGER)
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = p.id AND s.status = 'completed') AS days_since_sold
     FROM products p
     LEFT JOIN batches b ON b.product_id = p.id
     WHERE p.deleted_at IS NULL AND p.active = 1
     GROUP BY p.id
     HAVING qty_on_hand > 0
        AND (last_sold_at IS NULL OR julianday('now') - julianday(last_sold_at) > ?1)
     ORDER BY cost_value DESC
     LIMIT 200`,
    [daysThreshold],
  );
}
