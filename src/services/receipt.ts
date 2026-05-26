/**
 * Receipt printing via window.print().
 *
 * Strategy: render the receipt HTML in a hidden iframe and trigger print.
 * Works with both A4 printers and 80mm thermal printers (driver handles the size).
 * The receipt CSS uses 80mm width by default which is centered on A4 if needed.
 */

import { query } from "@/lib/db";
import { BRAND } from "@/lib/brand";

export interface ReceiptData {
  business: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  sale: {
    sale_number: number | string;
    created_at: string;
    cashier_name: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Array<{ method_name: string; amount: number; reference?: string | null }>;
  customer?: { name: string; phone?: string | null } | null;
  // KRA eTIMS (optional)
  kra?: {
    pin: string;
    invoice_no: string;
    internal_control_no: string;
    qr_url?: string;
  } | null;
}

export interface BusinessRow {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

/** Fetch the data needed to build a receipt for a given sale. */
export async function buildReceiptData(saleId: string): Promise<ReceiptData | null> {
  const businesses = await query<BusinessRow>("SELECT name, address, phone, email FROM business LIMIT 1");
  const business = businesses[0];
  if (!business) return null;

  const sales = await query<{
    sale_number: number;
    created_at: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total: number;
    cashier_name: string;
    customer_name: string | null;
    customer_phone: string | null;
  }>(
    `SELECT s.sale_number, s.created_at, s.subtotal, s.discount_amount, s.tax_amount, s.total,
            u.full_name as cashier_name,
            c.name as customer_name, c.phone as customer_phone
     FROM sales s
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = ?1`,
    [saleId]
  );
  const sale = sales[0];
  if (!sale) return null;

  const items = await query<{ name: string; quantity: number; unit_price: number; total: number }>(
    "SELECT product_name as name, quantity, unit_price, total FROM sale_items WHERE sale_id = ?1",
    [saleId]
  );

  const payments = await query<{ method_name: string; amount: number; reference: string | null }>(
    "SELECT method_name, amount, reference FROM payments WHERE sale_id = ?1",
    [saleId]
  );

  // Try to get KRA signing info if available
  const kraRows = await query<{
    seller_pin: string;
    kra_invoice_no: string | null;
    kra_internal_control_no: string | null;
  }>(
    `SELECT seller_pin, kra_invoice_no, kra_internal_control_no
     FROM etims_invoices WHERE sale_id = ?1 AND status = 'signed'`,
    [saleId]
  );
  const kra = kraRows[0]?.kra_invoice_no ? {
    pin: kraRows[0].seller_pin,
    invoice_no: kraRows[0].kra_invoice_no!,
    internal_control_no: kraRows[0].kra_internal_control_no!,
  } : null;

  return {
    business: {
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
    },
    sale: {
      sale_number: sale.sale_number,
      created_at: sale.created_at,
      cashier_name: sale.cashier_name || "—",
    },
    items,
    subtotal: sale.subtotal,
    discount: sale.discount_amount,
    tax: sale.tax_amount,
    total: sale.total,
    payments,
    customer: sale.customer_name ? { name: sale.customer_name, phone: sale.customer_phone } : null,
    kra,
  };
}

/** Render the receipt as HTML, then call window.print(). */
export function printReceipt(data: ReceiptData): void {
  const html = renderReceiptHTML(data);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait a tick for fonts/layout, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove after a delay (printing is async)
      setTimeout(() => iframe.remove(), 2000);
    }, 100);
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReceiptHTML(d: ReceiptData): string {
  const date = new Date(d.sale.created_at).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #${d.sale.sale_number}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 4mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
    padding: 0;
    color: #000;
    width: 72mm;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .lg { font-size: 14px; }
  .sm { font-size: 10px; }
  .muted { color: #555; }
  hr {
    border: none;
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .row .right { text-align: right; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
  }
  td { padding: 1px 0; vertical-align: top; }
  .item-name { width: 60%; }
  .item-qty { width: 12%; text-align: right; }
  .item-total { width: 28%; text-align: right; }
  .totals td { padding: 2px 0; }
  .totals .label { text-align: right; padding-right: 8px; }
  .totals .value { text-align: right; min-width: 60px; }
  .qr-placeholder {
    border: 1px dashed #000;
    padding: 12px;
    text-align: center;
    margin: 6px 0;
    font-size: 9px;
  }
  @media print {
    body { width: 72mm; }
  }
</style>
</head>
<body>
  <div class="center bold lg">${escapeHtml(d.business.name)}</div>
  ${d.business.address ? `<div class="center sm">${escapeHtml(d.business.address)}</div>` : ""}
  ${d.business.phone ? `<div class="center sm">Tel: ${escapeHtml(d.business.phone)}</div>` : ""}
  ${d.business.email ? `<div class="center sm">${escapeHtml(d.business.email)}</div>` : ""}
  ${d.kra ? `<div class="center sm">KRA PIN: ${escapeHtml(d.kra.pin)}</div>` : ""}

  <hr>

  <div class="row sm">
    <span>Receipt #${d.sale.sale_number}</span>
    <span>${date}</span>
  </div>
  <div class="sm muted">Cashier: ${escapeHtml(d.sale.cashier_name)}</div>
  ${d.customer ? `<div class="sm">Customer: ${escapeHtml(d.customer.name)}${d.customer.phone ? " (" + escapeHtml(d.customer.phone) + ")" : ""}</div>` : ""}

  <hr>

  <table>
    <tbody>
      ${d.items.map((it) => `
      <tr>
        <td class="item-name">${escapeHtml(it.name)}</td>
        <td class="item-qty">${it.quantity}</td>
        <td class="item-total">${it.total.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" class="sm muted" style="padding-bottom:2px;">
          &nbsp;&nbsp;${it.quantity} × ${it.unit_price.toFixed(2)}
        </td>
      </tr>
      `).join("")}
    </tbody>
  </table>

  <hr>

  <table class="totals">
    <tbody>
      <tr><td class="label">Subtotal:</td><td class="value">${d.subtotal.toFixed(2)}</td></tr>
      ${d.discount > 0 ? `<tr><td class="label">Discount:</td><td class="value">-${d.discount.toFixed(2)}</td></tr>` : ""}
      ${d.tax > 0 ? `<tr><td class="label">VAT (16%):</td><td class="value">${d.tax.toFixed(2)}</td></tr>` : ""}
      <tr class="bold lg"><td class="label">TOTAL:</td><td class="value">KES ${d.total.toFixed(2)}</td></tr>
    </tbody>
  </table>

  <hr>

  <div class="sm bold">Payment</div>
  ${d.payments.map((p) => `
    <div class="row sm">
      <span>${escapeHtml(p.method_name)}${p.reference ? " (" + escapeHtml(p.reference) + ")" : ""}</span>
      <span>${p.amount.toFixed(2)}</span>
    </div>
  `).join("")}

  ${d.kra ? `
    <hr>
    <div class="center sm bold">KRA TAX INVOICE</div>
    <div class="center sm">CU Invoice: ${escapeHtml(d.kra.invoice_no)}</div>
    <div class="center sm muted" style="word-break:break-all;">CU: ${escapeHtml(d.kra.internal_control_no)}</div>
    <div class="qr-placeholder sm">QR Code<br><span class="muted">(scan to verify)</span></div>
  ` : ""}

  <hr>

  <div class="center sm">Thank you for shopping with us!</div>
  <div class="center sm muted" style="margin-top:4px;">${BRAND.receipt.poweredBy}</div>

  <script>
    // Print automatically when loaded inline
  </script>
</body>
</html>`;
}
