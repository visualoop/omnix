import { query } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import QRCode from "qrcode";
import { intlLocale } from "@/lib/intl";

export interface ReceiptData {
  business: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
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
  kra?: {
    pin: string;
    invoice_no: string;
    internal_control_no: string;
  } | null;
  footer?: string;
  showPoweredBy?: boolean;
}

export interface BusinessRow {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export async function buildReceiptData(saleId: string): Promise<ReceiptData | null> {
  const { getBusinessProfile } = await import("@/services/business-profile");
  const business = await getBusinessProfile();
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

  const settingsRows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('receipt.footer', 'receipt.show_powered_by')`,
  );
  const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

  return {
    business: {
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
      logo: business.logoPath ?? null,
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
    footer: settingsMap["receipt.footer"] || "Thank you for shopping with us!",
    showPoweredBy: settingsMap["receipt.show_powered_by"] !== "0",
  };
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = await renderReceiptHTML(data);
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

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
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

async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 150,
      margin: 1,
      color: { dark: "#000", light: "#fff" },
    });
  } catch {
    return "";
  }
}

async function renderReceiptHTML(d: ReceiptData): Promise<string> {
  const date = new Date(d.sale.created_at).toLocaleString(intlLocale(), {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Country-aware money formatter + tax label.
  const { money } = await import("@/lib/money");
  const { taxLabel } = await import("@/lib/locale");
  const { useCountry } = await import("@/stores/country");
  const taxLabelStr = taxLabel(useCountry.getState().code);

  let kraSection = "";
  if (d.kra) {
    const qrText = `${d.kra.invoice_no} / ${d.kra.pin}`;
    const qrUrl = await generateQrDataUrl(qrText);
    kraSection = `
    <hr>
    <div class="center sm bold">KRA TAX INVOICE</div>
    <div class="center sm">CU Invoice: ${escapeHtml(d.kra.invoice_no)}</div>
    <div class="center sm muted" style="word-break:break-all;">CU: ${escapeHtml(d.kra.internal_control_no)}</div>
    ${qrUrl ? `<div class="center" style="margin:6px 0;"><img src="${qrUrl}" width="100" height="100" alt="QR" /></div>` : `<div class="qr-placeholder sm">QR Code<br><span class="muted">(scan to verify)</span></div>`}
  `;
  }

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
  ${d.business.logo ? `<div class="center" style="margin:0 0 6px 0;"><img src="${d.business.logo}" alt="Logo" style="max-height:48px;max-width:80%;object-fit:contain;" /></div>` : ""}
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
      ${d.tax > 0 ? `<tr><td class="label">${taxLabelStr}:</td><td class="value">${d.tax.toFixed(2)}</td></tr>` : ""}
      <tr class="bold lg"><td class="label">TOTAL:</td><td class="value">${money(d.total)}</td></tr>
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

  ${kraSection}

  <hr>

  <div class="center sm">${escapeHtml(d.footer || "Thank you for shopping with us!")}</div>
  ${d.showPoweredBy === false ? "" : `<div class="center sm muted" style="margin-top:4px;">${BRAND.receipt.poweredBy}</div>`}
</body>
</html>`;
}
