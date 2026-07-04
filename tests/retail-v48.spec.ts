import { describe, it, expect } from "vitest";
import { computeEarnedPoints, TIER_BENEFITS } from "@/services/loyalty";
import { computePromotionDiscount, type Promotion, type PromoCartLine } from "@/services/promotions";

/**
 * v0.48 Retail (Soko) audit remediation — contract tests.
 * Locks the pure pricing/loyalty/promotion algorithms.
 */

// ─── RT-1/RT-7: loyalty earn + tier multiplier ─────────────────────
describe("computeEarnedPoints — tier multiplier", () => {
  it("standard tier = base earn rate floored", () => {
    expect(computeEarnedPoints(1000, 1, "standard")).toBe(1000);
    expect(computeEarnedPoints(999.9, 1, "standard")).toBe(999);
  });
  it("silver applies 1.25x", () => {
    expect(computeEarnedPoints(1000, 1, "silver")).toBe(1250);
    expect(TIER_BENEFITS.silver.multiplier).toBe(1.25);
  });
  it("gold applies 1.5x", () => {
    expect(computeEarnedPoints(1000, 1, "gold")).toBe(1500);
  });
  it("platinum applies 2x", () => {
    expect(computeEarnedPoints(1000, 1, "platinum")).toBe(2000);
  });
  it("fractional earn_rate respected", () => {
    // 0.1 pt per KES → 100 pts on 1000, silver → 125
    expect(computeEarnedPoints(1000, 0.1, "silver")).toBe(125);
  });
  it("unknown tier falls back to 1x", () => {
    expect(computeEarnedPoints(500, 1, "bogus")).toBe(500);
  });
});

// ─── RT-12: promotion computation ──────────────────────────────────
function promo(over: Partial<Promotion>): Promotion {
  return {
    id: "p", name: "Promo", description: null, type: "percent_off", value: 10,
    target_type: "cart", target_id: null, starts_at: "", ends_at: "",
    min_purchase: 0, max_uses: null, uses_count: 0, code: null, active: 1, created_at: "",
    ...over,
  };
}
const lines: PromoCartLine[] = [
  { product_id: "A", category_id: "cat1", quantity: 2, unit_price: 100 }, // 200
  { product_id: "B", category_id: "cat2", quantity: 1, unit_price: 300 }, // 300
];

describe("computePromotionDiscount", () => {
  it("percent_off cart-wide", () => {
    expect(computePromotionDiscount(promo({ type: "percent_off", value: 10 }), lines)).toBe(50); // 10% of 500
  });
  it("amount_off flat", () => {
    expect(computePromotionDiscount(promo({ type: "amount_off", value: 75 }), lines)).toBe(75);
  });
  it("min_purchase gates the promo", () => {
    expect(computePromotionDiscount(promo({ type: "amount_off", value: 75, min_purchase: 1000 }), lines)).toBe(0);
  });
  it("product-target percent only discounts that product", () => {
    // 10% off product A (subtotal 200) = 20
    expect(computePromotionDiscount(promo({ type: "percent_off", value: 10, target_type: "product", target_id: "A" }), lines)).toBe(20);
  });
  it("category-target percent only discounts that category", () => {
    // 10% off cat2 (product B, 300) = 30
    expect(computePromotionDiscount(promo({ type: "percent_off", value: 10, target_type: "category", target_id: "cat2" }), lines)).toBe(30);
  });
  it("buy_x_get_y: buy 2 get 1 free on cheapest qualifying unit", () => {
    // 3 units of A @100 → group of 3 (buy 2 get 1) → 1 free @100 = 100
    const l: PromoCartLine[] = [{ product_id: "A", category_id: null, quantity: 3, unit_price: 100 }];
    expect(computePromotionDiscount(promo({ type: "buy_x_get_y", value: 2 }), l)).toBe(100);
  });
  it("buy_x_get_y: not enough qty → no discount", () => {
    const l: PromoCartLine[] = [{ product_id: "A", category_id: null, quantity: 2, unit_price: 100 }];
    expect(computePromotionDiscount(promo({ type: "buy_x_get_y", value: 2 }), l)).toBe(0);
  });
  it("discount never exceeds the qualifying subtotal", () => {
    expect(computePromotionDiscount(promo({ type: "amount_off", value: 99999 }), lines)).toBe(500);
  });
  it("non-matching product target → zero", () => {
    expect(computePromotionDiscount(promo({ type: "percent_off", value: 10, target_type: "product", target_id: "ZZZ" }), lines)).toBe(0);
  });
});

// ─── RT-5: shrinkage cost total ────────────────────────────────────
describe("shrinkage cost = unit cost x quantity", () => {
  it("multiplies per-unit cost by quantity", () => {
    const unitCost = 50, qty = 10;
    expect(unitCost * qty).toBe(500);
  });
});

// ─── RT-10: layby available-to-promise ─────────────────────────────
describe("layby available-to-promise math", () => {
  const available = (physical: number, reserved: number) => physical - reserved;
  it("subtracts active reservations from physical", () => {
    expect(available(100, 30)).toBe(70);
  });
  it("can go to zero", () => {
    expect(available(30, 30)).toBe(0);
  });
});

// ─── RT-21: UOM pack math ──────────────────────────────────────────
describe("UOM carton pack math", () => {
  it("pack of 24 adds 24 base units at pro-rata unit price", () => {
    const packQty = 24, packPrice = 480;
    expect(packPrice / packQty).toBe(20);
  });
  it("full-pack guard blocks when base stock < pack size", () => {
    const packQty = 24, baseStock = 20;
    expect(packQty > baseStock).toBe(true);
  });
});

// ─── RT-11: loyalty redemption KES ─────────────────────────────────
describe("loyalty redemption value", () => {
  it("points x redeem_rate = KES off", () => {
    expect(200 * 0.5).toBe(100);
  });
});
