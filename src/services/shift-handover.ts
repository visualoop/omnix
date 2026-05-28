/**
 * Shift Handover
 *
 * Generates a printable shift summary at end of shift, formatted for an
 * 80mm thermal printer. Cashier signs it, hands to next cashier (or owner).
 * This is the audit trail when handing over a till.
 */
import { query } from "@/lib/db";
import { BRAND } from "@/lib/brand";

export interface ShiftHandover {
  shift_id: string;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_closing: number | null;
  actual_closing: number | null;
  difference: number | null;
  notes: string | null;

  sale_count: number;
  cash_sales: number;
  mpesa_sales: number;
  card_sales: number;
  other_sales: number;
  refunds: number;
  customer_collections: number;
  expenses: number;

  pharmacy_name: string;
  pharmacy_phone: string | null;
}

export async function getShiftHandover(shiftId: string): Promise<ShiftHandover | null> {
  const [shift] = await query<any>(
    `SELECT cr.*,
       COALESCE(u.full_name, u.username) AS cashier_name
     FROM cash_register cr
     LEFT JOIN users u ON u.id = cr.user_id
     WHERE cr.id = ?1`,
    [shiftId],
  );
  if (!shift) return null;

  const start = shift.opened_at;
  const end = shift.closed_at || new Date().toISOString();

  // Sales by method during shift
  const [salesByMethod] = await query<{
    sale_count: number; cash: number; mpesa: number; card: number; other: number;
  }>(
    `SELECT
       COUNT(DISTINCT s.id) AS sale_count,
       COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.name, p.method_name, '')) LIKE '%cash%' THEN p.amount ELSE 0 END), 0) AS cash,
       COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.name, p.method_name, '')) LIKE '%mpesa%' OR LOWER(COALESCE(pm.name, p.method_name, '')) LIKE '%m-pesa%' THEN p.amount ELSE 0 END), 0) AS mpesa,
       COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.name, p.method_name, '')) LIKE '%card%' THEN p.amount ELSE 0 END), 0) AS card,
       COALESCE(SUM(CASE WHEN LOWER(COALESCE(pm.name, p.method_name, '')) NOT LIKE '%cash%' AND LOWER(COALESCE(pm.name, p.method_name, '')) NOT LIKE '%mpesa%' AND LOWER(COALESCE(pm.name, p.method_name, '')) NOT LIKE '%m-pesa%' AND LOWER(COALESCE(pm.name, p.method_name, '')) NOT LIKE '%card%' THEN p.amount ELSE 0 END), 0) AS other
     FROM sales s
     JOIN payments p ON p.sale_id = s.id
     LEFT JOIN payment_methods pm ON pm.id = p.method_id
     WHERE s.user_id = ?1
       AND s.created_at BETWEEN ?2 AND ?3
       AND s.status = 'completed'`,
    [shift.user_id, start, end],
  );

  // Refunds during shift
  const [refunds] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS total
     FROM sale_returns
     WHERE user_id = ?1 AND created_at BETWEEN ?2 AND ?3`,
    [shift.user_id, start, end],
  );

  // Customer payments collected during shift
  const [collections] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM customer_payments
     WHERE user_id = ?1 AND paid_at BETWEEN ?2 AND ?3`,
    [shift.user_id, start, end],
  );

  // Expenses paid during shift
  const [expenses] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE recorded_by = ?1 AND created_at BETWEEN ?2 AND ?3`,
    [shift.user_id, start, end],
  );

  const [bizName] = await query<{ value: string }>(`SELECT value FROM settings WHERE key = 'business.name'`);
  const [bizPhone] = await query<{ value: string }>(`SELECT value FROM settings WHERE key = 'business.phone'`);

  return {
    shift_id: shift.id,
    cashier_name: shift.cashier_name,
    opened_at: shift.opened_at,
    closed_at: shift.closed_at,
    opening_balance: shift.opening_balance,
    expected_closing: shift.expected_closing,
    actual_closing: shift.actual_closing,
    difference: shift.difference,
    notes: shift.notes,
    sale_count: salesByMethod?.sale_count || 0,
    cash_sales: salesByMethod?.cash || 0,
    mpesa_sales: salesByMethod?.mpesa || 0,
    card_sales: salesByMethod?.card || 0,
    other_sales: salesByMethod?.other || 0,
    refunds: refunds?.total || 0,
    customer_collections: collections?.total || 0,
    expenses: expenses?.total || 0,
    pharmacy_name: bizName?.value || BRAND.name,
    pharmacy_phone: bizPhone?.value || null,
  };
}

export function renderShiftHandoverHtml(h: ShiftHandover): string {
  const fmt = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTime = (s: string | null) => s ? new Date(s).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

  const totalSales = h.cash_sales + h.mpesa_sales + h.card_sales + h.other_sales;
  const expected = h.opening_balance + h.cash_sales + h.customer_collections - h.refunds - h.expenses;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shift Handover</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; padding: 4mm; font-family: 'Courier New', monospace; font-size: 10pt; max-width: 76mm; color: #000; }
  h1 { font-size: 12pt; margin: 0 0 2mm; text-align: center; }
  .center { text-align: center; }
  .muted { color: #666; font-size: 9pt; }
  hr { border: 0; border-top: 1px dashed #999; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; padding: 0.5mm 0; }
  .total { font-weight: 700; border-top: 1px solid #000; padding-top: 1mm; margin-top: 1mm; }
  .section { font-weight: 700; margin-top: 3mm; text-transform: uppercase; font-size: 9.5pt; }
  .sig-box { border-top: 1px solid #000; margin-top: 4mm; padding-top: 1mm; font-size: 9pt; }
  @media print { .no-print { display: none; } }
</style></head><body>

  <h1>${escape(h.pharmacy_name)}</h1>
  ${h.pharmacy_phone ? `<div class="center muted">${escape(h.pharmacy_phone)}</div>` : ""}
  <div class="center" style="margin-top:1mm;font-weight:700;">SHIFT HANDOVER</div>
  <hr>

  <div class="row"><span>Cashier</span><span>${escape(h.cashier_name)}</span></div>
  <div class="row"><span>Opened</span><span>${fmtTime(h.opened_at)}</span></div>
  <div class="row"><span>Closed</span><span>${fmtTime(h.closed_at)}</span></div>
  <hr>

  <div class="section">Sales (${h.sale_count} txns)</div>
  <div class="row"><span>Cash</span><span>${fmt(h.cash_sales)}</span></div>
  <div class="row"><span>M-Pesa</span><span>${fmt(h.mpesa_sales)}</span></div>
  <div class="row"><span>Card</span><span>${fmt(h.card_sales)}</span></div>
  ${h.other_sales > 0 ? `<div class="row"><span>Other</span><span>${fmt(h.other_sales)}</span></div>` : ""}
  <div class="row total"><span>Total Sales</span><span>${fmt(totalSales)}</span></div>

  <div class="section">Cash Reconciliation</div>
  <div class="row"><span>Opening Float</span><span>${fmt(h.opening_balance)}</span></div>
  <div class="row"><span>+ Cash Sales</span><span>${fmt(h.cash_sales)}</span></div>
  <div class="row"><span>+ Customer Collections</span><span>${fmt(h.customer_collections)}</span></div>
  <div class="row"><span>- Refunds</span><span>-${fmt(h.refunds)}</span></div>
  <div class="row"><span>- Expenses</span><span>-${fmt(h.expenses)}</span></div>
  <div class="row total"><span>Expected in Drawer</span><span>${fmt(expected)}</span></div>

  ${h.actual_closing !== null ? `
    <div class="row"><span>Counted</span><span>${fmt(h.actual_closing)}</span></div>
    ${h.difference !== null && Math.abs(h.difference) > 0.01 ? `
      <div class="row" style="font-weight:700;color:${h.difference < 0 ? '#b91c1c' : '#15803d'};">
        <span>${h.difference < 0 ? "Shortage" : "Overage"}</span>
        <span>${fmt(Math.abs(h.difference))}</span>
      </div>
    ` : `<div class="row" style="color:#15803d;font-weight:700;"><span>Balanced</span><span>✓</span></div>`}
  ` : ""}

  ${h.notes ? `<div class="section">Notes</div><div style="font-size:9pt;font-style:italic;">${escape(h.notes)}</div>` : ""}

  <div class="sig-box">
    Outgoing cashier signature: ____________
  </div>
  <div class="sig-box">
    Incoming cashier / supervisor: ____________
  </div>

  <div style="height: 8mm;"></div>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

export async function printShiftHandover(shiftId: string): Promise<void> {
  const handover = await getShiftHandover(shiftId);
  if (!handover) throw new Error("Shift not found");
  const html = renderShiftHandoverHtml(handover);
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) throw new Error("Pop-up blocked. Allow pop-ups to print.");
  w.document.write(html);
  w.document.close();
}
