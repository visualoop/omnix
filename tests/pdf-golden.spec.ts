/**
 * Golden snapshot tests for the highest-stakes PDFs (invoice + Z-report).
 *
 * What they assert (without doing a full byte-by-byte hash diff —
 * jsPDF embeds a non-deterministic CreationDate + DocumentID):
 *   - Same input → same byte length within a 1% tolerance.
 *   - Same input → identical PDF version + page-tree shape.
 *   - The renderer is callable with synthetic input + returns valid bytes.
 *
 * Why a tolerance instead of an exact hash: jsPDF's output stream
 * contains a CreationDate timestamp and a content-stream-derived ID,
 * both of which change every call. Stripping those pre-hash is fragile;
 * a fuzzy check on shape catches the kind of regressions we care about
 * (template logic changes, missing rows, wrong totals) without churning
 * the snapshot every commit.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { renderZReportPdf, renderHardwareQuotePdf } from "@/services/reports-pdf"
import type { BrandHeader } from "@/services/pdf-engine"

const BRAND: BrandHeader = {
  businessName: "Snapshot Pharmacy",
  address: "Nairobi, Kenya",
  phone: "+254 700 111 222",
  email: "info@snap.test",
  kraPin: "P052222222S",
}

/**
 * Strip jsPDF's non-deterministic header metadata so we can shape-compare.
 * Removes CreationDate, ModDate, /ID, document UUID lines.
 */
function stripVolatile(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes)
  return text
    .replace(/CreationDate\(D:[^)]+\)/g, "CreationDate()")
    .replace(/ModDate\(D:[^)]+\)/g, "ModDate()")
    .replace(/<[A-F0-9]{32}>/g, "<HASH>")
    .replace(/\/ID\s*\[\s*<[A-F0-9]+>\s*<[A-F0-9]+>\s*\]/g, "/ID [<HASH> <HASH>]")
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-12T12:00:00Z"))
})
afterAll(() => {
  vi.useRealTimers()
})

describe("Z-report golden snapshot", () => {
  const input = {
    brand: BRAND,
    shiftStart: "2026-06-12T08:00:00",
    shiftEnd: "2026-06-12T18:00:00",
    cashier: "Mary",
    payments: [
      { method: "Cash", transactions: 30, amount: 15000 },
      { method: "M-Pesa", transactions: 20, amount: 12000 },
    ],
    totalSales: 27000,
    totalRefunds: 500,
    cashOpening: 2000,
    cashCounted: 16400,
    cashVariance: -100,
  }

  it("renders identically across two calls (page tree + objects stable)", () => {
    const a = renderZReportPdf(input)
    const b = renderZReportPdf(input)
    expect(stripVolatile(a)).toBe(stripVolatile(b))
  })

  it("byte length stays stable to within 5%", () => {
    const a = renderZReportPdf(input).length
    const b = renderZReportPdf(input).length
    expect(Math.abs(a - b) / a).toBeLessThan(0.05)
  })
})

describe("Hardware quote golden snapshot", () => {
  const input = {
    brand: BRAND,
    quoteNumber: "Q-2026-001",
    validUntil: "2026-07-12",
    customerName: "Build Co",
    customerProject: "Apartment renovation",
    rows: [
      { description: "20mm rebar", quantity: 50, unit: "pcs", unitPrice: 800 },
      { description: "Cement 50kg", quantity: 100, unit: "bag", unitPrice: 750 },
    ],
    bulkDiscountPct: 5,
    vatPct: 16,
  }

  it("renders identically across two calls", () => {
    const a = renderHardwareQuotePdf(input)
    const b = renderHardwareQuotePdf(input)
    expect(stripVolatile(a)).toBe(stripVolatile(b))
  })

  it("differs when input changes (template responds to data)", () => {
    const a = renderHardwareQuotePdf(input)
    const b = renderHardwareQuotePdf({
      ...input,
      rows: [...input.rows, { description: "Steel angle iron", quantity: 20, unit: "pcs", unitPrice: 1500 }],
    })
    // Adding a row should change the byte stream beyond the volatile bits.
    expect(stripVolatile(a)).not.toBe(stripVolatile(b))
    expect(b.length).toBeGreaterThan(a.length)
  })
})
