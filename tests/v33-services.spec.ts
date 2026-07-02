/**
 * v0.33.0 tests — inventory-quality, follow-ups, room-status, password policy.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

describe("SQL smoke — v0.33 batch queries", () => {
  it("cycle_count + cycle_count_items insert + variance auto-compute in app layer", async () => {
    const db = await openTestDb();
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('p1', 'Item', 'I1', 'pcs', 1)`);
    db.run(`INSERT INTO cycle_counts (id, count_date, status) VALUES ('cc1', '2026-07-02', 'in_progress')`);
    db.run(`INSERT INTO cycle_count_items (id, cycle_count_id, product_id, system_qty) VALUES ('ci1', 'cc1', 'p1', 50)`);

    // Simulate the app layer recording a counted qty
    db.run(`UPDATE cycle_count_items SET counted_qty = 47, variance = -3 WHERE id = 'ci1'`);

    const [r] = db.exec(`SELECT counted_qty, variance FROM cycle_count_items WHERE id = 'ci1'`);
    expect(r.values[0][0]).toBe(47);
    expect(r.values[0][1]).toBe(-3);
  });

  it("damages record + batch deduction", async () => {
    const db = await openTestDb();
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('p2', 'Milk', 'M1', 'ltr', 1)`);
    db.run(`INSERT INTO batches (id, product_id, batch_number, quantity) VALUES ('b1', 'p2', 'B01', 100)`);
    db.run(`INSERT INTO damages (id, product_id, batch_id, quantity, discovered_at_stage) VALUES ('d1', 'p2', 'b1', 5, 'on_receipt')`);
    // Simulate the app layer batch deduction
    db.run(`UPDATE batches SET quantity = quantity - 5 WHERE id = 'b1'`);
    const [r] = db.exec(`SELECT quantity FROM batches WHERE id = 'b1'`);
    expect(r.values[0][0]).toBe(95);
  });

  it("dead stock query returns SKUs with no recent sales", async () => {
    const db = await openTestDb();
    db.run(`INSERT INTO products (id, name, sku, unit, active) VALUES ('p3', 'Dust', 'D1', 'pcs', 1)`);
    db.run(`INSERT INTO batches (id, product_id, quantity, buying_price) VALUES ('b3', 'p3', 20, 100)`);

    // Simulate the dead-stock query (matches services/inventory-quality.ts)
    const [r] = db.exec(
      `SELECT p.id, COALESCE(SUM(b.quantity), 0) AS qty_on_hand,
              (SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
               WHERE si.product_id = p.id AND s.status = 'completed') AS last_sold_at
       FROM products p LEFT JOIN batches b ON b.product_id = p.id
       WHERE p.id = 'p3' GROUP BY p.id`,
    );
    expect(r.values[0][1]).toBe(20);          // qty on hand
    expect(r.values[0][2]).toBe(null);        // never sold
  });

  it("follow_ups pending list filters cancelled", async () => {
    const db = await openTestDb();
    db.run(`INSERT INTO follow_ups (id, title, due_at, status) VALUES ('f1', 'Call Mary', '2026-07-05 10:00:00', 'pending')`);
    db.run(`INSERT INTO follow_ups (id, title, due_at, status) VALUES ('f2', 'Cancelled task', '2026-07-06 10:00:00', 'cancelled')`);
    const [r] = db.exec(`SELECT COUNT(*) FROM follow_ups WHERE status = 'pending'`);
    expect(r.values[0][0]).toBe(1);
  });

  it("room status log insert + rooms.current_status update", async () => {
    const db = await openTestDb();
    db.run(`INSERT INTO room_types (id, name) VALUES ('rt1', 'Standard')`);
    db.run(`INSERT INTO rooms (id, room_number, room_type_id, current_status) VALUES ('rm1', '101', 'rt1', 'clean')`);
    db.run(`UPDATE rooms SET current_status = 'occupied' WHERE id = 'rm1'`);
    db.run(`INSERT INTO room_status_log (id, room_id, status) VALUES ('rsl1', 'rm1', 'occupied')`);
    const [r] = db.exec(`SELECT current_status FROM rooms WHERE id = 'rm1'`);
    expect(r.values[0][0]).toBe("occupied");
    const [logRow] = db.exec(`SELECT COUNT(*) FROM room_status_log WHERE room_id = 'rm1'`);
    expect(logRow.values[0][0]).toBe(1);
  });

  it("login_attempts lockout query returns recent failures", async () => {
    const db = await openTestDb();
    // 6 failed attempts in the last 15 minutes
    for (let i = 0; i < 6; i++) {
      db.run(`INSERT INTO login_attempts (id, username, succeeded, attempted_at) VALUES ('a${i}', 'mary', 0, datetime('now', '-2 minutes'))`);
    }
    // Also one successful just for noise
    db.run(`INSERT INTO login_attempts (id, username, succeeded, attempted_at) VALUES ('s1', 'mary', 1, datetime('now'))`);

    const [r] = db.exec(
      `SELECT COUNT(*) FROM login_attempts
        WHERE username = 'mary'
          AND succeeded = 0
          AND attempted_at >= datetime('now', '-15 minutes')`,
    );
    expect(Number(r.values[0][0])).toBe(6);
  });

  it("password_policies default row has sane values", async () => {
    const db = await openTestDb();
    const [r] = db.exec(`SELECT min_length, require_number, lockout_after_failures FROM password_policies WHERE id = 'default'`);
    expect(r.values[0][0]).toBe(8);
    expect(r.values[0][1]).toBe(1);
    expect(r.values[0][2]).toBe(5);
  });
});
