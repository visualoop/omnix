/**
 * PDF engine — shared low-level PDF helpers used by every PDF service.
 *
 * Goals:
 *   - Every PDF service exposes a single `render(input)` function that
 *     returns a `Uint8Array`. No DB calls, no `pdf.save()` side effects.
 *     Side-effecting wrappers (downloadX, previewX) live separately and
 *     call render() then dispatch to the browser/Tauri.
 *   - Tabular reports (P&L, Aged receivables, Day book, Top products,
 *     Inventory reorder list, etc.) all share `renderTabularReport()`
 *     so layout is identical across the app.
 *   - Branded chrome (masthead + footer) lives in this file once. A
 *     business-info loader (DB → BrandHeader) lives in `pdf-brand.ts`.
 */
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export const PAGE_WIDTH_MM = 210 // A4
export const PAGE_HEIGHT_MM = 297
export const MARGIN_MM = 15

export interface BrandHeader {
  /** Trading name as shown on receipts + the masthead. */
  businessName: string
  address?: string | null
  phone?: string | null
  email?: string | null
  /** KRA PIN, used in Kenyan compliance docs (eTIMS, VAT3). */
  kraPin?: string | null
  /** Optional dataURL or file path for the logo. Not currently embedded. */
  logoPath?: string | null
  /** Optional full website URL printed in the footer. */
  website?: string | null
}

/**
 * Draws an editorial masthead: brand name in serif at the top left,
 * contact block at the top right, hairline rule below, then the
 * document title + optional subtitle. Returns the Y-cursor below the
 * masthead so callers know where to start their content.
 */
export function drawMasthead(pdf: jsPDF, brand: BrandHeader, title: string, subtitle?: string): number {
  // Optional logo — embedded top-left if a dataURL was provided in the
  // brand header. The business-profile page uploads the logo as a
  // data-URL string, so it's already base64 and ready to drop in.
  let textOffsetX = MARGIN_MM
  if (brand.logoPath && brand.logoPath.startsWith("data:image")) {
    try {
      const format = brand.logoPath.startsWith("data:image/png") ? "PNG"
        : brand.logoPath.startsWith("data:image/jpeg") ? "JPEG"
        : brand.logoPath.startsWith("data:image/jpg") ? "JPEG"
        : "PNG";
      pdf.addImage(brand.logoPath, format, MARGIN_MM, MARGIN_MM, 14, 14, undefined, "FAST");
      textOffsetX = MARGIN_MM + 18;
    } catch {
      // Logo failed to decode — fall back to text-only masthead
    }
  }

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(20)
  pdf.text(brand.businessName, textOffsetX, MARGIN_MM + 6)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.setTextColor(120)
  let contactY = MARGIN_MM + 4
  const right = PAGE_WIDTH_MM - MARGIN_MM
  for (const line of [
    brand.address,
    brand.phone,
    brand.email,
    brand.kraPin ? `KRA PIN: ${brand.kraPin}` : null,
  ].filter(Boolean) as string[]) {
    pdf.text(line, right, contactY, { align: "right" })
    contactY += 4
  }

  pdf.setTextColor(0)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN_MM, MARGIN_MM + 14, right, MARGIN_MM + 14)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text(title, MARGIN_MM, MARGIN_MM + 22)
  if (subtitle) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.setTextColor(120)
    pdf.text(subtitle, MARGIN_MM, MARGIN_MM + 28)
    pdf.setTextColor(0)
    return MARGIN_MM + 34
  }
  return MARGIN_MM + 28
}

/**
 * Footer with website + page numbers. Call inside autoTable's
 * didDrawPage callback so it lands on every page.
 */
export function drawFooter(pdf: jsPDF, brand: BrandHeader, pageNo: number, totalPages: number) {
  const y = PAGE_HEIGHT_MM - 12
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN_MM, y, PAGE_WIDTH_MM - MARGIN_MM, y)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.text(brand.website ?? brand.businessName, MARGIN_MM, y + 5)
  pdf.text(`Page ${pageNo} / ${totalPages}`, PAGE_WIDTH_MM - MARGIN_MM, y + 5, { align: "right" })
  pdf.setTextColor(0)
}

/**
 * Convert a jsPDF document into a Uint8Array. jsPDF's "arraybuffer"
 * output gives us an ArrayBuffer; we coerce so callers always see
 * the same byte-stream type regardless of jsPDF version.
 */
export function toBytes(pdf: jsPDF): Uint8Array {
  const buf = pdf.output("arraybuffer") as ArrayBuffer
  return new Uint8Array(buf)
}

