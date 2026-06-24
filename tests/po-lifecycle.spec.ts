/**
 * PO lifecycle tests.
 *
 * Most of the lifecycle calls live SQLite, so this file focuses on the
 * pieces we can isolate cleanly:
 *   - approval status decision (nextStatusFromDraft)
 *   - three-way match arithmetic (variance % + tolerance)
 *   - mixed-currency conversion (toBaseCurrency)
 *
 * The DB-touching paths (reverseGoodsReceipt, approvePurchaseOrder)
 * are exercised at the integration layer; here we lock the logic that
 * lives in the service module itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { toBaseCurrency } from "@/services/po-lifecycle"

// Mock the DB module so service helpers can be called without a real
// SQLite binding. Each test case wires its own query() responses.
vi.mock("@/lib/db", () => {
  return {
    query: vi.fn(),
    execute: vi.fn(),
  }
})

vi.mock("@/services/erp", () => ({
  getPurchaseOrder: vi.fn(),
  updatePOStatus: vi.fn(),
}))

import { query } from "@/lib/db"
import {
  getApprovalSettings,
  nextStatusFromDraft,
  threeWayMatch,
} from "@/services/po-lifecycle"
import { getPurchaseOrder } from "@/services/erp"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("toBaseCurrency", () => {
  it("multiplies foreign amount by exchange rate", () => {
    expect(toBaseCurrency(100, 130)).toBe(13_000)
  })

  it("returns amount unchanged when rate is 0 or 1 (base currency)", () => {
    expect(toBaseCurrency(100, 1)).toBe(100)
    expect(toBaseCurrency(100, 0)).toBe(100) // safety: 0 → 1 fallback
  })
})

describe("getApprovalSettings", () => {
  it("returns defaults when no setting rows", async () => {
    vi.mocked(query).mockResolvedValueOnce([])
    const cfg = await getApprovalSettings()
    expect(cfg.thresholdAmount).toBe(100_000)
    expect(cfg.required).toBe(true)
    expect(cfg.toleranceDocPct).toBe(1)
  })

  it("parses settings rows", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { key: "purchasing.approval_threshold", value: "250000" },
      { key: "purchasing.approval_required", value: "0" },
      { key: "purchasing.three_way_tolerance_pct", value: "0.5" },
    ])
    const cfg = await getApprovalSettings()
    expect(cfg.thresholdAmount).toBe(250_000)
    expect(cfg.required).toBe(false)
    expect(cfg.toleranceDocPct).toBe(0.5)
  })
})

describe("nextStatusFromDraft", () => {
  it("returns 'sent' when approval not required", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { key: "purchasing.approval_required", value: "0" },
    ])
    const status = await nextStatusFromDraft(500_000) // big PO but approval off
    expect(status).toBe("sent")
  })

  it("returns 'sent' when total below threshold", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { key: "purchasing.approval_threshold", value: "100000" },
      { key: "purchasing.approval_required", value: "1" },
    ])
    expect(await nextStatusFromDraft(50_000)).toBe("sent")
  })

  it("returns 'pending_approval' when total >= threshold", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { key: "purchasing.approval_threshold", value: "100000" },
      { key: "purchasing.approval_required", value: "1" },
    ])
    expect(await nextStatusFromDraft(150_000)).toBe("pending_approval")
  })

  it("treats exact threshold as needing approval", async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { key: "purchasing.approval_threshold", value: "100000" },
      { key: "purchasing.approval_required", value: "1" },
    ])
    expect(await nextStatusFromDraft(100_000)).toBe("pending_approval")
  })
})

describe("threeWayMatch", () => {
  it("matches when all three totals are equal", async () => {
    vi.mocked(getPurchaseOrder).mockResolvedValueOnce({
      po: { total: 10_000 } as Parameters<typeof getPurchaseOrder>[0] extends string ? never : never as never,
      items: [],
    } as unknown as Awaited<ReturnType<typeof getPurchaseOrder>>)
    vi.mocked(query)
      .mockResolvedValueOnce([{ key: "purchasing.three_way_tolerance_pct", value: "1" }])
      .mockResolvedValueOnce([{ total: 10_000, invoice_total: 10_000 }])
    const result = await threeWayMatch("po-1")
    expect(result.ok).toBe(true)
    expect(result.maxVariancePct).toBeLessThan(0.01)
  })

  it("flags variance when GRN > PO by 2% and tolerance is 1%", async () => {
    vi.mocked(getPurchaseOrder).mockResolvedValueOnce({
      po: { total: 10_000 },
      items: [],
    } as unknown as Awaited<ReturnType<typeof getPurchaseOrder>>)
    vi.mocked(query)
      .mockResolvedValueOnce([{ key: "purchasing.three_way_tolerance_pct", value: "1" }])
      .mockResolvedValueOnce([{ total: 10_200, invoice_total: 10_000 }])
    const result = await threeWayMatch("po-1")
    expect(result.ok).toBe(false)
    expect(result.maxVariancePct).toBeCloseTo(2, 1)
    expect(result.summary).toContain("exceeds")
  })

  it("works with no invoice total yet (PO + GRN only)", async () => {
    vi.mocked(getPurchaseOrder).mockResolvedValueOnce({
      po: { total: 10_000 },
      items: [],
    } as unknown as Awaited<ReturnType<typeof getPurchaseOrder>>)
    vi.mocked(query)
      .mockResolvedValueOnce([{ key: "purchasing.three_way_tolerance_pct", value: "1" }])
      .mockResolvedValueOnce([{ total: 10_000, invoice_total: null }])
    const result = await threeWayMatch("po-1")
    expect(result.ok).toBe(true)
    expect(result.invoiceTotal).toBeNull()
  })

  it("sums multi-receipt + multi-invoice totals", async () => {
    vi.mocked(getPurchaseOrder).mockResolvedValueOnce({
      po: { total: 10_000 },
      items: [],
    } as unknown as Awaited<ReturnType<typeof getPurchaseOrder>>)
    vi.mocked(query)
      .mockResolvedValueOnce([{ key: "purchasing.three_way_tolerance_pct", value: "1" }])
      .mockResolvedValueOnce([
        { total: 6_000, invoice_total: 6_000 },
        { total: 4_000, invoice_total: 4_000 },
      ])
    const result = await threeWayMatch("po-1")
    expect(result.ok).toBe(true)
    expect(result.grnTotal).toBe(10_000)
    expect(result.invoiceTotal).toBe(10_000)
  })

  it("ignores reversed GRNs (filtered by SQL)", async () => {
    // Filter happens in the SQL — we just assert the function uses the
    // already-filtered rows it gets back.
    vi.mocked(getPurchaseOrder).mockResolvedValueOnce({
      po: { total: 5_000 },
      items: [],
    } as unknown as Awaited<ReturnType<typeof getPurchaseOrder>>)
    vi.mocked(query)
      .mockResolvedValueOnce([{ key: "purchasing.three_way_tolerance_pct", value: "1" }])
      .mockResolvedValueOnce([{ total: 5_000, invoice_total: 5_000 }])
    const result = await threeWayMatch("po-1")
    expect(result.ok).toBe(true)
  })
})
