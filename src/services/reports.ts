import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import { cogsExpr } from "@/services/cogs";

export interface DashboardKPIs {
  today_sales_count: number;
  today_sales_total: number;
  today_profit: number;
  low_stock_count: number;
  expiring_count: number;
  total_products: number;
  total_customers: number;
  cash_position: number;
}

export interface SalesByDay {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  qty_sold: number;
  total_revenue: number;
}

export interface SalesByPaymentMethod {
  method_name: string;
  count: number;
  total: number;
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const today = new Date().toISOString().slice(0, 10);
  const branchId = getActiveBranchId();

  const todaySales = await query<{ count: number; total: number }>(
    `SELECT
       COUNT(*) as count,
       COALESCE(SUM(total), 0) as total
     FROM sales WHERE date(created_at) = ?1 AND status = 'completed' AND branch_id = ?2`,
    [today, branchId]
  );

  // Subtract today's returns
  const todayReturns = await query<{ count: number; total: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total
     FROM sale_returns WHERE date(created_at) = ?1 AND branch_id = ?2`,
    [today, branchId],
  );

  const todayProfit = await query<{ profit: number }>(
    `SELECT (
       -- Gross profit on today's sales: revenue - COGS per line
       COALESCE((
         SELECT SUM(si.unit_price * si.quantity - ${cogsExpr("si")} * si.quantity)
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE date(s.created_at) = ?1 AND s.status = 'completed' AND s.branch_id = ?2
       ), 0)
       -
       -- Profit reversed by today's returns: refund - (original line's cost × qty)
       -- Uses the ORIGINAL sale_items row (via sale_return_items.sale_item_id) so
       -- the batch cost matches what was booked at the sale, not today's cost.
       COALESCE((
         SELECT SUM(sri.line_total - ${cogsExpr("si2")} * sri.quantity)
         FROM sale_return_items sri
         JOIN sale_returns sr ON sr.id = sri.return_id
         LEFT JOIN sale_items si2 ON si2.id = sri.sale_item_id
         WHERE date(sr.created_at) = ?1 AND sr.branch_id = ?2
       ), 0)
     ) as profit`,
    [today, branchId]
  );

  const lowStock = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM products p
     WHERE p.active = 1 
       AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) <= p.reorder_level`,
    [branchId]
  );

  const expiring = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM batches b
     WHERE b.expiry_date IS NOT NULL AND b.quantity > 0 AND b.branch_id = ?1
       AND julianday(b.expiry_date) - julianday('now') <= 90`,
    [branchId]
  );

  const products = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM products WHERE active = 1`
  );

  const customers = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM customers WHERE active = 1`
  );

  const cashPos = await query<{ total: number }>(
    `SELECT COALESCE(SUM(p.amount), 0) as total
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE date(s.created_at) = ?1 AND p.method_id = 'cash' AND s.branch_id = ?2`,
    [today, branchId]
  );

  return {
    today_sales_count: Math.max(0, (todaySales[0]?.count || 0) - (todayReturns[0]?.count || 0)),
    today_sales_total: Math.max(0, (todaySales[0]?.total || 0) - (todayReturns[0]?.total || 0)),
    today_profit: todayProfit[0]?.profit || 0,
    low_stock_count: lowStock[0]?.count || 0,
    expiring_count: expiring[0]?.count || 0,
    total_products: products[0]?.count || 0,
    total_customers: customers[0]?.count || 0,
    cash_position: cashPos[0]?.total || 0,
  };
}

export async function getSalesByDay(days: number = 7): Promise<SalesByDay[]> {
  return query<SalesByDay>(
    `SELECT date(s.created_at) as date,
            COALESCE(SUM(s.total), 0) -
              COALESCE((SELECT COALESCE(SUM(sr.refund_amount), 0)
                        FROM sale_returns sr WHERE date(sr.return_date) = date(s.created_at)
                        AND sr.branch_id = s.branch_id), 0) as total,
            COUNT(*) as count
     FROM sales s
     WHERE s.status = 'completed' AND s.branch_id = ?2
       AND julianday('now') - julianday(s.created_at) < ?1
     GROUP BY date(s.created_at)
     ORDER BY date ASC`,
    [days, getActiveBranchId()]
  );
}

export async function getTopProducts(days: number = 30, limit: number = 10): Promise<TopProduct[]> {
  return query<TopProduct>(
    `SELECT si.product_id, si.product_name,
            COALESCE(SUM(si.quantity), 0) -
              COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
                        JOIN sale_returns sr ON sr.id = sri.return_id
                        WHERE sri.product_id = si.product_id
                          AND sr.return_date >= date('now', ?4 || ' days')),
                      0) as qty_sold,
            COALESCE(SUM(si.total), 0) -
              COALESCE((SELECT SUM(sri.line_total) FROM sale_return_items sri
                        JOIN sale_returns sr ON sr.id = sri.return_id
                        WHERE sri.product_id = si.product_id
                          AND sr.return_date >= date('now', ?4 || ' days')),
                      0) as total_revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.branch_id = ?3
       AND julianday('now') - julianday(s.created_at) < ?1
     GROUP BY si.product_id, si.product_name
     HAVING qty_sold > 0
     ORDER BY total_revenue DESC LIMIT ?2`,
    [days, limit, getActiveBranchId(), -days],
  );
}

export async function getSalesByPaymentMethod(days: number = 30): Promise<SalesByPaymentMethod[]> {
  return query<SalesByPaymentMethod>(
    `SELECT p.method_name, COUNT(DISTINCT s.id) as count, SUM(p.amount) as total
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.status = 'completed' AND s.branch_id = ?2
       AND julianday('now') - julianday(s.created_at) < ?1
       AND s.id NOT IN (SELECT sale_id FROM sale_returns WHERE date(return_date) >= date('now', ?3 || ' days'))
     GROUP BY p.method_name ORDER BY total DESC`,
    [days, getActiveBranchId(), -days],
  );
}

export async function getStockValuation(): Promise<{ at_cost: number; at_retail: number; total_items: number }> {
  const rows = await query<{ at_cost: number; at_retail: number; total_items: number }>(
    `SELECT 
       COALESCE(SUM(b.quantity * b.buying_price), 0) as at_cost,
       COALESCE(SUM(b.quantity * pp.selling_price), 0) as at_retail,
       COALESCE(SUM(b.quantity), 0) as total_items
     FROM batches b
     JOIN products p ON p.id = b.product_id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE b.quantity > 0 AND p.active = 1`
  );
  return rows[0] || { at_cost: 0, at_retail: 0, total_items: 0 };
}

export async function getReorderList(): Promise<Array<{
  id: string; name: string; current_stock: number; reorder_level: number; deficit: number;
}>> {
  return query(
    `SELECT p.id, p.name, 
            COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as current_stock,
            p.reorder_level,
            p.reorder_level - COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as deficit
     FROM products p
     WHERE p.active = 1
       AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) <= p.reorder_level
     ORDER BY deficit DESC`
  );
}

export async function getDeadStock(_daysSinceLastSale: number = 60): Promise<Array<{
  id: string; name: string; current_stock: number; last_sale: string | null;
}>> {
  return query(
    `SELECT p.id, p.name,
            COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) as current_stock,
            (SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = p.id) as last_sale
     FROM products p
     WHERE p.active = 1
       AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) > 0
     ORDER BY last_sale ASC LIMIT 50`
  );
}

export interface StockMovementByDay {
  date: string;
  purchases: number;
  sales: number;
  adjustments: number;
}

export async function getStockMovementsByDay(days: number = 30): Promise<StockMovementByDay[]> {
  return query<StockMovementByDay>(
    `SELECT date(created_at) as date,
       COALESCE(SUM(CASE WHEN type = 'purchase' THEN quantity ELSE 0 END), 0) as purchases,
       COALESCE(SUM(CASE WHEN type = 'sale' THEN ABS(quantity) ELSE 0 END), 0) as sales,
       COALESCE(SUM(CASE WHEN type = 'adjustment' THEN ABS(quantity) ELSE 0 END), 0) as adjustments
     FROM stock_movements
     WHERE julianday('now') - julianday(created_at) < ?1
     GROUP BY date(created_at)
     ORDER BY date ASC`,
    [days]
  );
}

export async function getSalesComparison(
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<{
  current: { revenue: number; transactions: number; profit: number };
  previous: { revenue: number; transactions: number; profit: number };
}> {
  const fetchPeriod = async (start: string, end: string) => {
    const sales = await query<{ revenue: number; transactions: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactions
       FROM sales WHERE status = 'completed' AND date(created_at) BETWEEN ?1 AND ?2`,
      [start, end]
    );
    const profit = await query<{ profit: number }>(
      `SELECT COALESCE(SUM(si.unit_price * si.quantity - ${cogsExpr("si")} * si.quantity), 0) as profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND date(s.created_at) BETWEEN ?1 AND ?2`,
      [start, end]
    );
    return {
      revenue: sales[0]?.revenue || 0,
      transactions: sales[0]?.transactions || 0,
      profit: profit[0]?.profit || 0,
    };
  };

  const [current, previous] = await Promise.all([
    fetchPeriod(currentStart, currentEnd),
    fetchPeriod(previousStart, previousEnd),
  ]);

  return { current, previous };
}


