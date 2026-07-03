/**
 * fefo.spec.ts — FEFO (First-Expiring-First-Out) batch selection.
 *
 * Before v0.37.8 the POS + stock-decrement paths ordered by received_at
 * with NO filter on expiry_date. That meant a pharmacy could silently
 * dispense an expired batch as long as its receive date was oldest.
 *
 * These tests exercise the exact SQL the services now use to confirm:
 *   • Expired batches are excluded from the "available" aggregate.
 *   • Expired batches are never picked for dispense/decrement.
 *   • Batches are ordered by expiry_date ASC NULLS LAST — the closest
 *     to expiry (that hasn't expired) goes first (FEFO).
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "sql.js";
import { openTestDb, selectAll, exec } from "./helpers/sql-harness";

// The exact SQL the services now issue.
const AGGREGATE_AVAILABLE = `
  SELECT product_id, COALESCE(SUM(quantity), 0) AS available
  FROM batches
  WHERE product_id IN (?1)
    AND quantity > 0
    AND (expiry_date IS NULL OR expiry_date > date('now'))
  GROUP BY product_id
`;

const PICK_FEFO = `
  SELECT id, quantity, expiry_date
  FROM batches
  WHERE product_id = ?1 AND quantity > 0
    AND (expiry_date IS NULL OR expiry_date > date('now'))
  ORDER BY expiry_date ASC NULLS LAST, received_at ASC
`;

describe("FEFO — expired batches are never dispensed", () => {
  let db: Database;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const in7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in6m = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);

  beforeEach(async () => {
    db = await openTestDb();
    exec(
      db,
      `INSERT INTO products (id, name, sku, unit, kind, active) VALUES ('p-1', 'Amoxicillin 500mg', 'AMX-500', 'tab', 'physical', 1)`,
    );
    // Batch A — EXPIRED yesterday, 100 tabs, received first (oldest)
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-a', 'p-1', 'A', 100, 5, '${yesterday}', '2025-01-01T00:00:00')`);
    // Batch B — expires in 7 days, 50 tabs
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-b', 'p-1', 'B', 50, 5, '${in7d}', '2025-06-01T00:00:00')`);
    // Batch C — expires in 6 months, 200 tabs
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-c', 'p-1', 'C', 200, 5, '${in6m}', '2025-12-01T00:00:00')`);
  });

  it("aggregate available excludes expired batches", () => {
    const rows = selectAll<{ available: number }>(db, AGGREGATE_AVAILABLE, ["p-1"]);
    // 50 (B) + 200 (C) = 250. Expired A (100) is NOT counted.
    expect(rows[0].available).toBe(250);
  });

  it("aggregate excludes expired even when all batches would otherwise be picked", () => {
    // Add a NULL-expiry batch too — it should be included
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-d', 'p-1', 'D', 25, 5, NULL, '2025-06-15T00:00:00')`);
    const rows = selectAll<{ available: number }>(db, AGGREGATE_AVAILABLE, ["p-1"]);
    expect(rows[0].available).toBe(275); // 50 + 200 + 25
  });

  it("FEFO picker never returns the expired batch", () => {
    const rows = selectAll<{ id: string }>(db, PICK_FEFO, ["p-1"]);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain("b-a");
  });

  it("FEFO picker returns closest-expiring batch first", () => {
    const rows = selectAll<{ id: string; expiry_date: string }>(db, PICK_FEFO, ["p-1"]);
    // B expires in 7 days, C in 6 months. B should come before C.
    expect(rows[0].id).toBe("b-b");
    expect(rows[1].id).toBe("b-c");
  });

  it("NULL-expiry batches come last under NULLS LAST", () => {
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-null', 'p-1', 'NULL', 30, 5, NULL, '2025-06-15T00:00:00')`);
    const rows = selectAll<{ id: string; expiry_date: string | null }>(db, PICK_FEFO, ["p-1"]);
    // Order: b-b (7d), b-c (6m), b-null (NULL last)
    expect(rows[rows.length - 1].id).toBe("b-null");
  });

  it("only-expired inventory returns 0 available", () => {
    exec(db, `INSERT INTO products (id, name, sku, unit, kind, active) VALUES ('p-2', 'Old drug', 'OLD-1', 'tab', 'physical', 1)`);
    exec(db, `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at) VALUES ('b-old', 'p-2', 'OLD', 500, 3, '${yesterday}', '2025-01-01T00:00:00')`);
    const rows = selectAll<{ available: number }>(db, AGGREGATE_AVAILABLE, ["p-2"]);
    // Because GROUP BY, when 0 rows match, we get no row at all.
    expect(rows.length === 0 || rows[0].available === 0).toBe(true);
  });
});
