/**
 * Multi-license business-logic tests.
 *
 * Covers the pure helpers that drive the activation + sync flow:
 *   - isVariantConflict — Pro vs trade, trade vs same trade
 *   - describeOwnedVariants — dedup + sort + label
 */
import { describe, it, expect } from "vitest"
import { describeOwnedVariants, type LicenseVariant } from "@/services/local-licenses"

/**
 * Mirror of the server-side rule from /api/licensing/activate. Kept
 * inline so the test doesn't have to import a Next.js server module.
 */
function isVariantConflict(existing: string, incoming: string): boolean {
  if (existing === incoming) return true
  if (existing === "pro" || incoming === "pro") return true
  return false
}

describe("isVariantConflict", () => {
  it("same trade variant on the same machine → conflict", () => {
    expect(isVariantConflict("dawa", "dawa")).toBe(true)
    expect(isVariantConflict("retail", "retail")).toBe(true)
  })

  it("pro vs any trade → conflict (in either direction)", () => {
    expect(isVariantConflict("pro", "dawa")).toBe(true)
    expect(isVariantConflict("dawa", "pro")).toBe(true)
    expect(isVariantConflict("pro", "hospitality")).toBe(true)
    expect(isVariantConflict("hardware", "pro")).toBe(true)
  })

  it("two different trade variants → ok", () => {
    expect(isVariantConflict("dawa", "retail")).toBe(false)
    expect(isVariantConflict("retail", "hospitality")).toBe(false)
    expect(isVariantConflict("hospitality", "hardware")).toBe(false)
    expect(isVariantConflict("hardware", "dawa")).toBe(false)
  })

  it("two pros on the same machine → conflict (one Pro is enough)", () => {
    expect(isVariantConflict("pro", "pro")).toBe(true)
  })
})

describe("describeOwnedVariants", () => {
  it("formats a single variant", () => {
    expect(describeOwnedVariants(["dawa"])).toBe("Dawa")
    expect(describeOwnedVariants(["pro"])).toBe("Pro (all trades)")
  })

  it("dedups + joins with ' + '", () => {
    expect(describeOwnedVariants(["dawa", "retail"])).toBe("Dawa + Retail")
    expect(describeOwnedVariants(["dawa", "dawa", "retail"])).toBe("Dawa + Retail")
  })

  it("sorts so output is stable regardless of input order", () => {
    expect(describeOwnedVariants(["retail", "dawa", "hospitality"])).toBe(
      describeOwnedVariants(["hospitality", "retail", "dawa"]),
    )
  })

  it("returns empty string for zero variants", () => {
    expect(describeOwnedVariants([])).toBe("")
  })

  it("handles all five variants", () => {
    const all: LicenseVariant[] = ["pro", "dawa", "retail", "hospitality", "hardware"]
    const result = describeOwnedVariants(all)
    expect(result).toContain("Dawa")
    expect(result).toContain("Hardware")
    expect(result).toContain("Hospitality")
    expect(result).toContain("Pro (all trades)")
    expect(result).toContain("Retail")
  })
})
