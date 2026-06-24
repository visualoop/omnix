/**
 * Reports PDF facade — one entry point per print/export site in the app.
 *
 * Each render<X>Pdf takes already-loaded data + a brand block and returns
 * Uint8Array PDF bytes. Side-effecting wrappers (download<X>Pdf, preview)
 * live in pdf-brand.ts — call them from page handlers.
 *
 * Excluded by design: thermal POS receipts. Those use window.print() with
 * a print-CSS-only DOM (see lib/print.tsx) because thermal printers want
 * 80mm receipt layout, not A4.
 */
import {
  type BrandHeader,
  type TabularReportInput,
  renderTabularReport,
  PAGE_WIDTH_MM,
  MARGIN_MM,
  newDoc,
  drawMasthead,
  drawFooter,
  fmtAmount,
  fmtDate,
  toBytes,
} from "@/services/pdf-engine"
import autoTable from "jspdf-autotable"

// ─── P&L ──────────────────────────────────────────────────────────

export interface PnlRow {
  category: string
  amount: number
  /** "revenue" | "cogs" | "expense" | "other_income" | "tax" — drives bold + indent. */
  kind?: string
}

export interface PnlPdfInput {
  brand: BrandHeader
  startDate: string
  endDate: string
  rows: PnlRow[]
  /** Final totals: revenue, cogs, gross_profit, expenses, net_profit. */
  totals: {
    revenue: number
    cogs: number
    grossProfit: number
    expenses: number
    netProfit: number
  }
}

export function renderPnlPdf(input: PnlPdfInput): Uint8Array {
  const tab: TabularReportInput = {
    brand: input.brand,
    title: "Profit & Loss",
    subtitle: `Period: ${fmtDate(input.startDate)} – ${fmtDate(input.endDate)}`,
    columns: [
      { label: "Category", width: 100 },
      { label: "Amount", money: true, width: 60 },
    ],
    rows: input.rows.map((r) => [r.category, r.amount]),
    summary: [
      { label: "Revenue", value: fmtAmount(input.totals.revenue) },
      { label: "COGS", value: fmtAmount(input.totals.cogs) },
      { label: "Gross profit", value: fmtAmount(input.totals.grossProfit) },
      { label: "Expenses", value: fmtAmount(input.totals.expenses) },
      { label: "Net profit", value: fmtAmount(input.totals.netProfit) },
    ],
    notes: "All figures in KES unless otherwise stated. Generated from completed sales only.",
  }
  return renderTabularReport(tab)
}

// ─── Day book / Daily Operations ──────────────────────────────────

export interface DayBookProductRow {
  productName: string
  qtySold: number
  revenue: number
  cost: number
  profit: number
}

export interface DayBookPdfInput {
  brand: BrandHeader
  date: string
  rows: DayBookProductRow[]
}

