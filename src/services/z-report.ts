/**
 * Z-Report (End-of-Day Shift Summary)
 *
 * In retail, the "Z-report" is the end-of-day printout the cashier runs
 * to close their till: total sales by payment method, total tax, refunds,
 * cash in/out, opening/closing balance. Resets daily counters.
 *
 * SokoOS doesn't reset counters (sales never disappear), but we generate
 * the same summary view of what happened in a date window.
 */
import { query } from "@/lib/db";
import { BRAND } from "@/lib/brand";

export interface ZReport {
  date_from: string;
  date_to: string;
  generated_at: string;

  // Sales totals
  sale_count: number;
  gross_sales: number;          // sum of all sale totals
  tax_total: number;
  discount_total: number;
  net_sales: number;            // gross - returns

  // Payment breakdown
  by_method: Array<{ method: string; count: number; total: number }>;

  // Returns
  return_count: number;
  return_total: number;

  // Other money movement
  expenses_total: number;
  customer_payments_total: number;
  supplier_payments_total: number;

  // Cash position (today)
  cash_in: number;              // cash sales + customer cash payments
  cash_out: number;             // cash expenses + supplier cash payments + cash refunds
  cash_net: number;

  // Top products
  top_products: Array<{ product_name: string; qty: number; revenue: number }>;

  // Pharmacy specific
  prescription_count: number;
  controlled_dispensed: number;

  // User activity
  by_user: Array<{ user_name: string; sale_count: number; total: number }>;

  pharmacy_name: string;
  pharmacy_phone: string | null;
}

