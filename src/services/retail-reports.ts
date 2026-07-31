/**
 * Retail-flavored dashboard reports.
 */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export interface BrandPerformance {
  brand_id: string;
  brand_name: string;
  units_sold: number;
  revenue: number;
  unique_skus: number;
}

export async function getBrandPerformance(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<BrandPerformance[]> {
  const branchId = getActiveBranchId();
  if (!branchId) return [];
  const conditions: string[] = ["s.status != 'voided'", "s.branch_id = ?1"];
  const params: unknown[] = [branchId];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  // Sale filters live in the JOIN condition so brands with no qualifying
  // sales still evaluate cleanly; brand filter is the outer WHERE.
  const joinCond = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  return query<BrandPerformance>(
    `SELECT b.id AS brand_id, b.name AS brand_name,
       COALESCE(SUM(si.quantity), 0) AS units_sold,
       COALESCE(SUM(si.total), 0) AS revenue,
       COUNT(DISTINCT si.product_id) AS unique_skus
     FROM brands b
     LEFT JOIN products p ON p.brand_id = b.id
     LEFT JOIN sale_items si ON si.product_id = p.id
     LEFT JOIN sales s ON s.id = si.sale_id ${joinCond}
     WHERE b.active = 1
     GROUP BY b.id
     HAVING units_sold > 0
     ORDER BY revenue DESC
     LIMIT 20`,
    params,
  );
}

export interface CategoryMix {
  category_id: string | null;
  category_name: string;
  units_sold: number;
  revenue: number;
  percentage: number;
}

export async function getCategoryMix(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<CategoryMix[]> {
  const branchId = getActiveBranchId();
  if (!branchId) return [];
  const conditions: string[] = ["s.status != 'voided'", "s.branch_id = ?1"];
  const params: unknown[] = [branchId];
  if (opts?.startDate) { conditions.push(`s.created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`s.created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query<{ category_id: string | null; category_name: string; units_sold: number; revenue: number }>(
    `SELECT
       p.category_id,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       COALESCE(SUM(si.quantity), 0) AS units_sold,
       COALESCE(SUM(si.total), 0) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     ${where}
     GROUP BY p.category_id
     ORDER BY revenue DESC`,
    params,
  );

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  return rows.map((r) => ({
    ...r,
    percentage: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
  }));
}

export interface RetailKpis {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  total_units_sold: number;
  total_shrinkage_cost: number;
  active_laybys: number;
  active_layby_balance: number;
  pending_special_orders: number;
}

export async function getRetailKpis(opts?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<RetailKpis> {
  const branchId = getActiveBranchId();
  if (!branchId) {
    return { total_revenue: 0, total_orders: 0, avg_order_value: 0, total_units_sold: 0, total_shrinkage_cost: 0, active_laybys: 0, active_layby_balance: 0, pending_special_orders: 0 };
  }
  const conditions: string[] = ["branch_id = ?1"];
  const params: unknown[] = [branchId];
  if (opts?.startDate) { conditions.push(`created_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`created_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  const salesWhere = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  const [sales] = await query<{ total_revenue: number; total_orders: number; total_units: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total_revenue,
            COUNT(*) AS total_orders,
            COALESCE((SELECT SUM(quantity) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE status != 'voided' ${salesWhere})), 0) AS total_units
     FROM sales WHERE status != 'voided' ${salesWhere}`,
    params,
  );

  const shrinkConditions = ["branch_id = ?1"];
  const shrinkParams: unknown[] = [branchId];
  if (opts?.startDate) { shrinkParams.push(opts.startDate); shrinkConditions.push(`incident_date >= ?${shrinkParams.length}`); }
  if (opts?.endDate) { shrinkParams.push(opts.endDate); shrinkConditions.push(`incident_date <= ?${shrinkParams.length}`); }
  const [shrinkage] = await query<{ cost: number }>(
    `SELECT COALESCE(SUM(cost_value), 0) AS cost FROM shrinkage WHERE ${shrinkConditions.join(" AND ")}`,
    shrinkParams,
  );

  const [laybys] = await query<{ count: number; balance: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(balance_due), 0) AS balance FROM laybys WHERE status = 'active' AND branch_id = ?1`,
    [branchId],
  );

  const [special] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM special_orders WHERE status IN ('pending', 'ordered') AND branch_id = ?1`,
    [branchId],
  );

  return {
    total_revenue: sales?.total_revenue || 0,
    total_orders: sales?.total_orders || 0,
    avg_order_value: sales?.total_orders ? sales.total_revenue / sales.total_orders : 0,
    total_units_sold: sales?.total_units || 0,
    total_shrinkage_cost: shrinkage?.cost || 0,
    active_laybys: laybys?.count || 0,
    active_layby_balance: laybys?.balance || 0,
    pending_special_orders: special?.count || 0,
  };
}