export function renderDayBookPdf(input: DayBookPdfInput): Uint8Array {
  const totalRev = input.rows.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalCost = input.rows.reduce((s, r) => s + (r.cost || 0), 0)
  const totalProfit = input.rows.reduce((s, r) => s + (r.profit || 0), 0)
  const totalQty = input.rows.reduce((s, r) => s + (r.qtySold || 0), 0)

  return renderTabularReport({
    brand: input.brand,
    title: "Daily Operations",
    subtitle: fmtDate(input.date),
    columns: [
      { label: "Product", width: 80 },
      { label: "Qty", money: false, align: "right", width: 25 },
      { label: "Revenue", money: true, width: 30 },
      { label: "Cost", money: true, width: 30 },
      { label: "Profit", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [r.productName, r.qtySold, r.revenue, r.cost, r.profit]),
    totals: ["Total", totalQty, totalRev, totalCost, totalProfit],
    orientation: "landscape",
  })
}

// ─── Top products ─────────────────────────────────────────────────

export interface TopProductsPdfInput {
  brand: BrandHeader
  /** "Last 30 days" / "1 Jun – 30 Jun" etc. */
  rangeLabel: string
  rows: Array<{ productName: string; quantity: number; revenue: number; profit?: number }>
}

export function renderTopProductsPdf(input: TopProductsPdfInput): Uint8Array {
  const totalRev = input.rows.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalProfit = input.rows.reduce((s, r) => s + (r.profit ?? 0), 0)
  const totalQty = input.rows.reduce((s, r) => s + (r.quantity || 0), 0)
  const includeProfit = input.rows.some((r) => r.profit !== undefined)

  return renderTabularReport({
    brand: input.brand,
    title: "Top Products",
    subtitle: input.rangeLabel,
    columns: [
      { label: "#", width: 8, align: "right" },
      { label: "Product", width: includeProfit ? 80 : 100 },
      { label: "Units sold", align: "right", width: 30 },
      { label: "Revenue", money: true, width: 35 },
      ...(includeProfit ? [{ label: "Profit", money: true, width: 30 }] : []),
    ],
    rows: input.rows.map((r, i) =>
      includeProfit
        ? [i + 1, r.productName, r.quantity, r.revenue, r.profit ?? 0]
        : [i + 1, r.productName, r.quantity, r.revenue],
    ),
    totals: includeProfit
      ? ["", "Total", totalQty, totalRev, totalProfit]
      : ["", "Total", totalQty, totalRev],
  })
}

// ─── Payment mix ──────────────────────────────────────────────────

export interface PaymentMixPdfInput {
  brand: BrandHeader
  rangeLabel: string
  rows: Array<{ method: string; transactions: number; amount: number }>
}

export function renderPaymentMixPdf(input: PaymentMixPdfInput): Uint8Array {
  const totalAmt = input.rows.reduce((s, r) => s + (r.amount || 0), 0)
  const totalTx = input.rows.reduce((s, r) => s + (r.transactions || 0), 0)
  return renderTabularReport({
    brand: input.brand,
    title: "Payment Mix",
    subtitle: input.rangeLabel,
    columns: [
      { label: "Method", width: 80 },
      { label: "Transactions", align: "right", width: 40 },
      { label: "Amount", money: true, width: 50 },
    ],
    rows: input.rows.map((r) => [r.method, r.transactions, r.amount]),
    totals: ["Total", totalTx, totalAmt],
  })
}

// ─── Reorder list / Dead stock ────────────────────────────────────

export interface ReorderListPdfInput {
  brand: BrandHeader
  rows: Array<{
    productName: string
    sku?: string | null
    onHand: number
    reorderLevel: number
    suggestedOrder: number
  }>
}

export function renderReorderListPdf(input: ReorderListPdfInput): Uint8Array {
  return renderTabularReport({
    brand: input.brand,
    title: "Reorder List",
    subtitle: fmtDate(new Date()),
    columns: [
      { label: "Product", width: 80 },
      { label: "SKU", width: 30 },
      { label: "On hand", align: "right", width: 25 },
      { label: "Reorder at", align: "right", width: 25 },
      { label: "Suggested", align: "right", width: 25 },
    ],
    rows: input.rows.map((r) => [r.productName, r.sku ?? "—", r.onHand, r.reorderLevel, r.suggestedOrder]),
  })
}

export interface DeadStockPdfInput {
  brand: BrandHeader
  /** Threshold in days. */
  daysSinceSold: number
  rows: Array<{
    productName: string
    sku?: string | null
    onHand: number
    valueAtCost: number
    lastSold?: string | null
  }>
}

export function renderDeadStockPdf(input: DeadStockPdfInput): Uint8Array {
  const totalValue = input.rows.reduce((s, r) => s + (r.valueAtCost || 0), 0)
  return renderTabularReport({
    brand: input.brand,
    title: "Dead Stock",
    subtitle: `Items not sold in the last ${input.daysSinceSold} days`,
    columns: [
      { label: "Product", width: 80 },
      { label: "SKU", width: 30 },
      { label: "On hand", align: "right", width: 25 },
      { label: "Value @ cost", money: true, width: 30 },
      { label: "Last sold", width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.productName,
      r.sku ?? "—",
      r.onHand,
      r.valueAtCost,
      r.lastSold ? fmtDate(r.lastSold) : "Never",
    ]),
    totals: ["Total", "", "", totalValue, ""],
  })
}

// ─── VAT3 (Kenya) ─────────────────────────────────────────────────

export interface Vat3PdfInput {
  brand: BrandHeader
  startDate: string
  endDate: string
  /** Total sales (output VAT base). */
  salesNet: number
  outputVat: number
  /** Total purchases (input VAT base). */
  purchasesNet: number
  inputVat: number
}

export function renderVat3Pdf(input: Vat3PdfInput): Uint8Array {
  const payable = input.outputVat - input.inputVat
  return renderTabularReport({
    brand: input.brand,
    title: "VAT3 Return",
    subtitle: `Period: ${fmtDate(input.startDate)} – ${fmtDate(input.endDate)}`,
    columns: [
      { label: "Line", width: 120 },
      { label: "Amount (KES)", money: true, width: 50 },
    ],
    rows: [
      ["Total taxable supplies (sales) — net", input.salesNet],
      ["Output VAT @ 16%", input.outputVat],
      ["Total taxable purchases — net", input.purchasesNet],
      ["Input VAT @ 16%", input.inputVat],
    ],
    totals: [
      payable >= 0 ? "VAT payable to KRA" : "VAT credit (carried forward)",
      Math.abs(payable),
    ],
    notes:
      "This document is generated for record-keeping. File on iTax monthly by the 20th of the following month. " +
      "Cross-check against the eTIMS portal before submission.",
  })
}

// ─── Aged receivables / Aged payables ────────────────────────────

export interface AgedRow {
  party: string
  current: number
  d1to30: number
  d31to60: number
  d61to90: number
  over90: number
}

export interface AgedPdfInput {
  brand: BrandHeader
  /** "Receivables" or "Payables". */
  kind: "receivables" | "payables"
  asOf: string
  rows: AgedRow[]
}

export function renderAgedPdf(input: AgedPdfInput): Uint8Array {
  const sum = (key: keyof AgedRow) =>
    input.rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0)
  const totalCurrent = sum("current")
  const total1to30 = sum("d1to30")
  const total31to60 = sum("d31to60")
  const total61to90 = sum("d61to90")
  const totalOver90 = sum("over90")
  const grand = totalCurrent + total1to30 + total31to60 + total61to90 + totalOver90

  return renderTabularReport({
    brand: input.brand,
    title: `Aged ${input.kind === "receivables" ? "Receivables" : "Payables"}`,
    subtitle: `As of ${fmtDate(input.asOf)}`,
    orientation: "landscape",
    columns: [
      { label: input.kind === "receivables" ? "Customer" : "Supplier", width: 70 },
      { label: "Current", money: true, width: 30 },
      { label: "1–30", money: true, width: 30 },
      { label: "31–60", money: true, width: 30 },
      { label: "61–90", money: true, width: 30 },
      { label: "90+", money: true, width: 30 },
      { label: "Total", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.party,
      r.current,
      r.d1to30,
      r.d31to60,
      r.d61to90,
      r.over90,
      (r.current || 0) + (r.d1to30 || 0) + (r.d31to60 || 0) + (r.d61to90 || 0) + (r.over90 || 0),
    ]),
    totals: ["Total", totalCurrent, total1to30, total31to60, total61to90, totalOver90, grand],
  })
}

