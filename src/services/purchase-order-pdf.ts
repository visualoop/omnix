/**
 * Purchase-order PDF — A4, business masthead, supplier block, line-item table
 * (qty / unit cost / line total) and totals. Reuses the shared pdf-engine so
 * it matches invoices/reports, and pdf-brand for the branded header.
 *
 * Returns raw bytes so ShareDocMenu can download / print / attach it.
 */
import autoTable from "jspdf-autotable";
import { newDoc, drawMasthead, drawFooter, toBytes, fmtAmount, fmtDate } from "@/services/pdf-engine";
import { loadBrandHeader } from "@/services/pdf-brand";
import type { PurchaseOrder, POItem } from "@/services/erp";

const MARGIN = 15;

export async function buildPurchaseOrderPdf(po: PurchaseOrder, items: POItem[]): Promise<Uint8Array> {
  const brand = await loadBrandHeader();
  const pdf = newDoc();
  let y = drawMasthead(pdf, brand, "Purchase Order", `${po.po_number}`);

  // Supplier + meta block
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Supplier", MARGIN, y);
  pdf.setFont("helvetica", "normal");
  const supplierLines = [
    po.supplier_name || "—",
    po.supplier_phone || "",
    po.supplier_email || "",
  ].filter(Boolean);
  supplierLines.forEach((line, i) => pdf.text(String(line), MARGIN, y + 5 + i * 4.5));

  const rightX = 195;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Order date: ${fmtDate(po.order_date || po.created_at)}`, rightX, y, { align: "right" });
  if (po.expected_date) pdf.text(`Expected: ${fmtDate(po.expected_date)}`, rightX, y + 4.5, { align: "right" });
  pdf.text(`Status: ${po.status}`, rightX, y + 9, { align: "right" });

  y += 5 + supplierLines.length * 4.5 + 6;

  // Line items
  autoTable(pdf, {
    startY: y,
    head: [["#", "Item", "Qty", "Unit cost", "Line total"]],
    body: items.map((it, idx) => [
      String(idx + 1),
      it.product_name,
      String(it.quantity),
      fmtAmount(it.unit_cost),
      fmtAmount(it.line_total),
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10, halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // Totals
  // @ts-expect-error autoTable augments the jsPDF instance with lastAutoTable
  let ty = (pdf.lastAutoTable?.finalY ?? y) + 8;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Subtotal", 150, ty, { align: "right" });
  pdf.text(fmtAmount(po.subtotal), rightX, ty, { align: "right" });
  if (po.tax_amount) {
    ty += 5;
    pdf.text("Tax", 150, ty, { align: "right" });
    pdf.text(fmtAmount(po.tax_amount), rightX, ty, { align: "right" });
  }
  ty += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Total", 150, ty, { align: "right" });
  pdf.text(fmtAmount(po.total), rightX, ty, { align: "right" });

  if (po.notes) {
    ty += 10;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text("Notes", MARGIN, ty);
    pdf.setFont("helvetica", "normal");
    const wrapped = pdf.splitTextToSize(po.notes, 180);
    pdf.text(wrapped, MARGIN, ty + 4.5);
  }

  drawFooter(pdf, brand, 1, 1);
  return toBytes(pdf);
}
