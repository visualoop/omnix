/**
 * Service job-card PDF — Equipment DMS Phase 2.
 *
 * A printable workshop job card: unit + warranty, reported fault + diagnosis,
 * parts + labour tables, totals, and technician / customer signature lines.
 * Rendered with the shared brand masthead and downloaded via downloadBytes
 * (jsPDF.save() is a silent no-op inside the Tauri WebView).
 */
import autoTable from "jspdf-autotable";
import { newDoc, drawMasthead, toBytes, fmtAmount, fmtDate, type BrandHeader } from "@/services/pdf-engine";
import { loadBrandHeader, downloadBytes } from "@/services/pdf-brand";
import type { ServiceJobDetail } from "@/services/service";

export function renderServiceJobCardBytes(detail: ServiceJobDetail, brand: BrandHeader): Uint8Array {
  const { job, parts, labour } = detail;
  const pdf = newDoc();
  let y = drawMasthead(pdf, brand, `Service Job ${job.job_number}`, job.is_warranty ? "Warranty repair — no charge" : "Service / repair job card");

  // Unit + meta block
  const metaLeft = [
    `Machine: ${job.product_name ?? ""}`,
    `Serial: ${job.serial_number ?? ""}`,
    job.meter_in != null ? `Meter in: ${job.meter_in}` : "",
    job.technician_name ? `Technician: ${job.technician_name}` : "",
  ].filter(Boolean);
  const metaRight = [
    `Opened: ${fmtDate(job.opened_at)}`,
    job.completed_at ? `Completed: ${fmtDate(job.completed_at)}` : "",
    job.customer_name ? `Customer: ${job.customer_name}` : "",
    `Status: ${job.status}`,
  ].filter(Boolean);

  pdf.setFontSize(9);
  pdf.setTextColor(60);
  let ly = y + 2;
  for (const l of metaLeft) { pdf.text(l, 14, ly); ly += 5; }
  let ry = y + 2;
  for (const r of metaRight) { pdf.text(r, 120, ry); ry += 5; }
  pdf.setTextColor(0);
  y = Math.max(ly, ry) + 4;

  // Fault + diagnosis
  const block = (label: string, text: string | null) => {
    if (!text) return;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.text(label, 14, y); y += 5;
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(60);
    const lines = pdf.splitTextToSize(text, 180);
    pdf.text(lines, 14, y); y += lines.length * 4.5 + 3;
    pdf.setTextColor(0);
  };
  block("Reported fault", job.reported_fault);
  block("Diagnosis / work done", job.diagnosis);

  // Parts table
  if (parts.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [["Part", "Qty", "Unit price", "Total"]],
      body: parts.map((p) => [p.product_name, String(p.quantity), fmtAmount(p.unit_price), fmtAmount(p.line_total)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error autotable augments the doc at runtime
    y = pdf.lastAutoTable.finalY + 4;
  }

  // Labour table
  if (labour.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [["Labour", "Hours", "Rate", "Total"]],
      body: labour.map((l) => [l.description, String(l.hours), fmtAmount(l.rate), fmtAmount(l.line_total)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error autotable augments the doc at runtime
    y = pdf.lastAutoTable.finalY + 4;
  }

  // Totals
  const total = job.parts_total + job.labour_total;
  pdf.setFontSize(9);
  pdf.text(`Parts: ${fmtAmount(job.parts_total)}`, 150, y, { align: "right" }); y += 5;
  pdf.text(`Labour: ${fmtAmount(job.labour_total)}`, 150, y, { align: "right" }); y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text(job.is_warranty ? "Total (warranty — not charged): 0.00" : `Total: ${fmtAmount(total)}`, 150, y, { align: "right" });
  pdf.setFont("helvetica", "normal");
  y += 16;

  // Signatures
  pdf.setLineWidth(0.2);
  pdf.line(14, y, 80, y);
  pdf.line(120, y, 186, y);
  y += 5;
  pdf.setFontSize(8); pdf.setTextColor(120);
  pdf.text("Technician signature", 14, y);
  pdf.text("Customer signature", 120, y);
  pdf.setTextColor(0);

  return toBytes(pdf);
}

export async function renderServiceJobCard(detail: ServiceJobDetail): Promise<void> {
  const brand = await loadBrandHeader();
  const bytes = renderServiceJobCardBytes(detail, brand);
  downloadBytes(bytes, `job-card-${detail.job.job_number}.pdf`);
}