export async function getZReport(date?: string): Promise<ZReport> {
  const day = date || new Date().toISOString().slice(0, 10);
  const from = `${day} 00:00:00`;
  const to = `${day} 23:59:59`;

  // Sales aggregates
  const [salesAgg] = await query<{
    count: number; gross: number; tax: number; discount: number;
  }>(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(total), 0) AS gross,
            COALESCE(SUM(tax_amount), 0) AS tax,
            COALESCE(SUM(discount_amount), 0) AS discount
     FROM sales
     WHERE created_at BETWEEN ?1 AND ?2 AND status = 'completed'`,
    [from, to],
  );

  // Payment method breakdown (from payments table)
  const byMethod = await query<{ method: string; count: number; total: number }>(
    `SELECT
       COALESCE(pm.name, sp.method_name, 'Other') AS method,
       COUNT(DISTINCT sp.sale_id) AS count,
       COALESCE(SUM(sp.amount), 0) AS total
     FROM payments sp
     LEFT JOIN payment_methods pm ON pm.id = sp.method_id
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status = 'completed'
     GROUP BY method
     ORDER BY total DESC`,
    [from, to],
  );

  // Returns
  const [retAgg] = await query<{ count: number; total: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(refund_amount), 0) AS total
     FROM sale_returns WHERE created_at BETWEEN ?1 AND ?2`,
    [from, to],
  );

  // Cash refunds (subset of returns paid in cash)
  const [cashRefAgg] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS total
     FROM sale_returns WHERE created_at BETWEEN ?1 AND ?2 AND refund_method = 'cash'`,
    [from, to],
  );

  // Expenses today
  const [expAgg] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses WHERE expense_date BETWEEN ?1 AND ?2`,
    [from, to],
  );

  // Cash expenses
  const [cashExpAgg] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses WHERE expense_date BETWEEN ?1 AND ?2 AND payment_method = 'cash'`,
    [from, to],
  );

  // Customer payments (settled in)
  const [custPayAgg] = await query<{ total: number; cash_total: number }>(
    `SELECT
       COALESCE(SUM(amount), 0) AS total,
       COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) AS cash_total
     FROM customer_payments WHERE paid_at BETWEEN ?1 AND ?2`,
    [from, to],
  );

  // Supplier payments (out)
  const [suppPayAgg] = await query<{ total: number; cash_total: number }>(
    `SELECT
       COALESCE(SUM(amount), 0) AS total,
       COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) AS cash_total
     FROM supplier_payments WHERE paid_at BETWEEN ?1 AND ?2`,
    [from, to],
  );

  // Cash from sales
  const [cashSalesAgg] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(sp.amount), 0) AS total
     FROM payments sp
     LEFT JOIN payment_methods pm ON pm.id = sp.method_id
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.created_at BETWEEN ?1 AND ?2
       AND s.status = 'completed'
       AND (pm.type = 'cash' OR sp.method_name = 'cash' OR LOWER(COALESCE(pm.name, sp.method_name, '')) LIKE '%cash%')`,
    [from, to],
  );

  // Top products
  const topProducts = await query<{ product_name: string; qty: number; revenue: number }>(
    `SELECT si.product_name,
            SUM(si.quantity) AS qty,
            SUM(si.unit_price * si.quantity) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status = 'completed'
     GROUP BY si.product_id, si.product_name
     ORDER BY qty DESC
     LIMIT 5`,
    [from, to],
  );

  // Prescriptions / controlled
  const [rxAgg] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM prescriptions
     WHERE created_at BETWEEN ?1 AND ?2 AND status = 'dispensed'`,
    [from, to],
  );
  const [ctrlAgg] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM controlled_log
     WHERE created_at BETWEEN ?1 AND ?2 AND action = 'dispensed'`,
    [from, to],
  );

  // By user
  const byUser = await query<{ user_name: string; sale_count: number; total: number }>(
    `SELECT COALESCE(u.full_name, u.username, 'Unknown') AS user_name,
            COUNT(*) AS sale_count,
            COALESCE(SUM(s.total), 0) AS total
     FROM sales s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status = 'completed'
     GROUP BY u.id
     ORDER BY total DESC`,
    [from, to],
  );

  // Pharmacy info
  const [bizName] = await query<{ value: string }>(
    `SELECT value FROM business_settings WHERE key = 'business.name'`,
  );
  const [bizPhone] = await query<{ value: string }>(
    `SELECT value FROM business_settings WHERE key = 'business.phone'`,
  );

  const cashIn = (cashSalesAgg?.total || 0) + (custPayAgg?.cash_total || 0);
  const cashOut = (cashExpAgg?.total || 0) + (suppPayAgg?.cash_total || 0) + (cashRefAgg?.total || 0);

  return {
    date_from: from,
    date_to: to,
    generated_at: new Date().toISOString(),
    sale_count: salesAgg?.count || 0,
    gross_sales: salesAgg?.gross || 0,
    tax_total: salesAgg?.tax || 0,
    discount_total: salesAgg?.discount || 0,
    net_sales: (salesAgg?.gross || 0) - (retAgg?.total || 0),
    by_method: byMethod,
    return_count: retAgg?.count || 0,
    return_total: retAgg?.total || 0,
    expenses_total: expAgg?.total || 0,
    customer_payments_total: custPayAgg?.total || 0,
    supplier_payments_total: suppPayAgg?.total || 0,
    cash_in: cashIn,
    cash_out: cashOut,
    cash_net: cashIn - cashOut,
    top_products: topProducts,
    prescription_count: rxAgg?.count || 0,
    controlled_dispensed: ctrlAgg?.count || 0,
    by_user: byUser,
    pharmacy_name: bizName?.value || BRAND.name,
    pharmacy_phone: bizPhone?.value || null,
  };
}

