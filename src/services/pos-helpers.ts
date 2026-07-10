/**
 * Lightweight POS data helpers — today's sale stats, popular products, low stock alerts.
 */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface TodaySalesSummary {
  count: number;
  revenue: number;
  cash: number;
  mpesa: number;
  card: number;
  other: number;
  refunds: number;
  avg_basket: number;
}

export async function getTodaySalesSummary(): Promise<TodaySalesSummary> {
  const branchId = getActiveBranchId();
  // Two aggregates run in parallel:
  //  1. sales for today (count + gross revenue, ignoring voided + held)
  //  2. returns for today (refund total, so the dashboard shows NET revenue
  //     not gross). Uses sale_returns.created_at as the return date so a
  //     late refund of an older sale still counts toward today's till.
  const [s, r] = await Promise.all([
    query<{ count: number; revenue: number }>(
      `SELECT
         COUNT(CASE WHEN status != 'voided' THEN 1 END) AS count,
         COALESCE(SUM(CASE WHEN status NOT IN ('voided','held') THEN total ELSE 0 END), 0) AS revenue
       FROM sales WHERE date(created_at) = date('now') AND branch_id = ?1`,
      [branchId],
    ),
    query<{ refunds: number }>(
      `SELECT COALESCE(SUM(refund_amount), 0) AS refunds
         FROM sale_returns
        WHERE date(created_at) = date('now') AND branch_id = ?1`,
      [branchId],
    ),
  ]);
  const grossRevenue = s[0]?.revenue || 0;
  const refunds = r[0]?.refunds || 0;
  const revenue = Math.max(0, grossRevenue - refunds);
  const count = s[0]?.count || 0;

  const methods = await query<{ method_name: string; total: number }>(
    `SELECT p.method_name, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p
     JOIN sales s ON s.id = p.sale_id
     WHERE date(s.created_at) = date('now') AND s.branch_id = ?1 AND s.status != 'voided'
     GROUP BY p.method_name`,
    [branchId],
  );
  let cash = 0, mpesa = 0, card = 0, other = 0;
  for (const m of methods) {
    const lower = m.method_name.toLowerCase();
    if (lower.includes("cash")) cash += m.total;
    else if (lower.includes("mpesa") || lower.includes("m-pesa")) mpesa += m.total;
    else if (lower.includes("card")) card += m.total;
    else other += m.total;
  }
  return {
    count,
    // `revenue` is now NET (gross - refunds) so the POS overview and
    // dashboard show what the till actually retained today. Callers that
    // want the gross figure can subtract `refunds` back.
    revenue,
    cash, mpesa, card, other,
    refunds,
    avg_basket: count ? grossRevenue / count : 0,
  };
}

export interface PopularProduct {
  id: string;
  name: string;
  selling_price: number;
  tax_rate: number;
  stock_qty: number;
  reorder_level: number;
  category_id: string | null;
  category_name: string | null;
  units_sold: number;
  image_path?: string | null;
}

/** Top 24 products by units sold in the last 30 days. */
export async function getPopularProducts(limit = 24): Promise<PopularProduct[]> {
  return query<PopularProduct>(
    `SELECT p.id, p.name, p.tax_rate, p.reorder_level, p.category_id, p.image_path,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
       c.name AS category_name,
       COALESCE((SELECT SUM(si.quantity) FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = p.id AND s.created_at >= datetime('now', '-30 days')
         AND s.status != 'voided'), 0) AS units_sold
     FROM products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.active = 1
     AND COALESCE(p.kind, 'retail') != 'menu_item'
     AND COALESCE(p.is_service, 0) = 0
     ORDER BY units_sold DESC, p.name
     LIMIT ?1`,
    [limit],
  );
}

/** Products with stock at or below reorder level. */
export async function getLowStockProducts(limit = 10): Promise<Array<{ id: string; name: string; stock_qty: number; reorder_level: number }>> {
  return query(
    `SELECT p.id, p.name, p.reorder_level,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty
     FROM products p
     WHERE p.active = 1
     AND COALESCE(p.kind, 'retail') != 'menu_item'
     AND COALESCE(p.is_service, 0) = 0
     AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) <= p.reorder_level
     AND p.reorder_level > 0
     ORDER BY (stock_qty * 1.0 / NULLIF(p.reorder_level, 0)) ASC
     LIMIT ?1`,
    [limit],
  );
}

export interface ProductsByCategory {
  category_id: string | null;
  category_name: string;
  products: PopularProduct[];
}

/** Get products grouped by category for category-tab browsing. */
export async function getProductsForCategory(categoryId: string | null, limit = 60): Promise<PopularProduct[]> {
  const where = categoryId ? "p.category_id = ?1" : "p.category_id IS NULL";
  return query<PopularProduct>(
    `SELECT p.id, p.name, p.tax_rate, p.reorder_level, p.category_id, p.image_path,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
       c.name AS category_name,
       0 AS units_sold
     FROM products p
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.active = 1 AND COALESCE(p.kind, 'retail') != 'menu_item' AND COALESCE(p.is_service, 0) = 0 AND ${where}
     ORDER BY p.name
     LIMIT ?${categoryId ? 2 : 1}`,
    categoryId ? [categoryId, limit] : [limit],
  );
}
