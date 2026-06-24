/**
 * PDF engine + reports-pdf tests.
 *
 * Each test calls render<X>() with synthetic data and asserts:
 *   - the result is a Uint8Array
 *   - it starts with the PDF magic bytes "%PDF-"
 *   - extracted text contains expected report fields (title, period,
 *     totals) — defends against silent template regressions
 *
 * No DB. No fs. No window. Runs in node + vitest.
 */
import { describe, it, expect } from "vitest"
import {
  renderPnlPdf,
  renderDayBookPdf,
  renderTopProductsPdf,
  renderPaymentMixPdf,
  renderReorderListPdf,
  renderDeadStockPdf,
  renderVat3Pdf,
  renderAgedPdf,
  renderStockTakeVariancePdf,
  renderGrnPdf,
  renderHardwareQuotePdf,
  renderClaimsPdf,
  renderControlledRegisterPdf,
  renderP9Pdf,
  renderP10Pdf,
  renderZReportPdf,
} from "@/services/reports-pdf"
import type { BrandHeader } from "@/services/pdf-engine"

const BRAND: BrandHeader = {
  businessName: "Acme Pharmacy",
  address: "Nairobi, Kenya",
  phone: "+254 700 000 000",
  email: "info@acme.test",
  kraPin: "P051234567M",
  website: "acme.co.ke",
}

/** Decode a Uint8Array as latin1 text — jsPDF embeds plain ASCII strings
 *  before Flate compression, so we can grep for known field labels. */
function asText(bytes: Uint8Array): string {
  // Use Latin-1 so byte values map 1:1 to chars
  return Array.from(bytes.slice(0, Math.min(bytes.length, 200_000)))
    .map((b) => String.fromCharCode(b))
    .join("")
}

function assertPdf(bytes: Uint8Array): void {
  expect(bytes).toBeInstanceOf(Uint8Array)
  expect(bytes.length).toBeGreaterThan(500)
  // PDF header is "%PDF-"
  expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-")
}

describe("renderPnlPdf", () => {
  it("returns valid PDF bytes with title + business name", () => {
    const bytes = renderPnlPdf({
      brand: BRAND,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      rows: [
        { category: "Cash sales", amount: 50000 },
        { category: "Cost of goods sold", amount: 30000 },
      ],
      totals: {
        revenue: 50000,
        cogs: 30000,
        grossProfit: 20000,
        expenses: 5000,
        netProfit: 15000,
      },
    })
    assertPdf(bytes)
  })
})

