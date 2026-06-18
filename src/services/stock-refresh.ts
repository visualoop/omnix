/**
 * Bulk stock refresh — fetches the current stock_qty for a list of
 * product IDs in a single query. Used by POS to keep displayed
 * cards + cart items in sync with reality every 2 seconds.
 *
 * Returns a Map keyed by product_id so callers can look up by id
 * cheaply during render.
 */
import { query } from "@/lib/db";

export async function getStockMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const placeholders = productIds.map((_, i) => `?${i + 1}`).join(",");
  const rows = await query<{ product_id: string; stock_qty: number }>(
    `SELECT product_id, COALESCE(SUM(quantity), 0) AS stock_qty
     FROM batches
     WHERE product_id IN (${placeholders})
     GROUP BY product_id`,
    productIds,
  );
  const map = new Map<string, number>();
  // Initialize every requested id to 0 so missing-from-batches rows
  // don't fall through and show as undefined (= "no stock cap").
  for (const id of productIds) map.set(id, 0);
  for (const r of rows) map.set(r.product_id, r.stock_qty);
  return map;
}
