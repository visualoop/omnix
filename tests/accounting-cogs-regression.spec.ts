/**
 * P&L COGS regression lock.
 *
 * The original bug: services/accounting.ts had a COGS query that did
 *   SELECT SUM(COALESCE(b.buying_price, 0) * qty) ...
 *     LEFT JOIN batches b ON b.id = si.batch_id
 * which returned 0 when batch_id was NULL — so gross_profit = revenue
 * for any sale not linked to a specific batch (most retail sales).
 *
 * The fix: services/cogs.ts ships a 4-step fallback (cogsExpr) that
 * accounting.ts now imports + uses inside the COGS query.
 *
 * This test fails if either:
 *   1. accounting.ts stops importing cogsExpr / cogsExprForReturn
 *   2. accounting.ts reverts to a bare-batch COGS query without fallback
 *
 * Output: a pure source-text scan, no DB needed. Cheap + fast.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const accountingSource = readFileSync(
  resolve(process.cwd(), "src/services/accounting.ts"),
  "utf-8",
)

describe("accounting.ts COGS regression", () => {
  it("imports the cogsExpr helper", () => {
    expect(accountingSource).toMatch(/from\s+["']@\/services\/cogs["']/)
    expect(accountingSource).toContain("cogsExpr")
  })

  it("imports cogsExprForReturn helper", () => {
    expect(accountingSource).toContain("cogsExprForReturn")
  })

  it("uses cogsExpr in the COGS query", () => {
    // Look for a SUM(...) that includes the helper's call shape.
    expect(accountingSource).toMatch(/\$\{cogsExpr\(/)
  })

  it("uses cogsExprForReturn in the returned-COGS query", () => {
    expect(accountingSource).toMatch(/\$\{cogsExprForReturn\(/)
  })

  it("does NOT use the buggy 'COALESCE(b.buying_price, 0)' bare pattern", () => {
    // Strip line comments + block comments so doc references to the old
    // bug shape don't trigger a false positive.
    const stripped = accountingSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
    expect(stripped).not.toMatch(/COALESCE\(b\.buying_price,\s*0\)/)
  })

  it("does NOT have a LEFT JOIN batches in the COGS query (the helper handles it)", () => {
    // The cogsExpr uses correlated subqueries; a LEFT JOIN batches in
    // accounting.ts would mean someone reverted to the old shape.
    const cogsBlock = accountingSource.match(
      /COGS[^]*?(?=Expenses|otherIncome|Sales|export|$)/,
    )?.[0] ?? accountingSource
    expect(cogsBlock).not.toMatch(/LEFT JOIN\s+batches/i)
  })
})
