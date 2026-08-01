/** POS data helpers scoped to the selected operational branch. */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface TodaySalesSummary {
  count: number; revenue: number; cash: number; mpesa: number; card: number;
  other: number; refunds: number; avg_basket: number;
}

const EMPTY_SUMMARY: TodaySalesSummary = {
  count: 0, revenue: 0, cash: 0, mpesa: 0, card: 0, other: 0, refunds: 0, avg_basket: 0,
};

export async function getTodaySalesSummary(): Promise<TodaySalesSummary> {
  const branchId = getActiveBranchId();
  if (!branchId) return EMPTY_SUMMARY;
  const [s, r] = await Promise.all([
    query<{ count: number; revenue: number }>(
      `SELECT COUNT(CASE WHEN status != 'voided' THEN 1 END) AS count,
              COALESCE(SUM(CASE WHEN status NOT IN ('voided','held') THEN total ELSE 0 END), 0) AS revenue
       FROM sales WHERE date(created_at) = date('now') AND branch_id = ?1`,
      [branchId],
    ),
    query<{ refunds: number }>(
      `SELECT COALESCE(SUM(refund_amount), 0) AS refunds
       FROM sale_returns WHERE date(created_at) = date('now') AND branch_id = ?1`,
      [branchId],
    ),
  ]);
  const grossRevenue = s[0]?.revenue || 0;
  const refunds = r[0]?.refunds || 0;
  const count = s[0]?.count || 0;
  const methods = await query<{ method_name: string; total: number }>(
    `SELECT p.method_name, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p JOIN sales sale ON sale.id = p.sale_id
     WHERE date(sale.created_at) = date('now') AND sale.branch_id = ?1 AND sale.status != 'voided'
     GROUP BY p.method_name`,
    [branchId],
  );
  let cash = 0, mpesa = 0, card = 0, other = 0;
  for (const method of methods) {
    const lower = method.method_name.toLowerCase();
    if (lower.includes("cash")) cash += method.total;
    else if (lower.includes("mpesa") || lower.includes("m-pesa")) mpesa += method.total;
    else if (lower.includes("card")) card += method.total;
    else other += method.total;
  }
  return {
    count,
    revenue: Math.max(0, grossRevenue - refunds),
    cash, mpesa, card, other, refunds,
    avg_basket: count ? grossRevenue / count : 0,
  };
}

export interface PopularProduct {
  id: string; name: string; selling_price: number; tax_rate: number;
  stock_qty: number; reorder_level: number; category_id: string | null;
  category_name: string | null; units_sold: number; image_path?: string | null;
}

export async function getPopularProducts(limit = 24): Promise<PopularProduct[]> {
  const branchId = getActiveBranchId();
  if (!branchId) return [];
  return query<PopularProduct>(
    `SELECT p.id, p.name, p.tax_rate, p.reorder_level, p.category_id, p.image_path,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) AS stock_qty,
       c.name AS category_name,
       COALESCE((SELECT SUM(si.quantity) FROM sale_items si
         JOIN sales sale ON sale.id = si.sale_id
         WHERE si.product_id = p.id AND sale.branch_id = ?1
           AND sale.created_at >= datetime('now', '-30 days') AND sale.status != 'voided'), 0) AS units_sold
     FROM stockable_products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.active = 1
     ORDER BY units_sold DESC, p.name LIMIT ?2`,
    [branchId, limit],
  );
}

export async function getLowStockProducts(limit = 10): Promise<Array<{ id: string; name: string; stock_qty: number; reorder_level: number }>> {
  const branchId = getActiveBranchId();
  if (!branchId) return [];
  return query(
    `SELECT p.id, p.name, p.reorder_level,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) AS stock_qty
     FROM stockable_products p
     WHERE p.active = 1
       AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) <= p.reorder_level
       AND p.reorder_level > 0
     ORDER BY (stock_qty * 1.0 / NULLIF(p.reorder_level, 0)) ASC LIMIT ?2`,
    [branchId, limit],
  );
}

export interface ProductsByCategory {
  category_id: string | null;
  category_name: string;
  products: PopularProduct[];
}

export async function getProductsForCategory(categoryId: string | null, limit = 60): Promise<PopularProduct[]> {
  const branchId = getActiveBranchId();
  if (!branchId) return [];
  const categoryWhere = categoryId ? "p.category_id = ?2" : "p.category_id IS NULL";
  return query<PopularProduct>(
    `SELECT p.id, p.name, p.tax_rate, p.reorder_level, p.category_id, p.image_path,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) AS stock_qty,
       c.name AS category_name, 0 AS units_sold
     FROM stockable_products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.active = 1 AND ${categoryWhere}
     ORDER BY p.name LIMIT ?${categoryId ? 3 : 2}`,
    categoryId ? [branchId, categoryId, limit] : [branchId, limit],
  );
}
