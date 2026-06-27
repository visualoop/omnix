/**
 * Insight engine — deterministic, offline, SQL-first business analytics.
 *
 * This is the substance the AI narrates. The rule of the whole AI strategy:
 *
 *     SQL computes the numbers. The LLM only explains them.
 *
 * Every function here runs entirely against the local SQLite DB — no network,
 * no LLM, no cost — so insights work with zero internet and stay honest (the
 * model can never hallucinate a figure it was handed). The assistant's
 * read-tools and the dashboard "Today" card both call into this module; the
 * LLM is invoked separately, after, only to phrase a recommendation.
 *
 * All money is treated in whole units (KES) as stored. COGS resolves through
 * the centralised `cogsExpr` fallback chain so profit matches every other
 * report. Branch scoping uses the active branch where a sale is involved.
 */
import { query } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";
import { cogsExpr } from "@/services/cogs";

/* ─────────────────────────────────────────────────────────────────────────
 * Reorder suggestions — not just "what's low" but "how much to buy".
 *
 * Suggested qty = projected demand over (lead time + review period) + safety
 * stock − stock on hand, using the product's own recent sales velocity. We
 * default lead time to 7 days and safety to 1.5× daily velocity; both are
 * deliberately simple, explainable heuristics (an ERP consultant's rule of
 * thumb), not a black box.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ReorderSuggestion {
  product_id: string;
  name: string;
  stock_qty: number;
  reorder_level: number;
  daily_velocity: number;       // avg units/day over the window
  days_cover: number | null;    // how many days of stock remain at current velocity
  suggested_qty: number;        // rounded up, never negative
  preferred_supplier: string | null;
}

export async function reorderSuggestions(opts: { windowDays?: number; leadDays?: number; limit?: number } = {}): Promise<ReorderSuggestion[]> {
  const windowDays = opts.windowDays ?? 30;
  const leadDays = opts.leadDays ?? 7;
  const limit = opts.limit ?? 50;
  const branchId = getActiveBranchId();

  const rows = await query<{
    product_id: string; name: string; stock_qty: number; reorder_level: number;
    units_sold: number; preferred_supplier: string | null;
  }>(
    `SELECT p.id AS product_id, p.name, p.reorder_level,
            COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
            COALESCE((SELECT SUM(si.quantity) FROM sale_items si
                        JOIN sales s ON s.id = si.sale_id
                       WHERE si.product_id = p.id AND s.status = 'completed' AND s.branch_id = ?2
                         AND julianday('now') - julianday(s.created_at) < ?1), 0) AS units_sold,
            (SELECT sup.name FROM batches b2 JOIN suppliers sup ON sup.id = b2.supplier_id
              WHERE b2.product_id = p.id AND b2.supplier_id IS NOT NULL
              ORDER BY b2.received_at DESC LIMIT 1) AS preferred_supplier
       FROM products p
      WHERE p.active = 1 AND COALESCE(p.kind, 'physical') = 'physical'`,
    [windowDays, branchId],
  );

  const out: ReorderSuggestion[] = [];
  for (const r of rows) {
    const dailyVelocity = r.units_sold / windowDays;
    const target = dailyVelocity * (leadDays) + dailyVelocity * 1.5 + r.reorder_level;
    const suggested = Math.max(0, Math.ceil(target - r.stock_qty));
    // Only surface things worth acting on: below reorder OR <lead-time cover.
    const daysCover = dailyVelocity > 0 ? r.stock_qty / dailyVelocity : null;
    const worthIt = r.stock_qty <= r.reorder_level || (daysCover !== null && daysCover <= leadDays);
    if (!worthIt || suggested <= 0) continue;
    out.push({
      product_id: r.product_id,
      name: r.name,
      stock_qty: r.stock_qty,
      reorder_level: r.reorder_level,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      days_cover: daysCover === null ? null : Math.round(daysCover * 10) / 10,
      suggested_qty: suggested,
      preferred_supplier: r.preferred_supplier,
    });
  }
  // Most urgent first (fewest days of cover).
  out.sort((a, b) => (a.days_cover ?? 1e9) - (b.days_cover ?? 1e9));
  return out.slice(0, limit);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Dead stock — capital tied up in things that don't sell. Value at cost.
 * ──────────────────────────────────────────────────────────────────────── */

export interface DeadStockItem {
  product_id: string;
  name: string;
  stock_qty: number;
  value_at_cost: number;
  days_since_last_sale: number | null;   // null = never sold
}

