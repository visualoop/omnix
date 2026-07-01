/**
 * Tax computation invariants — locks the three-mode contract so a
 * future refactor can't silently break the shopkeeper's till.
 *
 * Modes verified:
 *   - off        → no tax, subtotal == total (minus discount)
 *   - inclusive  → tax already inside the sticker price; back-out for reporting
 *   - exclusive  → tax added on top at checkout (KE default)
 *
 * Also covers cart-level extras (tip, service charge, cart discount)
 * which never carry tax.
 */
import { describe, it, expect } from "vitest";
import { computeTax, type TaxSettings } from "@/services/tax";

const off: TaxSettings = { mode: "off", defaultRate: 16, label: "VAT" };
const inclusive: TaxSettings = { mode: "inclusive", defaultRate: 16, label: "VAT" };
const exclusive: TaxSettings = { mode: "exclusive", defaultRate: 16, label: "VAT" };

describe("computeTax — mode: off", () => {
  it("subtotal == total, no tax", () => {
    const r = computeTax([{ unit_price: 100, quantity: 2, discount: 0, tax_rate: 16 }], off);
    expect(r.taxAmount).toBe(0);
    expect(r.subtotal).toBe(200);
    expect(r.total).toBe(200);
    expect(r.mode).toBe("off");
  });

  it("respects cart discount", () => {
    const r = computeTax(
      [{ unit_price: 100, quantity: 2, discount: 0, tax_rate: 16 }],
      off,
      { cartDiscount: 50 },
    );
    expect(r.total).toBe(150);
  });

  it("adds tip + service charge tax-free", () => {
    const r = computeTax(
      [{ unit_price: 100, quantity: 1, discount: 0, tax_rate: 16 }],
      off,
      { tip: 10, serviceCharge: 5 },
    );
    expect(r.total).toBe(115);
    expect(r.taxAmount).toBe(0);
  });
});

describe("computeTax — mode: inclusive (tax already inside sticker price)", () => {
  it("backs out 16% VAT correctly", () => {
    // KES 116 gross at 16% inclusive → tax = 16, base = 100
    const r = computeTax([{ unit_price: 116, quantity: 1, discount: 0, tax_rate: 16 }], inclusive);
    expect(r.taxAmount).toBeCloseTo(16, 2);
    expect(r.subtotal).toBeCloseTo(100, 2);
    expect(r.total).toBe(116);
  });

  it("total stays == gross when nothing extra", () => {
    // The customer pays what the shelf says.
    const r = computeTax([{ unit_price: 500, quantity: 3, discount: 0, tax_rate: 16 }], inclusive);
    expect(r.total).toBe(1500);
  });

  it("line discount reduces base before back-out", () => {
    const r = computeTax(
      [{ unit_price: 116, quantity: 2, discount: 16, tax_rate: 16 }],
      inclusive,
    );
    // Line net = 116 * 2 - 16 = 216. Tax = 216 * 16/116 ≈ 29.79
    expect(r.total).toBe(216);
    expect(r.taxAmount).toBeCloseTo(29.79, 2);
  });

  it("tax-free lines (rate=0) contribute nothing to taxAmount", () => {
    const r = computeTax(
      [
        { unit_price: 100, quantity: 1, discount: 0, tax_rate: 0 },   // exempt
        { unit_price: 116, quantity: 1, discount: 0, tax_rate: 16 },  // taxed
      ],
      inclusive,
    );
    expect(r.taxAmount).toBeCloseTo(16, 2);
    expect(r.total).toBe(216);
  });

  it("mixes zero-rate + standard-rate correctly", () => {
    const r = computeTax(
      [
        { unit_price: 232, quantity: 1, discount: 0, tax_rate: 16 },  // 32 tax
        { unit_price: 50, quantity: 2, discount: 0, tax_rate: 0 },    // exempt
      ],
      inclusive,
    );
    expect(r.taxAmount).toBeCloseTo(32, 2);
    expect(r.total).toBe(332);
  });
});

describe("computeTax — mode: exclusive (tax added on top)", () => {
  it("adds 16% VAT on top", () => {
    const r = computeTax([{ unit_price: 100, quantity: 1, discount: 0, tax_rate: 16 }], exclusive);
    expect(r.subtotal).toBe(100);
    expect(r.taxAmount).toBe(16);
    expect(r.total).toBe(116);
  });

  it("multiple lines, mixed rates", () => {
    const r = computeTax(
      [
        { unit_price: 100, quantity: 2, discount: 0, tax_rate: 16 },  // 200, 32 tax
        { unit_price: 50, quantity: 1, discount: 0, tax_rate: 0 },    // 50, exempt
      ],
      exclusive,
    );
    expect(r.subtotal).toBe(250);
    expect(r.taxAmount).toBe(32);
    expect(r.total).toBe(282);
  });

  it("respects line discount", () => {
    const r = computeTax(
      [{ unit_price: 100, quantity: 2, discount: 20, tax_rate: 16 }],
      exclusive,
    );
    // Net line = 200 - 20 = 180. Tax = 180 * 0.16 = 28.8. Total = 208.8
    expect(r.subtotal).toBe(180);
    expect(r.taxAmount).toBe(28.8);
    expect(r.total).toBe(208.8);
  });

  it("adds tip + service charge AFTER tax (tax-free)", () => {
    const r = computeTax(
      [{ unit_price: 100, quantity: 1, discount: 0, tax_rate: 16 }],
      exclusive,
      { tip: 10, serviceCharge: 5 },
    );
    // 100 + 16 tax + 10 tip + 5 sc = 131
    expect(r.taxAmount).toBe(16);
    expect(r.total).toBe(131);
  });

  it("cart-level discount reduces the total but not the line tax", () => {
    // Cart-level discount is applied to the total, not the line tax base.
    // This matches shop reality: "10% off the whole bill" doesn't rebase tax.
    const r = computeTax(
      [{ unit_price: 100, quantity: 1, discount: 0, tax_rate: 16 }],
      exclusive,
      { cartDiscount: 20 },
    );
    // total = 100 - 20 + 16 = 96
    expect(r.taxAmount).toBe(16);
    expect(r.total).toBe(96);
  });
});

describe("computeTax — no negative totals", () => {
  it("clamps at 0 even when discount exceeds gross", () => {
    const r = computeTax(
      [{ unit_price: 100, quantity: 1, discount: 200, tax_rate: 16 }],
      exclusive,
    );
    expect(r.subtotal).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(0);
  });

  it("clamps at 0 when cart-level discount is huge", () => {
    const r = computeTax(
      [{ unit_price: 50, quantity: 1, discount: 0, tax_rate: 16 }],
      exclusive,
      { cartDiscount: 200 },
    );
    expect(r.total).toBe(0);
  });
});