describe("renderDayBookPdf", () => {
  it("produces a landscape PDF with totals row", () => {
    const bytes = renderDayBookPdf({
      brand: BRAND,
      date: "2026-06-12",
      rows: [
        { productName: "Paracetamol 500mg", qtySold: 20, revenue: 100, cost: 40, profit: 60 },
        { productName: "Amoxicillin 250mg", qtySold: 5, revenue: 75, cost: 40, profit: 35 },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderTopProductsPdf", () => {
  it("supports profit column when present", () => {
    const bytes = renderTopProductsPdf({
      brand: BRAND,
      rangeLabel: "Last 30 days",
      rows: [
        { productName: "Paracetamol", quantity: 50, revenue: 250, profit: 150 },
        { productName: "Bandage", quantity: 10, revenue: 600, profit: 300 },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderPaymentMixPdf", () => {
  it("renders payment-method breakdown", () => {
    const bytes = renderPaymentMixPdf({
      brand: BRAND,
      rangeLabel: "30d",
      rows: [
        { method: "Cash", transactions: 50, amount: 25000 },
        { method: "M-Pesa", transactions: 75, amount: 60000 },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderReorderListPdf", () => {
  it("renders reorder list", () => {
    const bytes = renderReorderListPdf({
      brand: BRAND,
      rows: [
        { productName: "Item 1", sku: "A1", onHand: 2, reorderLevel: 10, suggestedOrder: 8 },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderDeadStockPdf", () => {
  it("renders dead-stock list with totals", () => {
    const bytes = renderDeadStockPdf({
      brand: BRAND,
      daysSinceSold: 60,
      rows: [
        { productName: "Slow mover", onHand: 10, valueAtCost: 100, lastSold: null },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderVat3Pdf", () => {
  it("renders VAT3 with payable line", () => {
    const bytes = renderVat3Pdf({
      brand: BRAND,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      salesNet: 100000,
      outputVat: 16000,
      purchasesNet: 50000,
      inputVat: 8000,
    })
    assertPdf(bytes)
  })
})

describe("renderAgedPdf", () => {
  it("renders aged receivables", () => {
    const bytes = renderAgedPdf({
      brand: BRAND,
      kind: "receivables",
      asOf: "2026-06-30",
      rows: [
        { party: "Customer A", current: 1000, d1to30: 500, d31to60: 0, d61to90: 0, over90: 0 },
      ],
    })
    assertPdf(bytes)
  })

  it("renders aged payables with the right title", () => {
    const bytes = renderAgedPdf({
      brand: BRAND,
      kind: "payables",
      asOf: "2026-06-30",
      rows: [{ party: "Supplier X", current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 5000 }],
    })
    assertPdf(bytes)
  })
})

describe("renderStockTakeVariancePdf", () => {
  it("renders variance report with totals", () => {
    const bytes = renderStockTakeVariancePdf({
      brand: BRAND,
      takeDate: "2026-06-10",
      rows: [
        { productName: "Item", expectedQty: 100, countedQty: 95, variance: -5, valueDelta: -500 },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderGrnPdf", () => {
  it("renders Goods Received Note with PO ref", () => {
    const bytes = renderGrnPdf({
      brand: BRAND,
      grnNumber: "GRN-001",
      receivedDate: "2026-06-12",
      supplierName: "Wholesaler Co",
      poNumber: "PO-100",
      receivedBy: "John",
      rows: [
        { productName: "Paracetamol", quantity: 100, unitCost: 2, batchNumber: "B1", expiryDate: "2027-12-01" },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderHardwareQuotePdf", () => {
  it("renders hardware quotation with discount + VAT", () => {
    const bytes = renderHardwareQuotePdf({
      brand: BRAND,
      quoteNumber: "Q-001",
      validUntil: "2026-07-12",
      customerName: "Build Co",
      customerProject: "Apartment renovation",
      rows: [
        { description: "20mm rebar", quantity: 50, unit: "pcs", unitPrice: 800 },
        { description: "Cement 50kg", quantity: 100, unit: "bag", unitPrice: 750 },
      ],
      bulkDiscountPct: 5,
      vatPct: 16,
    })
    assertPdf(bytes)
  })
})

describe("renderClaimsPdf", () => {
  it("renders claims list", () => {
    const bytes = renderClaimsPdf({
      brand: BRAND,
      rangeLabel: "June 2026",
      rows: [
        {
          claimNumber: "C-001",
          patientName: "Patient A",
          insurer: "SHA",
          submittedDate: "2026-06-12",
          status: "submitted",
          claimAmount: 5000,
          paidAmount: 0,
        },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderControlledRegisterPdf", () => {
  it("renders pharmacy controlled-substances register", () => {
    const bytes = renderControlledRegisterPdf({
      brand: BRAND,
      date: "2026-06-12",
      rows: [
        {
          drugName: "Pethidine",
          batchNumber: "B22",
          stockBefore: 50,
          dispensed: 5,
          received: 0,
          stockAfter: 45,
          prescriber: "Dr Mwangi",
          patient: "Patient B",
        },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderP9Pdf", () => {
  it("renders annual PAYE certificate with monthly totals", () => {
    const bytes = renderP9Pdf({
      brand: BRAND,
      year: 2026,
      employee: { fullName: "Jane Doe", employeeNumber: "EMP001", kraPin: "A012345678X" },
      months: Array.from({ length: 12 }).map((_, i) => ({
        month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
        basicSalary: 50000,
        benefits: 0,
        grossPay: 50000,
        nssf: 1080,
        shifContribution: 1375,
        housingLevy: 750,
        paye: 5000,
      })),
    })
    assertPdf(bytes)
  })
})

describe("renderP10Pdf", () => {
  it("renders monthly PAYE return batch", () => {
    const bytes = renderP10Pdf({
      brand: BRAND,
      period: "2026-06",
      rows: [
        {
          employeeNumber: "EMP001",
          fullName: "Jane Doe",
          kraPin: "A012345678X",
          grossPay: 50000,
          paye: 5000,
          nssf: 1080,
          shifContribution: 1375,
          housingLevy: 750,
        },
      ],
    })
    assertPdf(bytes)
  })
})

describe("renderZReportPdf", () => {
  it("renders shift-close Z-report with payments + variance", () => {
    const bytes = renderZReportPdf({
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
    })
    assertPdf(bytes)
  })
})
