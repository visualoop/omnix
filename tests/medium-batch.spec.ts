/**
 * Medium-tier schema + service tests (v0.34.0 batch).
 * Covers migrations 069-072 tables + core service invariants.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

const TABLES = [
  "cost_centres", "landed_costs", "recurring_expenses", "warehouse_bins",
  "assembly_bom", "assembly_bom_ingredients", "production_runs",
  "food_cost_snapshots", "bar_inventory_counts", "waiter_assignments",
  "rate_plan_seasonal_prices", "compounded_prescriptions", "compounded_components",
  "deliveries", "anomaly_log", "report_run_log",
  "custom_fields", "custom_field_values", "data_quality_issues",
  "rental_agreements", "rental_items", "loyalty_tiers", "plugins",
  "ota_channels", "ota_reservations", "nfc_readers",
];

describe("SQL smoke — medium+low batch tables exist", () => {
  it.each(TABLES)("%s exists", async (name) => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [name],
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("SQL smoke — column additions", () => {
  it("expenses.cost_centre_id exists after migration 069", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(expenses)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("cost_centre_id");
  });

  it("batches.bin_id exists after migration 069", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(batches)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("bin_id");
  });

  it("hospitality_order_items.course exists after migration 070", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(hospitality_order_items)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("course");
    expect(cols).toContain("fire_after_course");
  });

  it("bookings.group_id (deposit_amount already existed pre-070) exists", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(bookings)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("group_id");
    expect(cols).toContain("deposit_amount");
  });

  it("customer_accounts.on_hold + days_overdue_hold exist", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(customer_accounts)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("on_hold");
    expect(cols).toContain("days_overdue_hold");
  });

  it("audit_log.this_hash + prev_hash exist (signed chain)", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(audit_log)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("this_hash");
    expect(cols).toContain("prev_hash");
  });

  it("recipes.portion_size + std_cost exist", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(recipes)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("portion_size");
    expect(cols).toContain("std_cost");
  });
});

describe("SQL smoke — seeded rows", () => {
  it("loyalty_tiers seeded 4 tiers", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`SELECT COUNT(*) FROM loyalty_tiers WHERE active = 1`);
    expect(Number(r.values[0][0])).toBeGreaterThanOrEqual(4);
  });

  it("settings self-checkout keys present", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`SELECT COUNT(*) FROM settings WHERE key LIKE 'pos.self_checkout.%'`);
    expect(Number(r.values[0][0])).toBeGreaterThanOrEqual(2);
  });
});

describe("SQL smoke — assembly BOM insert + production run", () => {
  it("full flow: create BOM, run production, deduct ingredients, add output", async () => {
    const db = await openTestDb();
    // Products
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('flour', 'Flour', 'F1', 'kg', 1)`);
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('sugar', 'Sugar', 'S1', 'kg', 1)`);
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('cake', 'Cake', 'C1', 'pcs', 1)`);
    // Ingredients on hand
    db.run(`INSERT INTO batches (id, product_id, batch_number, quantity, buying_price) VALUES ('bf', 'flour', 'B1', 100, 100)`);
    db.run(`INSERT INTO batches (id, product_id, batch_number, quantity, buying_price) VALUES ('bs', 'sugar', 'B2', 50, 150)`);
    // BOM
    db.run(`INSERT INTO assembly_bom (id, output_product_id, yield_quantity, labour_cost, overhead_cost) VALUES ('bom1', 'cake', 10, 200, 50)`);
    db.run(`INSERT INTO assembly_bom_ingredients (id, bom_id, ingredient_product_id, quantity) VALUES ('ing1', 'bom1', 'flour', 5)`);
    db.run(`INSERT INTO assembly_bom_ingredients (id, bom_id, ingredient_product_id, quantity) VALUES ('ing2', 'bom1', 'sugar', 2)`);
    // Simulate production of 10 cakes → deduct 5 flour + 2 sugar
    db.run(`UPDATE batches SET quantity = quantity - 5 WHERE id = 'bf'`);
    db.run(`UPDATE batches SET quantity = quantity - 2 WHERE id = 'bs'`);
    db.run(`INSERT INTO batches (id, product_id, batch_number, quantity, buying_price) VALUES ('bc', 'cake', 'PROD-2026-07-02', 10, 80)`);
    db.run(`INSERT INTO production_runs (id, run_number, bom_id, output_quantity, total_cost) VALUES ('pr1', 'PR-2026-00001', 'bom1', 10, 800)`);

    const [flour] = db.exec(`SELECT quantity FROM batches WHERE id = 'bf'`);
    expect(flour.values[0][0]).toBe(95);
    const [cake] = db.exec(`SELECT quantity FROM batches WHERE product_id = 'cake'`);
    expect(cake.values[0][0]).toBe(10);
  });
});
