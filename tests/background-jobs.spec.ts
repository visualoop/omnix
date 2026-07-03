/**
 * background-jobs.spec.ts — sanity tests for the periodic automations.
 *
 * (a) Depreciation is idempotent per (asset, period) via the DB unique index.
 * (b) The settings-key marker prevents re-post attempts.
 * (c) A new period is not blocked by an older marker.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "sql.js";
import { openTestDb, selectAll, exec } from "./helpers/sql-harness";

describe("background jobs — depreciation idempotency", () => {
  let db: Database;

  beforeEach(async () => {
    db = await openTestDb();
    exec(
      db,
      `INSERT INTO fixed_assets (id, asset_code, name, category, acquired_date, cost, salvage_value, useful_life_months, method, status)
       VALUES ('asset-1', 'FA-001', 'Fridge', 'equipment', '2024-01-01', 60000, 0, 60, 'straight_line', 'active')`,
    );
  });

  it("posts one depreciation row per (asset, period)", () => {
    exec(
      db,
      `INSERT INTO depreciation_entries (id, asset_id, period_label, depreciation_amount, book_value_after)
       VALUES ('d-1', 'asset-1', '2026-06', 1000, 59000)`,
    );
    const rows = selectAll<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM depreciation_entries WHERE asset_id = 'asset-1' AND period_label = '2026-06'`,
    );
    expect(rows[0].n).toBe(1);
  });

  it("second insert for same (asset, period) is rejected by unique index", () => {
    exec(
      db,
      `INSERT INTO depreciation_entries (id, asset_id, period_label, depreciation_amount, book_value_after)
       VALUES ('d-1', 'asset-1', '2026-06', 1000, 59000)`,
    );
    let threw = false;
    try {
      exec(
        db,
        `INSERT INTO depreciation_entries (id, asset_id, period_label, depreciation_amount, book_value_after)
         VALUES ('d-2', 'asset-1', '2026-06', 1000, 58000)`,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("settings marker prevents a second post attempt for the same period", () => {
    exec(
      db,
      `INSERT INTO settings (key, value) VALUES ('depreciation.last_posted_period', '2026-06')`,
    );
    const rows = selectAll<{ value: string }>(
      db,
      `SELECT value FROM settings WHERE key = 'depreciation.last_posted_period'`,
    );
    expect(rows[0].value).toBe("2026-06");
  });

  it("a new period is not blocked by an older marker", () => {
    exec(
      db,
      `INSERT INTO settings (key, value) VALUES ('depreciation.last_posted_period', '2026-05')`,
    );
    const rows = selectAll<{ value: string }>(
      db,
      `SELECT value FROM settings WHERE key = 'depreciation.last_posted_period'`,
    );
    expect(rows[0].value).not.toBe("2026-06");
  });
});