export async function deadStock(opts: { idleDays?: number; limit?: number } = {}): Promise<{ items: DeadStockItem[]; total_value: number }> {
  const idleDays = opts.idleDays ?? 60;
  const limit = opts.limit ?? 50;

  const rows = await query<{
    product_id: string; name: string; stock_qty: number; value_at_cost: number; last_sale: string | null;
  }>(
    `SELECT p.id AS product_id, p.name,
            COALESCE(SUM(b.quantity), 0) AS stock_qty,
            COALESCE(SUM(b.quantity * b.buying_price), 0) AS value_at_cost,
            (SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
              WHERE si.product_id = p.id AND s.status = 'completed') AS last_sale
       FROM batches b
       JOIN products p ON p.id = b.product_id
      WHERE p.active = 1 AND b.quantity > 0
      GROUP BY p.id, p.name
     HAVING stock_qty > 0`,
  );

  const items: DeadStockItem[] = [];
  let totalValue = 0;
  const now = Date.now();
  for (const r of rows) {
    const daysSince = r.last_sale ? Math.floor((now - new Date(r.last_sale).getTime()) / 86400000) : null;
    // Dead = never sold, or last sold beyond the idle threshold.
    if (daysSince !== null && daysSince < idleDays) continue;
    items.push({
      product_id: r.product_id,
      name: r.name,
      stock_qty: r.stock_qty,
      value_at_cost: Math.round(r.value_at_cost * 100) / 100,
      days_since_last_sale: daysSince,
    });
    totalValue += r.value_at_cost;
  }
  // Highest tied-up capital first.
  items.sort((a, b) => b.value_at_cost - a.value_at_cost);
  return { items: items.slice(0, limit), total_value: Math.round(totalValue * 100) / 100 };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Margin health — negative margins (selling below cost) + outliers.
 * ──────────────────────────────────────────────────────────────────────── */

export interface MarginIssue {
  product_id: string;
  name: string;
  buying_price: number;
  selling_price: number;
  margin_pct: number | null;   // null when no selling price set
  issue: "negative" | "zero_margin" | "no_price" | "thin";
}

export async function marginIssues(opts: { thinPct?: number; limit?: number } = {}): Promise<MarginIssue[]> {
  const thinPct = opts.thinPct ?? 5;
  const limit = opts.limit ?? 100;
  const rows = await query<{ product_id: string; name: string; buying_price: number; selling_price: number }>(
    `SELECT p.id AS product_id, p.name,
            COALESCE(pp.buying_price, 0) AS buying_price,
            COALESCE(pp.selling_price, 0) AS selling_price
       FROM products p
       LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
      WHERE p.active = 1 AND COALESCE(p.kind, 'physical') = 'physical'`,
  );
  const out: MarginIssue[] = [];
  for (const r of rows) {
    if (r.selling_price <= 0) {
      out.push({ ...r, margin_pct: null, issue: "no_price" });
      continue;
    }
    if (r.buying_price <= 0) continue; // can't assess margin without cost
    const marginPct = ((r.selling_price - r.buying_price) / r.selling_price) * 100;
    let issue: MarginIssue["issue"] | null = null;
    if (r.selling_price < r.buying_price) issue = "negative";
    else if (marginPct === 0) issue = "zero_margin";
    else if (marginPct < thinPct) issue = "thin";
    if (!issue) continue;
    out.push({ ...r, margin_pct: Math.round(marginPct * 10) / 10, issue });
  }
  // Worst first: negative, then thinnest.
  const rank = { negative: 0, zero_margin: 1, thin: 2, no_price: 3 };
  out.sort((a, b) => rank[a.issue] - rank[b.issue] || (a.margin_pct ?? 0) - (b.margin_pct ?? 0));
  return out.slice(0, limit);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Profit leaders — what actually made money over a window.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ProfitLeader {
  product_id: string;
  name: string;
  qty_sold: number;
  revenue: number;
  profit: number;
  margin_pct: number;
}

export async function profitLeaders(opts: { windowDays?: number; limit?: number } = {}): Promise<ProfitLeader[]> {
  const windowDays = opts.windowDays ?? 30;
  const limit = opts.limit ?? 10;
  const branchId = getActiveBranchId();
  const rows = await query<{ product_id: string; name: string; qty_sold: number; revenue: number; profit: number }>(
    `SELECT si.product_id, si.product_name AS name,
            COALESCE(SUM(si.quantity), 0) AS qty_sold,
            COALESCE(SUM(si.total), 0) AS revenue,
            COALESCE(SUM(si.total - ${cogsExpr("si")} * si.quantity), 0) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND s.branch_id = ?2
        AND julianday('now') - julianday(s.created_at) < ?1
      GROUP BY si.product_id, si.product_name
      ORDER BY profit DESC
      LIMIT ?3`,
    [windowDays, branchId, limit],
  );
  return rows.map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * 100) / 100,
    profit: Math.round(r.profit * 100) / 100,
    margin_pct: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * Revenue change explainer — period over period, with the products that
 * drove the delta. This is the deterministic backbone of "why did revenue
 * fall?" — the LLM only turns these facts into a sentence.
 * ──────────────────────────────────────────────────────────────────────── */

export interface RevenueChange {
  window_days: number;
  current_revenue: number;
  previous_revenue: number;
  delta: number;
  delta_pct: number | null;
  top_gainers: Array<{ name: string; delta: number }>;
  top_losers: Array<{ name: string; delta: number }>;
}

export async function revenueChange(opts: { windowDays?: number } = {}): Promise<RevenueChange> {
  const windowDays = opts.windowDays ?? 7;
  const branchId = getActiveBranchId();

  const periodRevenue = async (fromDaysAgo: number, toDaysAgo: number) => {
    const [r] = await query<{ revenue: number }>(
      `SELECT COALESCE(SUM(total), 0) AS revenue FROM sales
        WHERE status = 'completed' AND branch_id = ?3
          AND julianday('now') - julianday(created_at) >= ?1
          AND julianday('now') - julianday(created_at) < ?2`,
      [toDaysAgo, fromDaysAgo, branchId],
    );
    return r?.revenue ?? 0;
  };
  const current = await periodRevenue(0, windowDays);
  const previous = await periodRevenue(windowDays, windowDays * 2);

  // Per-product delta between the two windows.
  const productDeltas = await query<{ name: string; cur: number; prev: number }>(
    `SELECT si.product_name AS name,
            COALESCE(SUM(CASE WHEN julianday('now') - julianday(s.created_at) < ?1 THEN si.total ELSE 0 END), 0) AS cur,
            COALESCE(SUM(CASE WHEN julianday('now') - julianday(s.created_at) >= ?1
                               AND julianday('now') - julianday(s.created_at) < ?2 THEN si.total ELSE 0 END), 0) AS prev
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND s.branch_id = ?3
        AND julianday('now') - julianday(s.created_at) < ?2
      GROUP BY si.product_name`,
    [windowDays, windowDays * 2, branchId],
  );
  const deltas = productDeltas
    .map((d) => ({ name: d.name, delta: Math.round((d.cur - d.prev) * 100) / 100 }))
    .filter((d) => d.delta !== 0);
  const gainers = [...deltas].sort((a, b) => b.delta - a.delta).slice(0, 5).filter((d) => d.delta > 0);
  const losers = [...deltas].sort((a, b) => a.delta - b.delta).slice(0, 5).filter((d) => d.delta < 0);

  const delta = Math.round((current - previous) * 100) / 100;
  return {
    window_days: windowDays,
    current_revenue: Math.round(current * 100) / 100,
    previous_revenue: Math.round(previous * 100) / 100,
    delta,
    delta_pct: previous > 0 ? Math.round((delta / previous) * 1000) / 10 : null,
    top_gainers: gainers,
    top_losers: losers,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Cashier performance — who sold what over a window (mistake/over-discount
 * surfacing comes later; this is the base ranking).
 * ──────────────────────────────────────────────────────────────────────── */

export interface CashierPerformance {
  user_id: string;
  name: string;
  sales_count: number;
  revenue: number;
  voids: number;
  avg_basket: number;
}

export async function cashierPerformance(opts: { windowDays?: number } = {}): Promise<CashierPerformance[]> {
  const windowDays = opts.windowDays ?? 30;
  const branchId = getActiveBranchId();
  const rows = await query<{ user_id: string; name: string; sales_count: number; revenue: number; voids: number }>(
    `SELECT s.user_id,
            COALESCE(u.full_name, u.username, 'Unknown') AS name,
            COUNT(CASE WHEN s.status = 'completed' THEN 1 END) AS sales_count,
            COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) AS revenue,
            COUNT(CASE WHEN s.status = 'voided' THEN 1 END) AS voids
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.branch_id = ?2 AND julianday('now') - julianday(s.created_at) < ?1
      GROUP BY s.user_id, name
      ORDER BY revenue DESC`,
    [windowDays, branchId],
  );
  return rows.map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * 100) / 100,
    avg_basket: r.sales_count > 0 ? Math.round((r.revenue / r.sales_count) * 100) / 100 : 0,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * Customer churn / RFM — who's slipping away, who's a VIP.
 *
 * Recency = days since last purchase; Frequency = #orders in window;
 * Monetary = total spent in window. Churn risk is a simple, explainable
 * bucketing on recency vs the customer's own cadence.
 * ──────────────────────────────────────────────────────────────────────── */

export interface CustomerInsight {
  customer_id: string;
  name: string;
  orders: number;
  total_spent: number;
  last_purchase: string | null;
  days_since_last: number | null;
  segment: "vip" | "loyal" | "at_risk" | "churned" | "new" | "occasional";
}

export async function customerInsights(opts: { windowDays?: number; limit?: number } = {}): Promise<CustomerInsight[]> {
  const windowDays = opts.windowDays ?? 180;
  const limit = opts.limit ?? 200;
  const rows = await query<{
    customer_id: string; name: string; orders: number; total_spent: number; last_purchase: string | null; first_purchase: string | null;
  }>(
    `SELECT c.id AS customer_id, c.name,
            COUNT(s.id) AS orders,
            COALESCE(SUM(s.total), 0) AS total_spent,
            MAX(s.created_at) AS last_purchase,
            MIN(s.created_at) AS first_purchase
       FROM customers c
       JOIN sales s ON s.customer_id = c.id AND s.status = 'completed'
      WHERE c.active = 1
        AND julianday('now') - julianday(s.created_at) < ?1
      GROUP BY c.id, c.name
      LIMIT ?2`,
    [windowDays, limit],
  );
  const now = Date.now();
  const spends = rows.map((r) => r.total_spent).sort((a, b) => b - a);
  const vipThreshold = spends.length > 0 ? spends[Math.floor(spends.length * 0.1)] ?? 0 : 0; // top 10% spend
  const out: CustomerInsight[] = rows.map((r) => {
    const daysSince = r.last_purchase ? Math.floor((now - new Date(r.last_purchase).getTime()) / 86400000) : null;
    const daysKnown = r.first_purchase ? Math.floor((now - new Date(r.first_purchase).getTime()) / 86400000) : null;
    let segment: CustomerInsight["segment"] = "occasional";
    if (daysKnown !== null && daysKnown <= 30 && r.orders <= 2) segment = "new";
    else if (r.total_spent >= vipThreshold && vipThreshold > 0 && r.orders >= 3) segment = "vip";
    else if (daysSince !== null && daysSince > 90) segment = "churned";
    else if (daysSince !== null && daysSince > 45) segment = "at_risk";
    else if (r.orders >= 5) segment = "loyal";
    return {
      customer_id: r.customer_id,
      name: r.name,
      orders: r.orders,
      total_spent: Math.round(r.total_spent * 100) / 100,
      last_purchase: r.last_purchase,
      days_since_last: daysSince,
      segment,
    };
  });
  // At-risk and churned (with real value) first — those are the actionable ones.
  const order = { at_risk: 0, churned: 1, vip: 2, loyal: 3, occasional: 4, new: 5 };
  out.sort((a, b) => order[a.segment] - order[b.segment] || b.total_spent - a.total_spent);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier scorecard — fill rate, on-time %, spend, price trend.
 * ──────────────────────────────────────────────────────────────────────── */

export interface SupplierScore {
  supplier_id: string;
  name: string;
  orders: number;
  total_spent: number;
  on_time_pct: number | null;     // received on/before expected_date
  fill_rate_pct: number | null;   // received_quantity / quantity
}

export async function supplierScorecard(opts: { windowDays?: number; limit?: number } = {}): Promise<SupplierScore[]> {
  const windowDays = opts.windowDays ?? 365;
  const limit = opts.limit ?? 50;
  const rows = await query<{
    supplier_id: string; name: string; orders: number; total_spent: number;
    on_time: number; received_count: number; ordered_qty: number; received_qty: number;
  }>(
    `SELECT po.supplier_id, sup.name,
            COUNT(DISTINCT po.id) AS orders,
            COALESCE(SUM(po.total), 0) AS total_spent,
            SUM(CASE WHEN po.status = 'received' AND po.expected_date IS NOT NULL
                      AND date(po.updated_at) <= date(po.expected_date) THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN po.status = 'received' THEN 1 ELSE 0 END) AS received_count,
            COALESCE(SUM((SELECT SUM(poi.quantity) FROM purchase_order_items poi WHERE poi.po_id = po.id)), 0) AS ordered_qty,
            COALESCE(SUM((SELECT SUM(poi.received_quantity) FROM purchase_order_items poi WHERE poi.po_id = po.id)), 0) AS received_qty
       FROM purchase_orders po
       JOIN suppliers sup ON sup.id = po.supplier_id
      WHERE julianday('now') - julianday(po.created_at) < ?1
      GROUP BY po.supplier_id, sup.name
      ORDER BY total_spent DESC
      LIMIT ?2`,
    [windowDays, limit],
  );
  return rows.map((r) => ({
    supplier_id: r.supplier_id,
    name: r.name,
    orders: r.orders,
    total_spent: Math.round(r.total_spent * 100) / 100,
    on_time_pct: r.received_count > 0 ? Math.round((r.on_time / r.received_count) * 1000) / 10 : null,
    fill_rate_pct: r.ordered_qty > 0 ? Math.round((r.received_qty / r.ordered_qty) * 1000) / 10 : null,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * Duplicate product detection — normalised-name collisions + shared barcode.
 * Deterministic: groups products whose names normalise to the same key.
 * ──────────────────────────────────────────────────────────────────────── */

export interface DuplicateGroup {
  key: string;
  reason: "same_barcode" | "same_normalised_name";
  products: Array<{ id: string; name: string; sku: string | null; barcode: string | null; stock_qty: number }>;
}

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export async function duplicateProducts(opts: { limit?: number } = {}): Promise<DuplicateGroup[]> {
  const limit = opts.limit ?? 50;
  const rows = await query<{ id: string; name: string; sku: string | null; barcode: string | null; stock_qty: number }>(
    `SELECT p.id, p.name, p.sku, p.barcode,
            COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty
       FROM products p WHERE p.active = 1`,
  );
  const byBarcode = new Map<string, typeof rows>();
  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.barcode && r.barcode.trim()) {
      const k = r.barcode.trim();
      (byBarcode.get(k) ?? byBarcode.set(k, []).get(k)!).push(r);
    }
    const nk = normaliseName(r.name);
    if (nk) (byName.get(nk) ?? byName.set(nk, []).get(nk)!).push(r);
  }
  const groups: DuplicateGroup[] = [];
  for (const [k, items] of byBarcode) if (items.length > 1) groups.push({ key: k, reason: "same_barcode", products: items });
  for (const [k, items] of byName) {
    if (items.length > 1) {
      // Skip if already captured as a barcode dup group (same id set).
      const ids = new Set(items.map((i) => i.id));
      const already = groups.some((g) => g.products.length === ids.size && g.products.every((p) => ids.has(p.id)));
      if (!already) groups.push({ key: k, reason: "same_normalised_name", products: items });
    }
  }
  return groups.slice(0, limit);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Expiry risk — batches expiring soon, value at risk. (Pharmacy + grocery.)
 * ──────────────────────────────────────────────────────────────────────── */

export interface ExpiryRisk {
  product_id: string;
  name: string;
  batch_number: string | null;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
  value_at_cost: number;
}

export async function expiryRisk(opts: { withinDays?: number; limit?: number } = {}): Promise<{ items: ExpiryRisk[]; total_value: number }> {
  const withinDays = opts.withinDays ?? 90;
  const limit = opts.limit ?? 100;
  const branchId = getActiveBranchId();
  const rows = await query<{
    product_id: string; name: string; batch_number: string | null; quantity: number; expiry_date: string; buying_price: number;
  }>(
    `SELECT b.product_id, p.name, b.batch_number, b.quantity, b.expiry_date, b.buying_price
       FROM batches b JOIN products p ON p.id = b.product_id
      WHERE b.quantity > 0 AND b.expiry_date IS NOT NULL
        AND (b.branch_id = ?2 OR b.branch_id IS NULL)
        AND julianday(b.expiry_date) - julianday('now') <= ?1
      ORDER BY b.expiry_date ASC
      LIMIT ?3`,
    [withinDays, branchId, limit],
  );
  const now = Date.now();
  let total = 0;
  const items = rows.map((r) => {
    const value = r.quantity * r.buying_price;
    total += value;
    return {
      product_id: r.product_id,
      name: r.name,
      batch_number: r.batch_number,
      quantity: r.quantity,
      expiry_date: r.expiry_date,
      days_to_expiry: Math.floor((new Date(r.expiry_date).getTime() - now) / 86400000),
      value_at_cost: Math.round(value * 100) / 100,
    };
  });
  return { items, total_value: Math.round(total * 100) / 100 };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Top findings — the proactive "what should I look at today?" digest. Cheap,
 * bounded, offline. Powers the dashboard card + the assistant's "what should
 * I focus on" answer. Each finding carries enough for the LLM to expand.
 * ──────────────────────────────────────────────────────────────────────── */

export interface Finding {
  kind: "reorder" | "dead_stock" | "expiry" | "margin" | "revenue" | "churn";
  severity: "info" | "warning" | "critical";
  headline: string;          // already human-readable, no LLM needed
  detail: string;
  route?: string;            // where to act
  metric?: number;
}

export async function topFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  const [reorder, dead, expiry, margins, rev] = await Promise.all([
    reorderSuggestions({ limit: 5 }),
    deadStock({ limit: 5 }),
    expiryRisk({ withinDays: 30, limit: 5 }),
    marginIssues({ limit: 5 }),
    revenueChange({ windowDays: 7 }),
  ]);

  // Most urgent reorder (lowest days cover).
  const urgent = reorder.find((r) => r.days_cover !== null && r.days_cover <= 5);
  if (urgent) {
    findings.push({
      kind: "reorder",
      severity: urgent.days_cover !== null && urgent.days_cover <= 2 ? "critical" : "warning",
      headline: `${urgent.name} runs out in ~${urgent.days_cover} days`,
      detail: `Selling ~${urgent.daily_velocity}/day with ${urgent.stock_qty} left. Suggested order: ${urgent.suggested_qty}${urgent.preferred_supplier ? ` from ${urgent.preferred_supplier}` : ""}.`,
      route: "/purchase-orders",
      metric: urgent.suggested_qty,
    });
  }

  if (expiry.items.length > 0 && expiry.total_value > 0) {
    findings.push({
      kind: "expiry",
      severity: "warning",
      headline: `${expiry.items.length} batch${expiry.items.length === 1 ? "" : "es"} expiring within 30 days`,
      detail: `KES ${expiry.total_value.toLocaleString()} of stock at risk. Earliest: ${expiry.items[0].name} in ${expiry.items[0].days_to_expiry} days.`,
      route: "/pharmacy/expiry",
      metric: expiry.total_value,
    });
  }

  if (dead.total_value > 0) {
    findings.push({
      kind: "dead_stock",
      severity: "info",
      headline: `${dead.items.length} dead-stock item${dead.items.length === 1 ? "" : "s"} worth KES ${dead.total_value.toLocaleString()}`,
      detail: `Capital tied up in stock that hasn't sold in 60+ days. Biggest: ${dead.items[0]?.name}.`,
      route: "/inventory",
      metric: dead.total_value,
    });
  }

  const negative = margins.filter((m) => m.issue === "negative");
  if (negative.length > 0) {
    findings.push({
      kind: "margin",
      severity: "critical",
      headline: `${negative.length} product${negative.length === 1 ? "" : "s"} priced below cost`,
      detail: `Each sale loses money. First: ${negative[0].name} (buy ${negative[0].buying_price}, sell ${negative[0].selling_price}).`,
      route: "/inventory",
      metric: negative.length,
    });
  }

  if (rev.delta_pct !== null && rev.delta_pct <= -15) {
    findings.push({
      kind: "revenue",
      severity: "warning",
      headline: `Revenue down ${Math.abs(rev.delta_pct)}% vs the previous ${rev.window_days} days`,
      detail: rev.top_losers.length > 0
        ? `Biggest drop: ${rev.top_losers[0].name} (KES ${Math.abs(rev.top_losers[0].delta).toLocaleString()}).`
        : `KES ${Math.abs(rev.delta).toLocaleString()} less than the prior period.`,
      route: "/reports",
      metric: rev.delta_pct,
    });
  }

  // Critical first, then warning, then info.
  const sev = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => sev[a.severity] - sev[b.severity]);
  return findings;
}
