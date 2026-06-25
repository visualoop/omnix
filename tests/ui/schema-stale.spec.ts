/**
 * Schema-stale query regression guard.
 *
 * Runs `scripts/audit-codebase.mjs --json` and asserts there are zero
 * `error` severity findings. The audit script is the source of truth
 * for "does this codebase have any queries that reference renamed-away
 * columns" (selling_price after migration 0016, etc.).
 *
 * If this test fails, the build broke a SQL query. Fix it before merging.
 */
import { describe, it, expect } from "vitest"
import { execSync } from "node:child_process"
import { resolve } from "node:path"

describe("schema-stale query regression guard", () => {
  it("audit-codebase.mjs reports zero error-severity findings", () => {
    const script = resolve(process.cwd(), "scripts/audit-codebase.mjs")
    const out = execSync(`node ${script} --json`, { encoding: "utf8" })
    const findings = JSON.parse(out) as Array<{
      file: string
      rule: string
      severity: "error" | "warning" | "info"
      hits: Array<{ kind: string; snippet: string }>
    }>
    const errors = findings.filter((f) => f.severity === "error")
    if (errors.length > 0) {
      const detail = errors
        .map(
          (e) =>
            `\n  ${e.file} (${e.rule})\n` +
            e.hits.map((h) => `    ${h.kind}: ${h.snippet}`).join("\n"),
        )
        .join("\n")
      throw new Error(`Schema-stale query bugs found:${detail}`)
    }
    expect(errors).toEqual([])
  })
})
