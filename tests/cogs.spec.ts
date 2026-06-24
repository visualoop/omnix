/**
 * COGS resolution tests — verify the 4-step cost fallback chain matches
 * the spec in services/cogs.ts.
 *
 * Tests both shapes:
 *   - resolveCogs(ctx)  the JS reference implementation, used per-row
 *   - cogsExpr(alias)   the SQL fragment string, asserts the COALESCE
 *                       chain emits in the right order
 */
import { describe, it, expect } from "vitest"
import { resolveCogs, cogsExpr, cogsExprForReturn } from "@/services/cogs"

describe("resolveCogs", () => {
  it("uses the batch's buying_price when batch_id is set + resolves", () => {
    const r = resolveCogs({
      saleItemBatchId: "batch-1",
      productId: "p1",
      batchPriceById: (id) => (id === "batch-1" ? 25 : null),
    })
    expect(r).toEqual({ cost: 25, source: "batch" })
  })

  it("falls back to most-recent batch for the product when batch_id is null", () => {
    const r = resolveCogs({
      saleItemBatchId: null,
      productId: "p1",
      recentBatchPriceForProduct: (pid) => (pid === "p1" ? 20 : null),
    })
    expect(r).toEqual({ cost: 20, source: "recent_batch" })
  })

  it("falls back to most-recent batch when batch_id resolves to null too", () => {
    const r = resolveCogs({
      saleItemBatchId: "stale-batch-deleted",
      productId: "p1",
      batchPriceById: () => null, // stale id
      recentBatchPriceForProduct: (pid) => (pid === "p1" ? 18 : null),
    })
    expect(r).toEqual({ cost: 18, source: "recent_batch" })
  })

  it("falls back to default price-list buying_price when no batches exist", () => {
    const r = resolveCogs({
      saleItemBatchId: null,
      productId: "p1",
      defaultPriceListPrice: (pid) => (pid === "p1" ? 15 : null),
    })
    expect(r).toEqual({ cost: 15, source: "default_price" })
  })

  it("returns 0 + 'missing' when nothing resolves (the user's bug case)", () => {
    const r = resolveCogs({
      saleItemBatchId: null,
      productId: "p-no-cost",
    })
    expect(r).toEqual({ cost: 0, source: "missing" })
  })

  it("respects priority — batch wins over recent + default", () => {
    const r = resolveCogs({
      saleItemBatchId: "b-active",
      productId: "p1",
      batchPriceById: (id) => (id === "b-active" ? 30 : null),
      recentBatchPriceForProduct: () => 20,
      defaultPriceListPrice: () => 15,
    })
    // Batch wins. Doesn't fall through.
    expect(r).toEqual({ cost: 30, source: "batch" })
  })
})

describe("cogsExpr (SQL fragment)", () => {
  it("emits COALESCE chain in the right priority order", () => {
    const sql = cogsExpr("si")
    // Look for the four COALESCE arguments in order: batch_id lookup, recent batch, default price list, 0.
    expect(sql).toMatch(/COALESCE\s*\(/)
    expect(sql).toMatch(/b1\.id\s*=\s*si\.batch_id/) // step 1
    expect(sql).toMatch(/b2\.product_id\s*=\s*si\.product_id[\s\S]*?ORDER BY b2\.received_at DESC LIMIT 1/) // step 2
    expect(sql).toMatch(/pp\.product_id\s*=\s*si\.product_id[\s\S]*?is_default\s*=\s*1/) // step 3
    // Step 4: fallback 0 must come last in the COALESCE.
    const lastComma = sql.lastIndexOf(",")
    const tail = sql.slice(lastComma).replace(/\s/g, "")
    expect(tail).toMatch(/^,0\)$/)
  })

  it("respects custom alias", () => {
    const sql = cogsExpr("xx")
    expect(sql).toContain("xx.batch_id")
    expect(sql).toContain("xx.product_id")
    expect(sql).not.toContain("si.batch_id")
  })
})

describe("cogsExprForReturn", () => {
  it("links sale_return_items back to the original sale_item's batch", () => {
    const sql = cogsExprForReturn("sri")
    expect(sql).toContain("sri.sale_item_id")
    expect(sql).toContain("sri.product_id")
    // Step 4 fallback to 0
    const lastComma = sql.lastIndexOf(",")
    const tail = sql.slice(lastComma).replace(/\s/g, "")
    expect(tail).toMatch(/^,0\)$/)
  })
})