export function renderZReportHtml(r: ZReport): string {
  const fmt = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (s: string) => new Date(s).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = (s: string) => new Date(s).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Z-Report</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 4mm; font-family: 'Courier New', monospace; font-size: 10pt; max-width: 76mm; color: #000; }
  h1 { font-size: 12pt; margin: 0 0 2mm; text-align: center; }
  .center { text-align: center; }
  .right { text-align: right; }
  .muted { color: #666; font-size: 9pt; }
  hr { border: 0; border-top: 1px dashed #999; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; padding: 0.5mm 0; }
  .row .lbl { color: #333; }
  .total { font-weight: 700; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  table { width: 100%; font-size: 9pt; border-collapse: collapse; }
  th, td { padding: 0.5mm; text-align: left; }
  th { border-bottom: 1px solid #000; }
  .section { font-weight: 700; margin-top: 3mm; text-transform: uppercase; font-size: 9.5pt; }
  @media print { .no-print { display: none; } }
</style></head><body>

  <h1>${escape(r.pharmacy_name)}</h1>
  ${r.pharmacy_phone ? `<div class="center muted">${escape(r.pharmacy_phone)}</div>` : ""}
  <div class="center" style="margin-top:1mm;font-weight:700;">Z-REPORT — END OF DAY</div>
  <div class="center muted">${dateOnly(r.date_from)}</div>
  <div class="center muted">Generated ${fmtDate(r.generated_at)}</div>
  <hr>

  <div class="section">Sales Summary</div>
  <div class="row"><span class="lbl">Sales count</span><span>${r.sale_count}</span></div>
  <div class="row"><span class="lbl">Gross sales</span><span>${fmt(r.gross_sales)}</span></div>
  <div class="row"><span class="lbl">Discounts</span><span>-${fmt(r.discount_total)}</span></div>
  <div class="row"><span class="lbl">Tax (VAT)</span><span>${fmt(r.tax_total)}</span></div>
  <div class="row"><span class="lbl">Returns (${r.return_count})</span><span>-${fmt(r.return_total)}</span></div>
  <div class="row total"><span>Net sales</span><span>${fmt(r.net_sales)}</span></div>

  ${r.by_method.length > 0 ? `
  <div class="section">Payment Methods</div>
  ${r.by_method.map((m) => `
    <div class="row"><span class="lbl">${escape(m.method)} (${m.count})</span><span>${fmt(m.total)}</span></div>
  `).join("")}
  ` : ""}

  <div class="section">Cash Movement</div>
  <div class="row"><span class="lbl">Cash in (sales + collections)</span><span>${fmt(r.cash_in)}</span></div>
  <div class="row"><span class="lbl">Cash out (expenses + paid)</span><span>${fmt(r.cash_out)}</span></div>
  <div class="row total"><span>Net cash</span><span>${fmt(r.cash_net)}</span></div>

  <div class="section">Other</div>
  <div class="row"><span class="lbl">Customer payments collected</span><span>${fmt(r.customer_payments_total)}</span></div>
  <div class="row"><span class="lbl">Supplier payments made</span><span>${fmt(r.supplier_payments_total)}</span></div>
  <div class="row"><span class="lbl">Expenses</span><span>${fmt(r.expenses_total)}</span></div>

  ${r.prescription_count > 0 ? `
  <div class="section">Pharmacy</div>
  <div class="row"><span class="lbl">Prescriptions dispensed</span><span>${r.prescription_count}</span></div>
  ${r.controlled_dispensed > 0 ? `<div class="row"><span class="lbl">Controlled dispensed</span><span>${r.controlled_dispensed}</span></div>` : ""}
  ` : ""}

  ${r.top_products.length > 0 ? `
  <div class="section">Top Products</div>
  <table>
    <tr><th>Item</th><th class="right">Qty</th><th class="right">Sales</th></tr>
    ${r.top_products.map((p) => `
      <tr><td>${escape(truncate(p.product_name, 18))}</td><td class="right">${p.qty}</td><td class="right">${fmt(p.revenue)}</td></tr>
    `).join("")}
  </table>
  ` : ""}

  ${r.by_user.length > 1 ? `
  <div class="section">By Cashier</div>
  ${r.by_user.map((u) => `
    <div class="row"><span class="lbl">${escape(u.user_name)} (${u.sale_count})</span><span>${fmt(u.total)}</span></div>
  `).join("")}
  ` : ""}

  <hr>
  <div class="center muted">— End of report —</div>
  <div class="center muted">Cashier signature: ____________</div>
  <div style="height: 8mm;"></div>

  <script>window.onload = () => { window.print(); };</script>
</body></html>`;
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export async function printZReport(date?: string): Promise<void> {
  const r = await getZReport(date);
  const html = renderZReportHtml(r);
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) throw new Error("Pop-up blocked. Allow pop-ups to print.");
  w.document.write(html);
  w.document.close();
}
