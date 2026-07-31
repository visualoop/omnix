/**
 * Bulk stock refresh for the selected operational branch.
 */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export async function getStockMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const branchId = getActiveBranchId();
  if (!branchId) return new Map(productIds.map((id) => [id, 0]));
  const placeholders = productIds.map((_, i) => `?${i + 1}`).join(",");
  const rows = await query<{ product_id: string; stock_qty: number }>(
    `SELECT product_id, COALESCE(SUM(quantity), 0) AS stock_qty
     FROM batches
     WHERE product_id IN (${placeholders}) AND branch_id = ?${productIds.length + 1}
     GROUP BY product_id`,
    [...productIds, branchId],
  );
  const map = new Map<string, number>();
  for (const id of productIds) map.set(id, 0);
  for (const r of rows) map.set(r.product_id, r.stock_qty);
  return map;
}