/** Fresh portrait A4 jsPDF document. */
export function newDoc(): jsPDF {
  return new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true })
}

/** Fresh landscape A4 — for wide tables (P&L, day book, aged reports). */
export function newDocLandscape(): jsPDF {
  return new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true })
}

/** Format a money number for in-PDF display (no currency symbol — caller decides). */
export function fmtAmount(n: number): string {
  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

/** Format a date for column display (e.g. "12 Jun 2026"). */
export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Tabular report helper ────────────────────────────────────────

export interface TabularColumn {
  label: string
  /** Optional explicit width in mm. Auto if omitted. */
  width?: number
  /** Cell alignment (default left). */
  align?: "left" | "right" | "center"
  /** True = render value formatted as money (right-aligned, monospaced). */
  money?: boolean
}

export interface TabularReportInput {
  brand: BrandHeader
  title: string
  subtitle?: string
  columns: TabularColumn[]
  /** Each row is an array of cell values. Numbers in money columns are formatted. */
  rows: Array<Array<string | number | null | undefined>>
  /** Optional totals row drawn under the table with bold styling. */
  totals?: Array<string | number | null | undefined>
  /** Page orientation. Default portrait. */
  orientation?: "portrait" | "landscape"
  /** Optional summary block above the table (label : value pairs). */
  summary?: Array<{ label: string; value: string }>
  /** Optional notes block under the table. */
  notes?: string
}

/**
 * Render a tabular report into PDF bytes. Used by every list-shaped
 * report — P&L, day book, top products, dead stock, aged receivables,
 * VAT3, claims, etc.
 *
 * Design language: editorial. Hairline rules, mono numbers, generous
 * padding, branded masthead. No card chrome, no zebra rows, no shadows.
 */
export function renderTabularReport(input: TabularReportInput): Uint8Array {
  const pdf = input.orientation === "landscape" ? newDocLandscape() : newDoc()
  let cursorY = drawMasthead(pdf, input.brand, input.title, input.subtitle)

  // Optional summary block (e.g. "Period · 1 Jun – 30 Jun 2026")
  if (input.summary?.length) {
    cursorY += 2
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    for (const s of input.summary) {
      pdf.setTextColor(120)
      pdf.text(s.label, MARGIN_MM, cursorY)
      pdf.setTextColor(0)
      pdf.text(s.value, MARGIN_MM + 35, cursorY)
      cursorY += 4
    }
    cursorY += 3
  }

  const head = [input.columns.map((c) => c.label)]
  const body = input.rows.map((row) =>
    row.map((cell, i) => {
      if (cell == null) return ""
      const col = input.columns[i]
      if (col?.money && typeof cell === "number") return fmtAmount(cell)
      return String(cell)
    }),
  )

  const totalsRow = input.totals
    ? [
        input.totals.map((cell, i) => {
          if (cell == null) return ""
          const col = input.columns[i]
          if (col?.money && typeof cell === "number") return fmtAmount(cell)
          return String(cell)
        }),
      ]
    : undefined

  const columnStyles: Record<number, Record<string, unknown>> = {}
  input.columns.forEach((c, i) => {
    const styles: Record<string, unknown> = {}
    if (c.width) styles.cellWidth = c.width
    if (c.money || c.align === "right") {
      styles.halign = "right"
      styles.font = "courier"
    } else if (c.align === "center") {
      styles.halign = "center"
    }
    columnStyles[i] = styles
  })

  autoTable(pdf, {
    startY: cursorY,
    head,
    body,
    foot: totalsRow,
    theme: "plain",
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [120, 120, 120],
      fontStyle: "bold",
      fontSize: 8,
      lineWidth: 0,
      // Add a single solid bottom rule under the header
    },
    footStyles: {
      fillColor: [248, 248, 248],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles,
  })

  // Footer pass — re-stamp on every page after the table renders so we
  // know the final page count for the "Page N / total" line.
  const total = pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    drawFooter(pdf, input.brand, p, total)
  }

  // Optional notes under the last page
  if (input.notes) {
    pdf.setPage(total)
    const lastY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? PAGE_HEIGHT_MM - 30
    if (lastY < PAGE_HEIGHT_MM - 30) {
      pdf.setFont("helvetica", "italic")
      pdf.setFontSize(8)
      pdf.setTextColor(120)
      const lines = pdf.splitTextToSize(input.notes, PAGE_WIDTH_MM - 2 * MARGIN_MM)
      pdf.text(lines, MARGIN_MM, lastY + 6)
      pdf.setTextColor(0)
    }
  }

  return toBytes(pdf)
}