// ─── Stock-take variance ──────────────────────────────────────────

export interface StockTakeVariancePdfInput {
  brand: BrandHeader
  takeDate: string
  rows: Array<{
    productName: string
    sku?: string | null
    expectedQty: number
    countedQty: number
    variance: number
    /** Computed variance value in KES. */
    valueDelta: number
  }>
}

export function renderStockTakeVariancePdf(input: StockTakeVariancePdfInput): Uint8Array {
  const totalDelta = input.rows.reduce((s, r) => s + (r.valueDelta || 0), 0)
  return renderTabularReport({
    brand: input.brand,
    title: "Stock-take Variance",
    subtitle: fmtDate(input.takeDate),
    columns: [
      { label: "Product", width: 80 },
      { label: "SKU", width: 30 },
      { label: "Expected", align: "right", width: 22 },
      { label: "Counted", align: "right", width: 22 },
      { label: "Δ", align: "right", width: 22 },
      { label: "Value Δ (KES)", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.productName,
      r.sku ?? "—",
      r.expectedQty,
      r.countedQty,
      r.variance,
      r.valueDelta,
    ]),
    totals: ["Total", "", "", "", "", totalDelta],
  })
}

// ─── GRN (Goods Received Note) ───────────────────────────────────

export interface GrnPdfInput {
  brand: BrandHeader
  grnNumber: string
  receivedDate: string
  supplierName: string
  poNumber?: string | null
  receivedBy?: string | null
  rows: Array<{
    productName: string
    quantity: number
    unitCost: number
    batchNumber?: string | null
    expiryDate?: string | null
  }>
}

