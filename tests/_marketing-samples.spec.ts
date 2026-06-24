/**
 * Generates the 6 sample PDFs used by the website's marketing pages.
 *
 * Runs as a vitest test so it picks up the tsconfig path aliases
 * automatically. The "test" body actually writes files — that's
 * intentional. Re-run with: pnpm vitest run tests/_marketing-samples.spec.ts
 *
 * Output goes to website/public/samples/ (git-tracked so the homepage
 * compliance grid links resolve at build time).
 */
import { describe, it, expect } from "vitest"
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  renderVat3Pdf,
  renderP9Pdf,
  renderP10Pdf,
  renderGrnPdf,
  renderHardwareQuotePdf,
  renderZReportPdf,
} from "@/services/reports-pdf"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, "..")
const OUT = join(REPO, "website", "public", "samples")

const BRAND = {
  businessName: "Acme Pharmacy & Wellness",
  address: "Tom Mboya Street, Nairobi",
  phone: "+254 700 123 456",
  email: "info@acmepharmacy.co.ke",
  kraPin: "P051234567M",
  website: "acmepharmacy.co.ke",
}

const writeBytes = (path: string, bytes: Uint8Array) =>
  writeFileSync(path, Buffer.from(bytes))

describe("marketing sample PDFs", () => {
  it("writes 6 sample PDFs to website/public/samples/", () => {
    mkdirSync(OUT, { recursive: true })

    writeBytes(
      `${OUT}/vat3-sample.pdf`,
      renderVat3Pdf({
        brand: BRAND,
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        salesNet: 4_250_000,
        outputVat: 680_000,
        purchasesNet: 2_100_000,
        inputVat: 336_000,
      }),
    )

    writeBytes(
      `${OUT}/p9-sample.pdf`,
      renderP9Pdf({
        brand: BRAND,
        year: 2025,
        employee: {
          fullName: "Jane Wairimu Kamau",
          employeeNumber: "EMP00012",
          kraPin: "A012345678X",
          designation: "Senior Pharmacist",
        },
        months: [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ].map((m) => ({
          month: m,
          basicSalary: 85_000,
          benefits: 5_000,
          grossPay: 90_000,
          nssf: 2_160,
          shifContribution: 2_475,
          housingLevy: 1_350,
          paye: 13_500,
        })),
      }),
    )

    writeBytes(
      `${OUT}/p10-sample.pdf`,
      renderP10Pdf({
        brand: BRAND,
        period: "2026-05",
        rows: [
          {
            employeeNumber: "EMP00012",
            fullName: "Jane Wairimu Kamau",
            kraPin: "A012345678X",
            grossPay: 90_000,
            paye: 13_500,
            nssf: 2_160,
            shifContribution: 2_475,
            housingLevy: 1_350,
          },
          {
            employeeNumber: "EMP00018",
            fullName: "Peter Otieno Achieng",
            kraPin: "A019988776B",
            grossPay: 65_000,
            paye: 8_750,
            nssf: 2_160,
            shifContribution: 1_787,
            housingLevy: 975,
          },
          {
            employeeNumber: "EMP00024",
            fullName: "Mary Njoki Wanjiru",
            kraPin: "A022334455C",
            grossPay: 45_000,
            paye: 4_500,
            nssf: 2_160,
            shifContribution: 1_237,
            housingLevy: 675,
          },
        ],
      }),
    )

    writeBytes(
      `${OUT}/grn-sample.pdf`,
      renderGrnPdf({
        brand: BRAND,
        grnNumber: "GRN-00042",
        receivedDate: "2026-05-12",
        supplierName: "Universal Pharma Wholesalers Ltd",
        poNumber: "PO-2026-0118",
        receivedBy: "James Mwangi",
        rows: [
          { productName: "Paracetamol 500mg (100s)", quantity: 200, unitCost: 95.5, batchNumber: "PCM2604A", expiryDate: "2028-04-30" },
          { productName: "Amoxicillin 250mg (10s)", quantity: 150, unitCost: 178, batchNumber: "AMX2604B", expiryDate: "2028-02-15" },
          { productName: "Bandage roll, sterile", quantity: 80, unitCost: 42, batchNumber: null, expiryDate: null },
          { productName: "Cough syrup 100ml", quantity: 60, unitCost: 245, batchNumber: "CGH2603C", expiryDate: "2027-12-30" },
          { productName: "Multivitamin tabs (30s)", quantity: 120, unitCost: 380, batchNumber: "MVT2604D", expiryDate: "2027-09-30" },
        ],
      }),
    )

    writeBytes(
      `${OUT}/hardware-quote-sample.pdf`,
      renderHardwareQuotePdf({
        brand: { ...BRAND, businessName: "Acme Hardware & Building Supplies" },
        quoteNumber: "Q-2026-0231",
        validUntil: "2026-06-30",
        customerName: "Westlands Apartments Project",
        customerPhone: "+254 711 222 333",
        customerProject: "Phase 2 — 24 units",
        rows: [
          { description: "Y10 deformed bar (12m)", quantity: 200, unit: "pcs", unitPrice: 750 },
          { description: "Y12 deformed bar (12m)", quantity: 150, unit: "pcs", unitPrice: 1_080 },
          { description: "Cement, 50kg", quantity: 400, unit: "bag", unitPrice: 730 },
          { description: "BRC mesh A142, 4.8 × 2.4m", quantity: 30, unit: "sht", unitPrice: 4_200 },
          { description: "Binding wire 1.6mm, 25kg", quantity: 8, unit: "roll", unitPrice: 5_800 },
          { description: "Quarry chippings, 6mm", quantity: 12, unit: "tn", unitPrice: 2_400 },
        ],
        bulkDiscountPct: 5,
        vatPct: 16,
      }),
    )

    writeBytes(
      `${OUT}/z-report-sample.pdf`,
      renderZReportPdf({
        brand: BRAND,
        shiftStart: "2026-05-12T08:00:00",
        shiftEnd: "2026-05-12T18:30:00",
        cashier: "Mary Njoki Wanjiru",
        payments: [
          { method: "Cash", transactions: 47, amount: 38_450 },
          { method: "M-Pesa STK", transactions: 62, amount: 71_280 },
          { method: "Card", transactions: 11, amount: 14_700 },
          { method: "Insurance (SHA)", transactions: 5, amount: 9_800 },
        ],
        totalSales: 134_230,
        totalRefunds: 850,
        cashOpening: 5_000,
        cashCounted: 42_580,
        cashVariance: -870,
      }),
    )

    expect(existsSync(`${OUT}/vat3-sample.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/p9-sample.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/p10-sample.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/grn-sample.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/hardware-quote-sample.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/z-report-sample.pdf`)).toBe(true)
  })
})
