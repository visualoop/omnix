/**
 * PDF generation for invoices and quotations using jsPDF + autoTable.
 *
 * Output: A4 native PDF with selectable text, search, copy.
 * Includes: company header, customer block, line items table with totals,
 * payment history (invoices), terms & notes.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { query } from "@/lib/db";
import type { Invoice, Quotation, DocumentItem } from "@/services/invoicing";

const PAGE_WIDTH = 210;  // A4 mm
const MARGIN = 15;

interface BusinessInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  kra_pin: string | null;
  logo_path: string | null;
}

async function getBusinessInfo(): Promise<BusinessInfo> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('business.name','business.address','business.phone','business.email','business.kra_pin','business.logo_path')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: map["business.name"] || "Your Business",
    address: map["business.address"] || null,
    phone: map["business.phone"] || null,
    email: map["business.email"] || null,
    kra_pin: map["business.kra_pin"] || null,
    logo_path: map["business.logo_path"] || null,
  };
}

const fmtCurrency = (n: number) =>
  "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

interface DocumentForPdf {
  type: "invoice" | "quotation";
  number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_tax_pin?: string | null;
  issue_date: string;
  due_or_valid: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid?: number;
  notes: string | null;
  terms: string | null;
}

function fromInvoice(inv: Invoice): DocumentForPdf {
  return {
    type: "invoice",
    number: inv.invoice_number,
    customer_name: inv.customer_name,
    customer_phone: inv.customer_phone,
    customer_email: inv.customer_email,
    customer_address: inv.customer_address,
    customer_tax_pin: inv.customer_tax_pin,
    issue_date: inv.issue_date,
    due_or_valid: inv.due_date,
    status: inv.status,
    subtotal: inv.subtotal,
    discount_amount: inv.discount_amount,
    tax_amount: inv.tax_amount,
    total: inv.total,
    amount_paid: inv.amount_paid,
    notes: inv.notes,
    terms: inv.terms,
  };
}

function fromQuotation(q: Quotation): DocumentForPdf {
  return {
    type: "quotation",
    number: q.quotation_number,
    customer_name: q.customer_name,
    customer_phone: q.customer_phone,
    customer_email: q.customer_email,
    customer_address: q.customer_address,
    issue_date: q.issue_date,
    due_or_valid: q.valid_until,
    status: q.status,
    subtotal: q.subtotal,
    discount_amount: q.discount_amount,
    tax_amount: q.tax_amount,
    total: q.total,
    notes: q.notes,
    terms: q.terms,
  };
}

interface PdfPayment {
  amount: number;
  payment_method: string;
  reference: string | null;
  payment_date: string;
}

async function buildDocumentPdf(
  doc: DocumentForPdf,
  items: DocumentItem[],
  payments?: PdfPayment[],
): Promise<jsPDF> {
  const business = await getBusinessInfo();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  let y = MARGIN;

  // ─── Header: Business + Document title ───
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(business.name, MARGIN, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  let businessY = y + 11;
  if (business.address) {
    pdf.text(business.address, MARGIN, businessY);
    businessY += 4;
  }
  if (business.phone) {
    pdf.text(`Tel: ${business.phone}`, MARGIN, businessY);
    businessY += 4;
  }
  if (business.email) {
    pdf.text(business.email, MARGIN, businessY);
    businessY += 4;
  }
  if (business.kra_pin) {
    pdf.text(`PIN: ${business.kra_pin}`, MARGIN, businessY);
    businessY += 4;
  }

  // Document title (right side)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  const docLabel = doc.type === "invoice" ? "INVOICE" : "QUOTATION";
  const labelWidth = pdf.getTextWidth(docLabel);
  pdf.text(docLabel, PAGE_WIDTH - MARGIN - labelWidth, y + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const numWidth = pdf.getTextWidth(doc.number);
  pdf.text(doc.number, PAGE_WIDTH - MARGIN - numWidth, y + 12);

  // Issue date / due date
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  let metaY = y + 19;
  const issueLabel = "Issue Date:";
  pdf.text(issueLabel, PAGE_WIDTH - MARGIN - 50, metaY);
  pdf.setTextColor(0);
  pdf.text(fmtDate(doc.issue_date), PAGE_WIDTH - MARGIN, metaY, { align: "right" });
  metaY += 4;
  pdf.setTextColor(100);
  pdf.text(doc.type === "invoice" ? "Due Date:" : "Valid Until:", PAGE_WIDTH - MARGIN - 50, metaY);
  pdf.setTextColor(0);
  pdf.text(fmtDate(doc.due_or_valid), PAGE_WIDTH - MARGIN, metaY, { align: "right" });

  y = Math.max(businessY, metaY) + 6;

  // ─── Status banner ───
  if (doc.status !== "draft" && doc.status !== "sent") {
    const statusColors: Record<string, [number, number, number]> = {
      paid: [16, 185, 129],
      partial: [245, 158, 11],
      overdue: [220, 38, 38],
      accepted: [16, 185, 129],
      declined: [220, 38, 38],
      expired: [107, 114, 128],
      converted: [124, 58, 237],
      cancelled: [107, 114, 128],
    };
    const color = statusColors[doc.status] || [107, 114, 128];
    pdf.setFillColor(...color);
    pdf.setTextColor(255);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    const labelText = doc.status.toUpperCase();
    const w = pdf.getTextWidth(labelText) + 6;
    pdf.roundedRect(MARGIN, y, w, 6, 1, 1, "F");
    pdf.text(labelText, MARGIN + 3, y + 4.2);
    pdf.setTextColor(0);
    y += 10;
  }

  // ─── Bill To ───
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(doc.type === "invoice" ? "BILL TO" : "QUOTATION FOR", MARGIN, y);
  y += 4;
  pdf.setTextColor(0);
  pdf.setFontSize(11);
  pdf.text(doc.customer_name, MARGIN, y);
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (doc.customer_address) {
    const addrLines = pdf.splitTextToSize(doc.customer_address, 80);
    pdf.text(addrLines, MARGIN, y);
    y += addrLines.length * 4;
  }
  if (doc.customer_phone) { pdf.text(doc.customer_phone, MARGIN, y); y += 4; }
  if (doc.customer_email) { pdf.text(doc.customer_email, MARGIN, y); y += 4; }
  if (doc.customer_tax_pin) {
    pdf.setFont("helvetica", "bold");
    pdf.text(`KRA PIN: ${doc.customer_tax_pin}`, MARGIN, y);
    pdf.setFont("helvetica", "normal");
    y += 4;
  }
  y += 4;

  // ─── Line items table ───
  autoTable(pdf, {
    startY: y,
    head: [["#", "Description", "Qty", "Unit", "Rate", "Tax %", "Amount"]],
    body: items.map((it, idx) => [
      String(idx + 1),
      it.description,
      it.quantity.toString(),
      it.unit,
      it.unit_price.toFixed(2),
      it.tax_rate ? `${it.tax_rate}%` : "—",
      it.line_total.toFixed(2),
    ]),
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 50,
      fontSize: 8,
      fontStyle: "bold",
      lineWidth: { bottom: 0.5 },
      lineColor: [50, 50, 50],
    },
    columnStyles: {
      0: { halign: "right", cellWidth: 8, textColor: 100 },
      1: { cellWidth: "auto" },
      2: { halign: "right", cellWidth: 14 },
      3: { cellWidth: 14, textColor: 100 },
      4: { halign: "right", cellWidth: 22, font: "courier" },
      5: { halign: "right", cellWidth: 14 },
      6: { halign: "right", cellWidth: 28, font: "courier", fontStyle: "bold" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (pdf as any).lastAutoTable.finalY + 6;

  // ─── Totals box (right-aligned) ───
  const totalsX = PAGE_WIDTH - MARGIN - 60;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text("Subtotal", totalsX, y);
  pdf.setTextColor(0);
  pdf.setFont("courier", "normal");
  pdf.text(doc.subtotal.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 5;

  if (doc.tax_amount > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    pdf.text("Tax", totalsX, y);
    pdf.setTextColor(0);
    pdf.setFont("courier", "normal");
    pdf.text(doc.tax_amount.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }

  if (doc.discount_amount > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    pdf.text("Discount", totalsX, y);
    pdf.setTextColor(0);
    pdf.setFont("courier", "normal");
    pdf.text(`-${doc.discount_amount.toFixed(2)}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }

  // Total - bold, larger, with line above
  pdf.setDrawColor(50);
  pdf.setLineWidth(0.4);
  pdf.line(totalsX, y, PAGE_WIDTH - MARGIN, y);
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("TOTAL", totalsX, y);
  pdf.setFont("courier", "bold");
  pdf.text(fmtCurrency(doc.total), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 6;

  if (doc.type === "invoice" && doc.amount_paid && doc.amount_paid > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(16, 185, 129);
    pdf.text("Paid", totalsX, y);
    pdf.setFont("courier", "normal");
    pdf.text(doc.amount_paid.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
    pdf.setTextColor(0);
    pdf.setFont("helvetica", "bold");
    pdf.text("Balance Due", totalsX, y);
    pdf.setFont("courier", "bold");
    pdf.text(fmtCurrency(doc.total - doc.amount_paid), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 6;
  }

  y += 4;

  // ─── Payments (invoices only) ───
  if (payments && payments.length > 0) {
    if (y > 240) { pdf.addPage(); y = MARGIN; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0);
    pdf.text("Payment History", MARGIN, y);
    y += 4;
    autoTable(pdf, {
      startY: y,
      head: [["Date", "Method", "Reference", "Amount"]],
      body: payments.map((p) => [
        fmtDate(p.payment_date),
        p.payment_method,
        p.reference || "—",
        p.amount.toFixed(2),
      ]),
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [245, 245, 245], textColor: 80, fontSize: 7 },
      columnStyles: { 3: { halign: "right", font: "courier" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
  }

  // ─── Notes & terms ───
  if (doc.notes || doc.terms) {
    if (y > 240) { pdf.addPage(); y = MARGIN; }
    if (doc.notes) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text("NOTES", MARGIN, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(50);
      const notesLines = pdf.splitTextToSize(doc.notes, PAGE_WIDTH - 2 * MARGIN);
      pdf.text(notesLines, MARGIN, y);
      y += notesLines.length * 4 + 4;
    }
    if (doc.terms) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text("TERMS & CONDITIONS", MARGIN, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(80);
      const termsLines = pdf.splitTextToSize(doc.terms, PAGE_WIDTH - 2 * MARGIN);
      pdf.text(termsLines, MARGIN, y);
      y += termsLines.length * 3.5;
    }
  }

  // ─── Footer ───
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(
      `Generated ${new Date().toLocaleString("en-KE")}  ·  Page ${i} of ${pageCount}`,
      PAGE_WIDTH / 2,
      290,
      { align: "center" },
    );
  }

  return pdf;
}

// ─── Public API ─────────────────────────────────────────────────────
export async function generateInvoicePdf(
  invoice: Invoice,
  items: DocumentItem[],
  payments?: PdfPayment[],
): Promise<jsPDF> {
  return buildDocumentPdf(fromInvoice(invoice), items, payments);
}

export async function generateQuotationPdf(
  quotation: Quotation,
  items: DocumentItem[],
): Promise<jsPDF> {
  return buildDocumentPdf(fromQuotation(quotation), items);
}

export async function downloadInvoicePdf(invoice: Invoice, items: DocumentItem[], payments?: PdfPayment[]) {
  const pdf = await generateInvoicePdf(invoice, items, payments);
  pdf.save(`${invoice.invoice_number}.pdf`);
}

export async function downloadQuotationPdf(quotation: Quotation, items: DocumentItem[]) {
  const pdf = await generateQuotationPdf(quotation, items);
  pdf.save(`${quotation.quotation_number}.pdf`);
}

/** Open in new tab for preview (Tauri webview shows native PDF viewer). */
export async function previewInvoicePdf(invoice: Invoice, items: DocumentItem[], payments?: PdfPayment[]) {
  const pdf = await generateInvoicePdf(invoice, items, payments);
  pdf.output("dataurlnewwindow");
}

export async function previewQuotationPdf(quotation: Quotation, items: DocumentItem[]) {
  const pdf = await generateQuotationPdf(quotation, items);
  pdf.output("dataurlnewwindow");
}