export function renderGrnPdf(input: GrnPdfInput): Uint8Array {
  const total = input.rows.reduce((s, r) => s + r.quantity * r.unitCost, 0)
  return renderTabularReport({
    brand: input.brand,
    title: `Goods Received Note · ${input.grnNumber}`,
    subtitle: `${fmtDate(input.receivedDate)} · From ${input.supplierName}${input.poNumber ? ` · PO ${input.poNumber}` : ""}`,
    summary: [
      ...(input.receivedBy ? [{ label: "Received by", value: input.receivedBy }] : []),
      { label: "Items", value: String(input.rows.length) },
      { label: "Total cost", value: fmtAmount(total) },
    ],
    columns: [
      { label: "Product", width: 70 },
      { label: "Batch #", width: 30 },
      { label: "Expiry", width: 30 },
      { label: "Qty", align: "right", width: 20 },
      { label: "Unit cost", money: true, width: 30 },
      { label: "Line total", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.productName,
      r.batchNumber ?? "—",
      r.expiryDate ? fmtDate(r.expiryDate) : "—",
      r.quantity,
      r.unitCost,
      r.quantity * r.unitCost,
    ]),
    totals: ["Total", "", "", "", "", total],
    notes:
      "Goods received against the above PO. Variances should be raised in writing within 7 days.",
  })
}

// ─── Hardware quotation (alternative compact format) ─────────────

export interface HardwareQuotePdfInput {
  brand: BrandHeader
  quoteNumber: string
  validUntil: string
  customerName: string
  customerPhone?: string | null
  customerProject?: string | null
  rows: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
  }>
  /** Optional bulk discount as a percentage of subtotal. */
  bulkDiscountPct?: number
  /** Optional VAT — usually 16% in Kenya. */
  vatPct?: number
}

