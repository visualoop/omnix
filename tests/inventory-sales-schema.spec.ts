/**
 * Schema smoke tests for v0.31.0 batch: period close, debit notes,
 * supplier returns, approvals, bundles, serials, cycle counts, damages,
 * reorder suggestions, customer groups, coupons, gift cards, discount rules,
 * sales targets, commissions.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

const TABLES = [
  "financial_years",
  "accounting_periods",
  "debit_notes",
  "debit_note_items",
  "supplier_returns",
  "supplier_return_items",
  "approval_rules",
  "approval_requests",
  "bundle_components",
  "product_serials",
  "cycle_count_schedules",
  "cycle_counts",
  "cycle_count_items",
  "damages",
  "reorder_suggestions",
  "customer_groups",
  "coupons",
  "coupon_redemptions",
  "gift_cards",
  "gift_card_transactions",
  "discount_rules",
  "sales_targets",
  "commissions",
  "commission_ledger",
];

describe("SQL smoke — v0.31.0 batch tables exist", () => {
  it.each(TABLES)("%s exists", async (name) => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [name],
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("SQL smoke — approval rules seeded", () => {
  it("has PO threshold rules for 30k + 100k", async () => {
    const db = await openTestDb();
    const [r] = db.exec(
      `SELECT COUNT(*) FROM approval_rules WHERE kind = 'purchase_order' AND active = 1`,
    );
    expect(Number(r.values[0][0])).toBeGreaterThanOrEqual(2);
  });
});

describe("SQL smoke — customer_group_id column on customers", () => {
  it("column exists (was created in migration 002)", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(customers)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("customer_group_id");
  });
});

describe("SQL smoke — bundle insert + parent/child relation", () => {
  it("bundle_components can link two products", async () => {
    const db = await openTestDb();
    // Two products with the required NOT NULL columns
    db.run(
      `INSERT INTO products (id, name, sku, unit, category_id, active)
       VALUES ('p-bundle', 'Gift set', 'GS1', 'pcs', NULL, 1),
              ('p-soap', 'Soap', 'S1', 'pcs', NULL, 1)`,
    );
    db.run(
      `INSERT INTO bundle_components (id, bundle_product_id, component_product_id, quantity)
       VALUES ('b1', 'p-bundle', 'p-soap', 1)`,
    );
    const [r] = db.exec(
      `SELECT COUNT(*) FROM bundle_components WHERE bundle_product_id = 'p-bundle'`,
    );
    expect(r.values[0][0]).toBe(1);
  });
});

describe("SQL smoke — gift card balance flow", () => {
  it("issue + redeem preserves balance invariant", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO gift_cards (id, code, initial_balance, current_balance)
       VALUES ('gc1', 'GC-12345', 5000, 5000)`,
    );
    // Redeem 2000
    db.run(
      `INSERT INTO gift_card_transactions (id, gift_card_id, amount, balance_after)
       VALUES ('gct1', 'gc1', -2000, 3000)`,
    );
    db.run(`UPDATE gift_cards SET current_balance = 3000 WHERE id = 'gc1'`);
    const [r] = db.exec(`SELECT current_balance FROM gift_cards WHERE id = 'gc1'`);
    expect(r.values[0][0]).toBe(3000);
  });
});

describe("SQL smoke — discount rules params column stores JSON", () => {
  it("stores + retrieves JSON blob", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO discount_rules (id, name, rule_type, params, priority)
       VALUES ('d1', 'Buy 3 get 1', 'buy_x_get_y', '{"buy":3,"get_free":1}', 200)`,
    );
    const [r] = db.exec(`SELECT params FROM discount_rules WHERE id = 'd1'`);
    expect(JSON.parse(String(r.values[0][0]))).toEqual({ buy: 3, get_free: 1 });
  });
});
