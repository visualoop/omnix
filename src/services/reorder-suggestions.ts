/**
 * Reorder suggestions — velocity-based.
 *
 * Algorithm (per SKU):
 *   velocity_30d = units sold in the last 30 days / 30
 *   days_of_cover = current_stock / velocity_30d
 *   lead_time_days = product.lead_time_days || global default (7)
 *   safety_stock = velocity_30d × safety_days (default 3)
 *
 * Trigger conditions:
 *   1. days_of_cover <= (lead_time + safety) → suggest
 *   2. current_stock == 0 → always suggest (stockout)
 *   3. current_stock <= reorder_level → always suggest
 *
 * Suggested qty:
 *   velocity × (lead_time + safety_days + reorder_cycle_days) − current_stock
 */
import { execute, query } from "@/lib/db";

export interface ReorderSuggestion {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  reorder_level: number | null;
  velocity_30d: number;
  days_of_cover: number;
  lead_time_days: number;
  suggested_qty: number;
  reason: string;
  status: "pending" | "ordered" | "dismissed";
  generated_at: string;
}

interface RunOptions {
  default_lead_time_days?: number;
  safety_days?: number;
  reorder_cycle_days?: number;
}

/**
 * Regenerate reorder suggestions. Replaces existing 'pending' rows.
 * Returns the number of suggestions generated.
 */
export async function regenerateSuggestions(opts: RunOptions = {}): Promise<number> {
  const leadDefault = opts.default_lead_time_days ?? 7;
  const safety = opts.safety_days ?? 3;
  const cycle = opts.reorder_cycle_days ?? 14;

  // Drop existing pending rows so we start fresh.
  await execute(`DELETE FROM reorder_suggestions WHERE status = 'pending'`);

  const rows = await query<{
    product_id: string;
    current_stock: number;
    reorder_level: number | null;
    lead_time_days: number | null;
    sold_30d: number;
  }>(
    `SELECT
        p.id AS product_id,
        COALESCE((SELECT SUM(quantity) FROM batches b WHERE b.product_id = p.id), 0) AS current_stock,
        p.reorder_level,
        p.lead_time_days,
        COALESCE((
          SELECT SUM(si.quantity) FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          WHERE si.product_id = p.id
            AND s.status = 'completed'
            AND s.created_at >= datetime('now', '-30 days')
        ), 0) AS sold_30d
     FROM products p
     WHERE p.deleted_at IS NULL AND p.active = 1`,
  ).catch(() => []);

  let generated = 0;
  for (const r of rows) {
    const velocity = r.sold_30d / 30;
    const leadTime = r.lead_time_days ?? leadDefault;
    const cover = velocity > 0 ? r.current_stock / velocity : Infinity;
    const threshold = leadTime + safety;

    let reason: string | null = null;
    if (r.current_stock === 0 && r.sold_30d > 0) {
      reason = "stockout";
    } else if (r.reorder_level && r.current_stock <= r.reorder_level) {
      reason = "below_reorder";
    } else if (velocity > 0 && cover <= threshold) {
      reason = "expected_stockout";
    }

    if (!reason) continue;

    const suggestedQty = Math.max(
      1,
      Math.ceil(velocity * (leadTime + safety + cycle) - r.current_stock),
    );

    await execute(
      `INSERT INTO reorder_suggestions
        (id, product_id, suggested_qty, velocity_30d, days_of_cover, lead_time_days, reason, status, generated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', datetime('now'))`,
      [
        crypto.randomUUID().replace(/-/g, "").slice(0, 16),
        r.product_id,
        suggestedQty,
        velocity,
        isFinite(cover) ? cover : null,
        leadTime,
        reason,
      ],
    );
    generated++;
  }

  return generated;
}

export async function listSuggestions(status: "pending" | "ordered" | "dismissed" = "pending"): Promise<ReorderSuggestion[]> {
  return query<ReorderSuggestion>(
    `SELECT
        rs.id, rs.product_id,
        p.name AS product_name,
        p.sku,
        COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id), 0) AS current_stock,
        p.reorder_level,
        rs.velocity_30d,
        rs.days_of_cover,
        rs.lead_time_days,
        rs.suggested_qty,
        rs.reason,
        rs.status,
        rs.generated_at
     FROM reorder_suggestions rs
     JOIN products p ON p.id = rs.product_id
     WHERE rs.status = ?1
     ORDER BY
       CASE rs.reason
         WHEN 'stockout' THEN 0
         WHEN 'below_reorder' THEN 1
         WHEN 'expected_stockout' THEN 2
         ELSE 3 END,
       rs.days_of_cover ASC NULLS FIRST`,
    [status],
  );
}

export async function markOrdered(suggestionId: string): Promise<void> {
  await execute(`UPDATE reorder_suggestions SET status = 'ordered' WHERE id = ?1`, [suggestionId]);
}

export async function dismiss(suggestionId: string): Promise<void> {
  await execute(`UPDATE reorder_suggestions SET status = 'dismissed' WHERE id = ?1`, [suggestionId]);
}
