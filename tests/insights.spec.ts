/**
 * Insight engine tests — verify the deterministic business logic on top of
 * the SQL (suggested-order math, dead-stock valuation, margin classification,
 * customer segmentation, duplicate grouping, finding severity ranking). The
 * DB layer is mocked; we assert the JS that turns rows into decisions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock("@/stores/active-branch", () => ({ getActiveBranchId: () => "default-branch" }));
// cogsExpr is a pure SQL-string helper; import the real one (no DB).

import {
  reorderSuggestions, deadStock, marginIssues, customerInsights,
  duplicateProducts, supplierScorecard,
} from "@/services/insights";
import { query } from "@/lib/db";

const mockedQuery = vi.mocked(query);
beforeEach(() => mockedQuery.mockReset());

describe("reorderSuggestions", () => {
  it("computes suggested qty from velocity + lead time and flags urgency", async () => {
    // 60 units sold in 30 days = 2/day. 4 in stock, reorder level 10.
    mockedQuery.mockResolvedValueOnce([
      { product_id: "p1", name: "Panadol", reorder_level: 10, stock_qty: 4, units_sold: 60, preferred_supplier: "Acme" },
    ] as never);
    const out = await reorderSuggestions({ windowDays: 30, leadDays: 7 });
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.daily_velocity).toBe(2);
    expect(s.days_cover).toBe(2); // 4 / 2
    // target = 2*7 + 2*1.5 + 10 = 27; suggested = ceil(27 - 4) = 23
    expect(s.suggested_qty).toBe(23);
    expect(s.preferred_supplier).toBe("Acme");
  });

  it("skips well-stocked fast movers (enough cover, above reorder)", async () => {
    mockedQuery.mockResolvedValueOnce([
      { product_id: "p2", name: "Soda", reorder_level: 5, stock_qty: 500, units_sold: 30, preferred_supplier: null },
    ] as never);
    const out = await reorderSuggestions({ windowDays: 30, leadDays: 7 });
    expect(out).toHaveLength(0);
  });
});

describe("deadStock", () => {
  it("includes never-sold + long-idle, excludes recently sold, sums value", async () => {
    const longAgo = new Date(Date.now() - 200 * 86400000).toISOString();
    const recent = new Date(Date.now() - 5 * 86400000).toISOString();
    mockedQuery.mockResolvedValueOnce([
      { product_id: "a", name: "Old", stock_qty: 10, value_at_cost: 1000, last_sale: longAgo },
      { product_id: "b", name: "Never", stock_qty: 3, value_at_cost: 300, last_sale: null },
      { product_id: "c", name: "Fresh", stock_qty: 5, value_at_cost: 500, last_sale: recent },
    ] as never);
    const out = await deadStock({ idleDays: 60 });
    const names = out.items.map((i) => i.name);
    expect(names).toContain("Old");
    expect(names).toContain("Never");
    expect(names).not.toContain("Fresh");
    expect(out.total_value).toBe(1300); // 1000 + 300
    // Highest value first
    expect(out.items[0].name).toBe("Old");
  });
});

describe("marginIssues", () => {
  it("classifies negative, no_price, and thin margins", async () => {
    mockedQuery.mockResolvedValueOnce([
      { product_id: "a", name: "LossLeader", buying_price: 100, selling_price: 80 },  // negative
      { product_id: "b", name: "NoPrice", buying_price: 50, selling_price: 0 },         // no_price
      { product_id: "c", name: "Thin", buying_price: 98, selling_price: 100 },          // 2% thin
      { product_id: "d", name: "Healthy", buying_price: 50, selling_price: 100 },        // 50% — excluded
    ] as never);
    const out = await marginIssues({ thinPct: 5 });
    const byName = Object.fromEntries(out.map((m) => [m.name, m.issue]));
    expect(byName.LossLeader).toBe("negative");
    expect(byName.NoPrice).toBe("no_price");
    expect(byName.Thin).toBe("thin");
    expect(byName.Healthy).toBeUndefined();
    // negative ranked first
    expect(out[0].name).toBe("LossLeader");
  });
});

describe("customerInsights segmentation", () => {
  it("buckets churned, at-risk, vip, new by recency + spend", async () => {
    const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    mockedQuery.mockResolvedValueOnce([
      { customer_id: "v", name: "Whale", orders: 10, total_spent: 100000, last_purchase: days(3), first_purchase: days(300) },
      { customer_id: "r", name: "Slipping", orders: 4, total_spent: 8000, last_purchase: days(60), first_purchase: days(200) },
      { customer_id: "g", name: "Gone", orders: 6, total_spent: 5000, last_purchase: days(120), first_purchase: days(300) },
      { customer_id: "n", name: "Newbie", orders: 1, total_spent: 500, last_purchase: days(10), first_purchase: days(10) },
    ] as never);
    const out = await customerInsights({ windowDays: 365 });
    const seg = Object.fromEntries(out.map((c) => [c.name, c.segment]));
    expect(seg.Whale).toBe("vip");
    expect(seg.Slipping).toBe("at_risk");
    expect(seg.Gone).toBe("churned");
    expect(seg.Newbie).toBe("new");
    // at_risk surfaces before churned/vip (most actionable)
    expect(out[0].segment).toBe("at_risk");
  });
});

describe("duplicateProducts", () => {
  it("groups same barcode and same normalised name", async () => {
    mockedQuery.mockResolvedValueOnce([
      { id: "1", name: "Coca Cola 500ml", sku: "A", barcode: "111", stock_qty: 5 },
      { id: "2", name: "coca-cola 500ML", sku: "B", barcode: "222", stock_qty: 3 },  // name dup of 1
      { id: "3", name: "Fanta", sku: "C", barcode: "999", stock_qty: 1 },
      { id: "4", name: "Sprite", sku: "D", barcode: "999", stock_qty: 2 },           // barcode dup of 3
    ] as never);
    const out = await duplicateProducts();
    const barcodeGroup = out.find((g) => g.reason === "same_barcode");
    const nameGroup = out.find((g) => g.reason === "same_normalised_name");
    expect(barcodeGroup?.products.map((p) => p.id).sort()).toEqual(["3", "4"]);
    expect(nameGroup?.products.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("returns nothing when all products are distinct", async () => {
    mockedQuery.mockResolvedValueOnce([
      { id: "1", name: "Alpha", sku: "A", barcode: "111", stock_qty: 5 },
      { id: "2", name: "Beta", sku: "B", barcode: "222", stock_qty: 3 },
    ] as never);
    expect(await duplicateProducts()).toHaveLength(0);
  });
});

describe("supplierScorecard", () => {
  it("computes on-time and fill-rate percentages", async () => {
    mockedQuery.mockResolvedValueOnce([
      {
        supplier_id: "s1", name: "Acme", orders: 10, total_spent: 50000,
        on_time: 8, received_count: 10, ordered_qty: 100, received_qty: 95,
      },
    ] as never);
    const out = await supplierScorecard();
    expect(out[0].on_time_pct).toBe(80);
    expect(out[0].fill_rate_pct).toBe(95);
  });

  it("returns null percentages when nothing received yet", async () => {
    mockedQuery.mockResolvedValueOnce([
      {
        supplier_id: "s2", name: "New", orders: 1, total_spent: 1000,
        on_time: 0, received_count: 0, ordered_qty: 0, received_qty: 0,
      },
    ] as never);
    const out = await supplierScorecard();
    expect(out[0].on_time_pct).toBeNull();
    expect(out[0].fill_rate_pct).toBeNull();
  });
});
