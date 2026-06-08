/**
 * Variant-aware system prompt tests.
 *
 * Each variant should bias the prompt toward its trade vocabulary +
 * suggested routes, and never mention modules it doesn't ship.
 */
import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "@/services/ai/system-prompt"

describe("buildSystemPrompt — variant persona biases", () => {
  it("Pro keeps a generic, multi-trade voice", () => {
    const p = buildSystemPrompt({ variant: "pro" })
    expect(p).toContain("multi-trade variant")
    expect(p).not.toMatch(/\bnever mention\b/i)
  })

  it("Dawa biases to pharmacy + hides other modules", () => {
    const p = buildSystemPrompt({ variant: "dawa" })
    expect(p).toContain("pharmacy variant")
    expect(p).toContain("/pharmacy")
    expect(p).toContain("/claims")
    expect(p).toContain("controlled-register")
    expect(p).toContain("Never mention hospitality, retail laybys, or hardware")
  })

  it("Retail biases to shop vocabulary", () => {
    const p = buildSystemPrompt({ variant: "retail" })
    expect(p).toContain("shops variant")
    expect(p).toContain("/retail/laybys")
    expect(p).toContain("/retail/special-orders")
    expect(p).toContain("mama-mboga")
    expect(p).toContain("Never mention pharmacy/dispensing, hospitality menus, or hardware")
  })

  it("Hospitality biases to restaurant + lodge vocabulary", () => {
    const p = buildSystemPrompt({ variant: "hospitality" })
    expect(p).toContain("restaurant + lodge variant")
    expect(p).toContain("/hospitality/tables")
    expect(p).toContain("/hospitality/kitchen")
    expect(p).toContain("karibu")
    expect(p).toContain("Never mention pharmacy/SHA, retail laybys, or hardware")
  })

  it("Hardware biases to contractor + quotation vocabulary", () => {
    const p = buildSystemPrompt({ variant: "hardware" })
    expect(p).toContain("hardware-store variant")
    expect(p).toContain("/hardware/quotations")
    expect(p).toContain("/hardware/delivery-notes")
    expect(p).toContain("contractor")
    expect(p).toContain("Never mention pharmacy, hospitality menus, or retail laybys")
  })

  it("undefined variant falls through to Pro persona block", () => {
    const p = buildSystemPrompt({})
    expect(p).toContain("multi-trade variant")
  })

  it("greeting + user name appear when supplied", () => {
    const p = buildSystemPrompt({ variant: "dawa", userName: "Jane Mwangi" })
    expect(p).toContain(", Jane")
  })
})