// ─── Sales by source (module breakdown) ──────────────────────────────────────

/**
 * Revenue split by the upstream module workflow that produced each sale —
 * hospitality (kitchen orders), pharmacy (prescriptions), retail (laybys /
 * special orders), hardware (quotes), or NULL = walk-in POS sale.
 *
 * Lets reports answer questions like "how much of last week was restaurant
 * versus pharmacy?" without inferring from line composition.
 */
export interface SalesBySource {
  source_type: string;        // e.g. 'hospitality_order'
  label: string;              // human label
  revenue: number;
  transactions: number;
}

const SOURCE_LABELS: Record<string, string> = {
  hospitality_order: "Hospitality (kitchen)",
  prescription: "Pharmacy (prescriptions)",
  layby: "Retail (laybys)",
  special_order: "Retail (special orders)",
  folio: "Hospitality (room folios)",
  hardware_quote: "Hardware (quotes)",
};

export async function getSalesBySource(days: number = 30): Promise<SalesBySource[]> {
  const rows = await query<{ source_type: string | null; revenue: number; transactions: number }>(
    `SELECT source_type, COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactions
       FROM sales
      WHERE julianday('now') - julianday(created_at) < ?1
        AND payment_status = 'paid'
      GROUP BY source_type
      ORDER BY revenue DESC`,
    [days],
  );
  return rows.map((r) => ({
    source_type: r.source_type ?? "walk_in",
    label: r.source_type ? (SOURCE_LABELS[r.source_type] ?? r.source_type) : "Walk-in POS",
    revenue: r.revenue,
    transactions: r.transactions,
  }));
}