export function renderHardwareQuotePdf(input: HardwareQuotePdfInput): Uint8Array {
  const subtotal = input.rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
  const discount = (subtotal * (input.bulkDiscountPct ?? 0)) / 100
  const taxable = subtotal - discount
  const vat = (taxable * (input.vatPct ?? 0)) / 100
  const grand = taxable + vat

  return renderTabularReport({
    brand: input.brand,
    title: `Hardware Quotation · ${input.quoteNumber}`,
    subtitle: `Valid until ${fmtDate(input.validUntil)} · For ${input.customerName}`,
    summary: [
      ...(input.customerPhone ? [{ label: "Phone", value: input.customerPhone }] : []),
      ...(input.customerProject ? [{ label: "Project", value: input.customerProject }] : []),
      { label: "Subtotal", value: fmtAmount(subtotal) },
      ...(discount > 0 ? [{ label: `Discount ${input.bulkDiscountPct}%`, value: `-${fmtAmount(discount)}` }] : []),
      ...(vat > 0 ? [{ label: `VAT ${input.vatPct}%`, value: fmtAmount(vat) }] : []),
      { label: "Total", value: fmtAmount(grand) },
    ],
    columns: [
      { label: "Description", width: 80 },
      { label: "Unit", width: 25 },
      { label: "Qty", align: "right", width: 20 },
      { label: "Unit price", money: true, width: 30 },
      { label: "Line total", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [r.description, r.unit, r.quantity, r.unitPrice, r.quantity * r.unitPrice]),
    totals: ["Total", "", "", "", grand],
    notes:
      "Prices are subject to availability. Quotation includes labour where specified. " +
      "Lead time may apply to bulk orders. Payment terms: 50% deposit, balance on delivery.",
  })
}

// ─── Claims (insurance) ──────────────────────────────────────────

export interface ClaimsPdfInput {
  brand: BrandHeader
  rangeLabel: string
  rows: Array<{
    claimNumber: string
    patientName: string
    insurer: string
    submittedDate: string
    status: string
    claimAmount: number
    paidAmount: number
  }>
}

export function renderClaimsPdf(input: ClaimsPdfInput): Uint8Array {
  const totalClaim = input.rows.reduce((s, r) => s + r.claimAmount, 0)
  const totalPaid = input.rows.reduce((s, r) => s + r.paidAmount, 0)
  return renderTabularReport({
    brand: input.brand,
    title: "Insurance Claims",
    subtitle: input.rangeLabel,
    orientation: "landscape",
    columns: [
      { label: "Claim #", width: 30 },
      { label: "Patient", width: 50 },
      { label: "Insurer", width: 35 },
      { label: "Submitted", width: 25 },
      { label: "Status", width: 25 },
      { label: "Claim (KES)", money: true, width: 30 },
      { label: "Paid (KES)", money: true, width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.claimNumber,
      r.patientName,
      r.insurer,
      fmtDate(r.submittedDate),
      r.status,
      r.claimAmount,
      r.paidAmount,
    ]),
    totals: ["Total", "", "", "", "", totalClaim, totalPaid],
  })
}

// ─── Controlled-substances register (Kenya pharmacy compliance) ──

export interface ControlledRegisterPdfInput {
  brand: BrandHeader
  date: string
  rows: Array<{
    drugName: string
    batchNumber?: string | null
    stockBefore: number
    dispensed: number
    received: number
    stockAfter: number
    /** Doctor / prescriber name. */
    prescriber?: string | null
    /** Patient identifier (anonymised). */
    patient?: string | null
  }>
}

export function renderControlledRegisterPdf(input: ControlledRegisterPdfInput): Uint8Array {
  return renderTabularReport({
    brand: input.brand,
    title: "Controlled Substances Register",
    subtitle: fmtDate(input.date),
    orientation: "landscape",
    columns: [
      { label: "Drug", width: 50 },
      { label: "Batch", width: 25 },
      { label: "Before", align: "right", width: 22 },
      { label: "Dispensed", align: "right", width: 25 },
      { label: "Received", align: "right", width: 25 },
      { label: "After", align: "right", width: 22 },
      { label: "Prescriber", width: 35 },
      { label: "Patient", width: 30 },
    ],
    rows: input.rows.map((r) => [
      r.drugName,
      r.batchNumber ?? "—",
      r.stockBefore,
      r.dispensed,
      r.received,
      r.stockAfter,
      r.prescriber ?? "—",
      r.patient ?? "—",
    ]),
    notes:
      "Pharmacy & Poisons Board record. Retain for 5 years. Verify the dispensing pharmacist's licence number is recorded for every Schedule III/IV/V transaction.",
  })
}

// ─── P9 (annual PAYE certificate) ────────────────────────────────

export interface P9PdfInput {
  brand: BrandHeader
  /** Tax year, e.g. 2026. */
  year: number
  employee: {
    fullName: string
    employeeNumber: string
    kraPin: string
    designation?: string | null
  }
  /** Each row is one month. 12 months expected. */
  months: Array<{
    month: string // "Jan" / "Feb" / ...
    basicSalary: number
    benefits: number
    grossPay: number
    nssf: number
    shifContribution: number
    housingLevy: number
    paye: number
  }>
}

export function renderP9Pdf(input: P9PdfInput): Uint8Array {
  const totals = input.months.reduce(
    (s, m) => ({
      basicSalary: s.basicSalary + m.basicSalary,
      benefits: s.benefits + m.benefits,
      grossPay: s.grossPay + m.grossPay,
      nssf: s.nssf + m.nssf,
      shifContribution: s.shifContribution + m.shifContribution,
      housingLevy: s.housingLevy + m.housingLevy,
      paye: s.paye + m.paye,
    }),
    { basicSalary: 0, benefits: 0, grossPay: 0, nssf: 0, shifContribution: 0, housingLevy: 0, paye: 0 },
  )
  return renderTabularReport({
    brand: input.brand,
    title: `P9 Tax Certificate · ${input.year}`,
    subtitle: `${input.employee.fullName} · KRA PIN ${input.employee.kraPin}`,
    summary: [
      { label: "Employee #", value: input.employee.employeeNumber },
      ...(input.employee.designation ? [{ label: "Designation", value: input.employee.designation }] : []),
    ],
    orientation: "landscape",
    columns: [
      { label: "Month", width: 20 },
      { label: "Basic", money: true, width: 30 },
      { label: "Benefits", money: true, width: 30 },
      { label: "Gross", money: true, width: 30 },
      { label: "NSSF", money: true, width: 25 },
      { label: "SHIF", money: true, width: 25 },
      { label: "Housing", money: true, width: 25 },
      { label: "PAYE", money: true, width: 30 },
    ],
    rows: input.months.map((m) => [
      m.month,
      m.basicSalary,
      m.benefits,
      m.grossPay,
      m.nssf,
      m.shifContribution,
      m.housingLevy,
      m.paye,
    ]),
    totals: [
      "Total",
      totals.basicSalary,
      totals.benefits,
      totals.grossPay,
      totals.nssf,
      totals.shifContribution,
      totals.housingLevy,
      totals.paye,
    ],
    notes:
      "P9 issued under the Income Tax Act. Employee retains for personal records and KRA returns.",
  })
}

// ─── P10 (monthly PAYE return) ───────────────────────────────────

export interface P10PdfInput {
  brand: BrandHeader
  /** "2026-06" — year-month string. */
  period: string
  rows: Array<{
    employeeNumber: string
    fullName: string
    kraPin: string
    grossPay: number
    paye: number
    nssf: number
    shifContribution: number
    housingLevy: number
  }>
}

export function renderP10Pdf(input: P10PdfInput): Uint8Array {
  const totals = input.rows.reduce(
    (s, r) => ({
      grossPay: s.grossPay + r.grossPay,
      paye: s.paye + r.paye,
      nssf: s.nssf + r.nssf,
      shifContribution: s.shifContribution + r.shifContribution,
      housingLevy: s.housingLevy + r.housingLevy,
    }),
    { grossPay: 0, paye: 0, nssf: 0, shifContribution: 0, housingLevy: 0 },
  )
  return renderTabularReport({
    brand: input.brand,
    title: `P10 PAYE Return · ${input.period}`,
    subtitle: `Monthly batch — ${input.rows.length} employee${input.rows.length === 1 ? "" : "s"}`,
    orientation: "landscape",
    columns: [
      { label: "Emp #", width: 18 },
      { label: "Name", width: 50 },
      { label: "KRA PIN", width: 30 },
      { label: "Gross", money: true, width: 30 },
      { label: "PAYE", money: true, width: 30 },
      { label: "NSSF", money: true, width: 25 },
      { label: "SHIF", money: true, width: 25 },
      { label: "Housing", money: true, width: 25 },
    ],
    rows: input.rows.map((r) => [
      r.employeeNumber,
      r.fullName,
      r.kraPin,
      r.grossPay,
      r.paye,
      r.nssf,
      r.shifContribution,
      r.housingLevy,
    ]),
    totals: [
      "Total",
      "",
      "",
      totals.grossPay,
      totals.paye,
      totals.nssf,
      totals.shifContribution,
      totals.housingLevy,
    ],
    notes:
      "Submit on iTax by the 9th of the following month. Verify PINs before filing.",
  })
}

// ─── Z-report (shift close) ──────────────────────────────────────

export interface ZReportPdfInput {
  brand: BrandHeader
  shiftStart: string
  shiftEnd: string
  cashier: string
  /** Sales subtotals by payment method. */
  payments: Array<{ method: string; transactions: number; amount: number }>
  totalSales: number
  totalRefunds: number
  cashOpening: number
  cashCounted: number
  /** Difference between expected and counted cash. */
  cashVariance: number
}

export function renderZReportPdf(input: ZReportPdfInput): Uint8Array {
  const pdf = newDoc()
  let y = drawMasthead(
    pdf,
    input.brand,
    "Z-Report",
    `Shift: ${fmtDate(input.shiftStart)} → ${fmtDate(input.shiftEnd)}`,
  )

  // Identity block
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(120)
  pdf.text("Cashier", MARGIN_MM, y + 4)
  pdf.text("Shift open", MARGIN_MM + 60, y + 4)
  pdf.text("Shift close", MARGIN_MM + 110, y + 4)
  pdf.setTextColor(0)
  pdf.setFont("helvetica", "bold")
  pdf.text(input.cashier, MARGIN_MM, y + 9)
  pdf.text(new Date(input.shiftStart).toLocaleString("en-KE"), MARGIN_MM + 60, y + 9)
  pdf.text(new Date(input.shiftEnd).toLocaleString("en-KE"), MARGIN_MM + 110, y + 9)
  y += 16

  // Payments table
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.text("Payments", MARGIN_MM, y)
  y += 3
  autoTablePayments(pdf, y, input.payments)

  // Find table end
  const after = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30
  const totalsY = after + 6

  // Totals box
  const boxX = PAGE_WIDTH_MM - MARGIN_MM - 80
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.text("Summary", boxX, totalsY)
  pdf.setLineWidth(0.2)
  pdf.line(boxX, totalsY + 2, PAGE_WIDTH_MM - MARGIN_MM, totalsY + 2)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  let py = totalsY + 8
  const writeRow = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal")
    pdf.text(label, boxX, py)
    pdf.text(value, PAGE_WIDTH_MM - MARGIN_MM, py, { align: "right" })
    py += 5
  }
  writeRow("Sales total", fmtAmount(input.totalSales))
  writeRow("Refunds", `-${fmtAmount(input.totalRefunds)}`)
  writeRow("Cash opening float", fmtAmount(input.cashOpening))
  writeRow("Cash counted", fmtAmount(input.cashCounted))
  writeRow(
    "Cash variance",
    `${input.cashVariance >= 0 ? "+" : ""}${fmtAmount(input.cashVariance)}`,
    true,
  )

  // Footers on every page
  const total = pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    drawFooter(pdf, input.brand, p, total)
  }
  return toBytes(pdf)
}

function autoTablePayments(pdf: import("jspdf").default, y: number, rows: Array<{ method: string; transactions: number; amount: number }>) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  autoTable(pdf, {
    startY: y,
    head: [["Method", "Transactions", "Amount"]],
    body: [
      ...rows.map((r) => [r.method, r.transactions, fmtAmount(r.amount)]),
      ["Total", "", fmtAmount(total)],
    ],
    theme: "plain",
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [120, 120, 120],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "right", cellWidth: 30 },
      2: { halign: "right", font: "courier", cellWidth: 40 },
    },
  })
}
