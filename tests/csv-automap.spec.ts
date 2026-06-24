/**
 * CSV header auto-mapping tests — covers the variants users actually
 * paste into our import flow (English, Swahili, mixed casing, with
 * punctuation, partial coverage).
 */
import { describe, it, expect } from "vitest"
import {
  mapHeaders,
  normaliseHeader,
  projectRow,
} from "@/services/csv-automap"

describe("normaliseHeader", () => {
  it("lowercases + trims", () => {
    expect(normaliseHeader("  Name  ")).toBe("name")
  })

  it("collapses spaces to underscores", () => {
    expect(normaliseHeader("Buying Price")).toBe("buying_price")
  })

  it("strips punctuation", () => {
    expect(normaliseHeader("Bei ya Kuuza!")).toBe("bei_ya_kuuza")
  })

  it("strips BOM", () => {
    expect(normaliseHeader("\uFEFFname")).toBe("name")
  })

  it("collapses repeated separators", () => {
    expect(normaliseHeader("buying___price")).toBe("buying_price")
    expect(normaliseHeader("buying--price")).toBe("buying_price")
  })
})

describe("mapHeaders — English happy path", () => {
  it("maps the canonical template exactly", () => {
    const r = mapHeaders([
      "name",
      "sku",
      "barcode",
      "unit",
      "buying_price",
      "selling_price",
      "initial_stock",
      "reorder_level",
      "tax_rate",
    ])
    expect(r.mapped).toEqual([
      "name",
      "sku",
      "barcode",
      "unit",
      "buying_price",
      "selling_price",
      "initial_stock",
      "reorder_level",
      "tax_rate",
    ])
    expect(r.missingRequired).toEqual([])
    expect(r.unmappedHeaders).toEqual([])
  })

  it("maps short-form English (name, buy, sell, qty)", () => {
    const r = mapHeaders(["name", "buy", "sell", "qty"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price", "initial_stock"])
    expect(r.missingRequired).toEqual([])
  })

  it("maps wholesale/retail synonyms", () => {
    const r = mapHeaders(["product", "wholesale", "retail"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price"])
    expect(r.missingRequired).toEqual([])
  })

  it("handles title case + extra whitespace", () => {
    const r = mapHeaders(["  Name  ", "Buying Price ", " Selling Price"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price"])
    expect(r.missingRequired).toEqual([])
  })

  it("handles ALL CAPS headers", () => {
    const r = mapHeaders(["NAME", "BUYING_PRICE", "SELLING_PRICE", "STOCK"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price", "initial_stock"])
  })
})

describe("mapHeaders — Swahili", () => {
  it("maps the basic Swahili headers", () => {
    const r = mapHeaders(["Bidhaa", "Bei ya Kununua", "Bei ya Kuuza"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price"])
    expect(r.missingRequired).toEqual([])
  })

  it("maps mixed Swahili + English", () => {
    const r = mapHeaders([
      "Jina la Bidhaa",
      "SKU",
      "Bei ya Kununua",
      "Selling Price",
      "Idadi",
    ])
    expect(r.mapped).toEqual([
      "name",
      "sku",
      "buying_price",
      "selling_price",
      "initial_stock",
    ])
    expect(r.missingRequired).toEqual([])
  })

  it("maps Swahili with punctuation + casing variation", () => {
    const r = mapHeaders(["BIDHAA!", "  bei ya kununua  ", "Bei-ya-Kuuza"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price"])
  })
})

describe("mapHeaders — edge cases", () => {
  it("flags missing required columns", () => {
    const r = mapHeaders(["name", "selling_price"]) // missing buying_price
    expect(r.missingRequired).toEqual(["buying_price"])
  })

  it("collects unmapped headers separately", () => {
    const r = mapHeaders(["name", "buying", "selling", "weird_col_xyz", "notes"])
    expect(r.mapped).toEqual([
      "name",
      "buying_price",
      "selling_price",
      null,
      "description", // notes → description
    ])
    expect(r.unmappedHeaders).toEqual(["weird_col_xyz"])
  })

  it("does not crash on garbage / empty headers", () => {
    const r = mapHeaders(["", "  ", "?!?"])
    // empty + whitespace-only headers should map to null without throwing
    expect(r.mapped).toEqual([null, null, null])
    expect(r.missingRequired).toEqual(["name", "buying_price", "selling_price"])
  })

  it("handles partial coverage — gives best-effort mapping", () => {
    const r = mapHeaders(["item_name", "cost", "msrp", "barcode_ean"])
    expect(r.mapped).toEqual(["name", "buying_price", "selling_price", "barcode"])
    expect(r.missingRequired).toEqual([])
  })

  it("does not double-flag when a synonym + canonical both appear", () => {
    // "name" + "product" both map to name. mapHeaders should still count
    // 'name' as seen so missingRequired doesn't include it.
    const r = mapHeaders(["product", "name", "buying_price", "selling_price"])
    expect(r.mapped).toEqual(["name", "name", "buying_price", "selling_price"])
    expect(r.missingRequired).toEqual([])
  })
})

describe("projectRow", () => {
  it("projects a row onto canonical column names", () => {
    const headers = ["Bidhaa", "Bei ya Kununua", "Bei ya Kuuza"]
    const { mapped } = mapHeaders(headers)
    const row = ["Paracetamol", "2.50", "5.00"]
    const projected = projectRow(row, mapped)
    expect(projected).toEqual({
      name: "Paracetamol",
      buying_price: "2.50",
      selling_price: "5.00",
    })
  })

  it("drops cells whose header didn't map", () => {
    const { mapped } = mapHeaders(["name", "weird_col", "buying_price", "selling_price"])
    const row = ["Pcm", "discardme", "2", "5"]
    const projected = projectRow(row, mapped)
    expect(projected).toEqual({ name: "Pcm", buying_price: "2", selling_price: "5" })
  })

  it("trims cell whitespace", () => {
    const { mapped } = mapHeaders(["name", "buying_price", "selling_price"])
    const projected = projectRow(["  Pcm  ", " 2 ", "5"], mapped)
    expect(projected).toEqual({ name: "Pcm", buying_price: "2", selling_price: "5" })
  })
})
