/**
 * Platform batch schema tests (v0.31.0 continued).
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

const TABLES = [
  "customer_communications",
  "follow_ups",
  "fixed_assets",
  "depreciation_entries",
  "currencies",
  "exchange_rates",
  "recalls",
  "room_status_log",
  "housekeeping_tasks",
  "record_history",
  "saved_reports",
  "password_policies",
  "login_attempts",
];

describe("SQL smoke — platform batch tables", () => {
  it.each(TABLES)("%s exists", async (name) => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [name],
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("SQL smoke — currencies seeded", () => {
  it("KES + USD + regional currencies present", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`SELECT COUNT(*) FROM currencies WHERE active = 1`);
    expect(Number(r.values[0][0])).toBeGreaterThanOrEqual(8);
  });
});

describe("SQL smoke — batches.quarantined column", () => {
  it("column exists after migration 067", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(batches)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("quarantined");
  });
});

describe("SQL smoke — users.pin_hash column", () => {
  it("column exists after migration 067", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(users)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("pin_hash");
    expect(cols).toContain("pin_updated_at");
  });
});

describe("SQL smoke — rooms.current_status column", () => {
  it("column exists after migration 067", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`PRAGMA table_info(rooms)`);
    const cols = r.values.map((v) => v[1]);
    expect(cols).toContain("current_status");
  });
});

describe("SQL smoke — password policy default row", () => {
  it("default row exists", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`SELECT id, min_length FROM password_policies WHERE id = 'default'`);
    expect(r.values.length).toBe(1);
    expect(r.values[0][1]).toBe(8);
  });
});

describe("SQL smoke — recall workflow", () => {
  it("can quarantine a batch via recall", async () => {
    const db = await openTestDb();
    // Insert a product + batch
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('p-rx', 'Ranitidine', 'RAN1', 'tab', 1)`);
    db.run(
      `INSERT INTO batches (id, product_id, batch_number, quantity, expiry_date)
       VALUES ('b-rx', 'p-rx', 'B001', 100, '2027-01-01')`,
    );

    // Issue recall
    db.run(
      `INSERT INTO recalls (id, recall_number, product_id, batch_number, reason, issued_at)
       VALUES ('r1', 'RCL-2026-000001', 'p-rx', 'B001', 'Contamination', datetime('now'))`,
    );

    // Simulate the app quarantining the batch
    db.run(`UPDATE batches SET quarantined = 1 WHERE batch_number = 'B001' AND product_id = 'p-rx'`);

    const [r] = db.exec(`SELECT quarantined FROM batches WHERE id = 'b-rx'`);
    expect(r.values[0][0]).toBe(1);
  });
});
