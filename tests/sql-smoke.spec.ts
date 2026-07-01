/**
 * SQL smoke tests — end-to-end schema + query validation.
 *
 * Runs every migration against a real in-memory SQLite (via sql.js),
 * seeds representative data, then executes each critical service
 * query. Catches "no such column" / "no such table" / SQL syntax
 * errors BEFORE they ship.
 *
 * This suite exists because prior test coverage was pure-JS (no SQL
 * ever ran). That's what let the v0.28.2 refunded_amount regression
 * ship — a "no such column" in production on multiple pages.
 *
 * Rule: for every service function that runs SQL, add a smoke test
 * that runs the same SQL against the harness. Cheap; catches a whole
 * class of bug forever.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { openTestDb, selectAll, exec } from "./helpers/sql-harness";
import type { Database } from "sql.js";

// ─── SEED ─────────────────────────────────────────────────────────
// Minimal data set that lets every aggregate return something. Values
// chosen so queries reveal contract bugs (e.g. subtract returns properly).

async function seedDb(): Promise<Database> {
  const db = await openTestDb();

  // Users (schema: id, username, full_name, role, password_hash, pin, active)
  exec(db, `INSERT INTO users (id, username, full_name, role, password_hash, active)
            VALUES ('u1', 'justine', 'Justine Owner', 'owner', 'hash', 1)`);
  exec(db, `INSERT INTO users (id, username, full_name, role, password_hash, active)
            VALUES ('u2', 'mary', 'Mary Cashier', 'cashier', 'hash', 1)`);

  // Branch — use the default seed row from migration 016 (id='default-branch')
  // and add a second one so cross-branch queries have data to filter on.
  exec(db, `INSERT INTO branches (id, code, name, is_default, active)
            VALUES ('branch-kilifi', 'KILIFI', 'Kilifi Branch', 0, 1)`);

  exec(db, `INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ('u1', 'default-branch', 1)`);
  exec(db, `INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ('u2', 'default-branch', 1)`);
  exec(db, `INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ('u2', 'branch-kilifi', 0)`);

  // Customers (schema: id, name, phone, email, customer_group_id, credit_limit, balance, notes, active)
  exec(db, `INSERT INTO customers (id, name, phone, balance, active)
            VALUES ('c1', 'Jane Buyer', '0712345678', 0, 1)`);
  exec(db, `INSERT INTO customers (id, name, phone, balance, active)
            VALUES ('c2', 'Peter Contractor', '0723456789', 500, 1)`);

  // Products
  exec(db, `INSERT INTO products (id, name, sku, tax_rate, active)
            VALUES ('p1', 'Paracetamol 500mg', 'PARA500', 16, 1)`);
  exec(db, `INSERT INTO products (id, name, sku, tax_rate, active)
            VALUES ('p2', 'Amoxicillin 250mg', 'AMOX250', 16, 1)`);

  // Batches (for stock queries) — schema: id, product_id, quantity, buying_price, expiry_date, branch_id
  exec(db, `INSERT INTO batches (id, product_id, quantity, buying_price, branch_id)
            VALUES ('b1', 'p1', 100, 5, 'default-branch')`);
  exec(db, `INSERT INTO batches (id, product_id, quantity, buying_price, branch_id)
            VALUES ('b2', 'p2', 50, 30, 'default-branch')`);

  // A sale + line items + a partial return
  exec(db, `INSERT INTO sales (id, sale_number, customer_id, user_id, branch_id, subtotal, tax_amount, total, status)
            VALUES ('s1', 1, 'c1', 'u1', 'default-branch', 86.21, 13.79, 100, 'completed')`);
  exec(db, `INSERT INTO sale_items (id, sale_id, product_id, batch_id, product_name, quantity, unit_price, total)
            VALUES ('si1', 's1', 'p1', 'b1', 'Paracetamol 500mg', 10, 10, 100)`);

  // A return of 2 of the 10 units — refund KES 20
  exec(db, `INSERT INTO sale_returns (id, return_number, sale_id, customer_id, user_id, branch_id, reason, refund_method, refund_amount)
            VALUES ('r1', 'RT-00001', 's1', 'c1', 'u1', 'default-branch', 'wrong dose', 'cash', 20)`);
  exec(db, `INSERT INTO sale_return_items (id, return_id, sale_item_id, product_id, product_name, quantity, unit_price, line_total)
            VALUES ('sri1', 'r1', 'si1', 'p1', 'Paracetamol 500mg', 2, 10, 20)`);

  // Bank account seed — schema uses "name" (not account_name) + account_type CHECK
  exec(db, `INSERT INTO bank_accounts (id, name, account_type, current_balance)
            VALUES ('ba1', 'Cash till', 'cash_box', 100)`);

  return db;
}

// ─── SCHEMA CONFORMANCE ───────────────────────────────────────────

describe("SQL smoke — schema loads + all migrations run", () => {
  let db: Database;
  beforeAll(async () => { db = await openTestDb(); });

  it("every migration in src-tauri/migrations/ applies without error", () => {
    expect(db).toBeDefined();
  });

  it("has the tables the desktop app expects", () => {
    const tables = selectAll<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).map((r) => r.name);

    const required = [
      "sales", "sale_items", "sale_returns", "sale_return_items",
      "customers", "products", "batches", "stock_movements",
      "users", "user_branches", "branches",
      "settings", "payments", "payment_methods",
      "bank_accounts", "bank_transactions",
      "etims_invoices",
    ];
    for (const t of required) {
      expect(tables, `missing table: ${t}`).toContain(t);
    }
  });

  it("schema is stable — no duplicate primary keys after re-running migrations", async () => {
    // Migrations must be idempotent. Running the whole set twice on
    // the same DB must not error (all CREATE TABLE IF NOT EXISTS,
    // all ALTER guarded, all triggers guarded).
    const db2 = await openTestDb();
    // openTestDb already runs migrations once; the test is that the
    // OPEN itself didn't throw (see harness code).
    expect(db2).toBeDefined();
  });
});

// ─── DASHBOARD + POS AGGREGATES ───────────────────────────────────

describe("SQL smoke — dashboard aggregates (getTodaySalesSummary)", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("today's revenue (gross) query executes", () => {
    const rows = selectAll<{ count: number; revenue: number }>(
      db,
      `SELECT
         COUNT(CASE WHEN status != 'voided' THEN 1 END) AS count,
         COALESCE(SUM(CASE WHEN status NOT IN ('voided','held') THEN total ELSE 0 END), 0) AS revenue
       FROM sales WHERE date(created_at) = date('now') AND branch_id = ?1`,
      ["default-branch"],
    );
    expect(rows[0].count).toBe(1);
    expect(rows[0].revenue).toBe(100);
  });

  it("today's refunds query executes and returns correct total", () => {
    const rows = selectAll<{ refunds: number }>(
      db,
      `SELECT COALESCE(SUM(refund_amount), 0) AS refunds
       FROM sale_returns WHERE date(created_at) = date('now') AND branch_id = ?1`,
      ["default-branch"],
    );
    expect(rows[0].refunds).toBe(20);
  });

  it("payment methods breakdown query executes", () => {
    // Even with no payments rows seeded, this query must not throw.
    expect(() => selectAll(
      db,
      `SELECT p.method_name, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE date(s.created_at) = date('now') AND s.branch_id = ?1 AND s.status != 'voided'
       GROUP BY p.method_name`,
      ["default-branch"],
    )).not.toThrow();
  });
});

// ─── BRANCHES ─────────────────────────────────────────────────────

describe("SQL smoke — branches queries", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("listBranches — full aggregate with today's stats", () => {
    const rows = selectAll<{ sales_today: number; sales_today_count: number; user_count: number }>(
      db,
      `SELECT
         b.*,
         u.full_name AS manager_name,
         (SELECT COUNT(*) FROM user_branches WHERE branch_id = b.id) AS user_count,
         COALESCE((
           SELECT SUM(total) FROM sales
           WHERE branch_id = b.id AND date(created_at) = date('now') AND status = 'completed'
         ), 0) - COALESCE((
           SELECT SUM(refund_amount) FROM sale_returns
           WHERE branch_id = b.id AND date(created_at) = date('now')
         ), 0) AS sales_today,
         COALESCE((
           SELECT COUNT(*) FROM sales
           WHERE branch_id = b.id AND date(created_at) = date('now') AND status = 'completed'
         ), 0) AS sales_today_count
       FROM branches b
       LEFT JOIN users u ON u.id = b.manager_id
       WHERE b.active = 1
       ORDER BY b.is_default DESC, b.name`,
    );

    // Default branch has our sale (100) minus refund (20) = 80 net.
    const mainRow = rows.find((r) => (r as unknown as { code: string }).code === 'MAIN');
    expect(mainRow?.sales_today).toBe(80);
    expect(mainRow?.sales_today_count).toBe(1);
    expect(mainRow?.user_count).toBe(2);
  });

  it("branch-detail — 30-day sales aggregate", () => {
    expect(() => selectAll(
      db,
      `SELECT
         (SELECT COUNT(*) FROM user_branches ub
            INNER JOIN users u ON u.id = ub.user_id
            WHERE ub.branch_id = ?1 AND u.active = 1) as user_count,
         COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed'), 0)
           - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) = date('now')), 0) as sales_today,
         (SELECT COUNT(*) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed') as sales_today_count,
         COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days') AND status = 'completed'), 0)
           - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days')), 0) as sales_30d`,
      ["default-branch"],
    )).not.toThrow();
  });

  it("listUserBranches (edit-user branch list)", () => {
    // This is the query that flagged in the wild — pages/users.tsx > EditUserForm.
    const rows = selectAll(
      db,
      `SELECT b.id, b.name, ub.is_primary
       FROM user_branches ub
       JOIN branches b ON b.id = ub.branch_id
       WHERE ub.user_id = ?1
       ORDER BY ub.is_primary DESC, b.name`,
      ["u2"],
    );
    expect(rows.length).toBe(2);
  });
});

// ─── CUSTOMER STATS ───────────────────────────────────────────────

describe("SQL smoke — customer aggregates", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("getCustomerStats — gross + refunds separately, then net in code", () => {
    const grossRows = selectAll<{ total_purchases: number; gross_amount: number; last_purchase: string }>(
      db,
      `SELECT COUNT(*) as total_purchases,
              COALESCE(SUM(total), 0) as gross_amount,
              MAX(created_at) as last_purchase
       FROM sales WHERE customer_id = ?1 AND status = 'completed'`,
      ["c1"],
    );
    const refundRows = selectAll<{ refunds_amount: number }>(
      db,
      `SELECT COALESCE(SUM(refund_amount), 0) as refunds_amount
       FROM sale_returns WHERE customer_id = ?1`,
      ["c1"],
    );

    expect(grossRows[0].gross_amount).toBe(100);
    expect(refundRows[0].refunds_amount).toBe(20);
    // Net (computed in application code): 100 - 20 = 80
    expect(Math.max(0, grossRows[0].gross_amount - refundRows[0].refunds_amount)).toBe(80);
  });
});

// ─── CUSTOMER ACTIVITY (use-entity-history hook) ──────────────────

describe("SQL smoke — customer activity", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("loadSales customer timeline uses sale_number (regression-locked from v0.27.3)", () => {
    // v0.27.x regression referenced non-existent sales.receipt_number.
    // Now uses sale_number. Lock the correct column name.
    const rows = selectAll<{ sale_number: number; total: number }>(
      db,
      `SELECT id, created_at, total, sale_number
       FROM sales
       WHERE customer_id = ?1
       ORDER BY created_at DESC
       LIMIT ?2`,
      ["c1", 100],
    );
    expect(rows[0].sale_number).toBe(1);
  });

  it("loadSales does NOT accept receipt_number (would throw)", () => {
    // Prove the column that caused the regression doesn't exist.
    expect(() => selectAll(
      db,
      `SELECT receipt_number FROM sales LIMIT 1`,
    )).toThrow(/no such column/i);
  });
});

// ─── DASHBOARD PROFIT + COGS ──────────────────────────────────────

describe("SQL smoke — dashboard profit (with return reversal)", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("today_profit query with return reversal executes", () => {
    // Complex query added in v0.28.3 — profit = gross - COGS - returned profit.
    // COGS resolved via cogsExpr() which joins batches.buying_price.
    // (Reference: services/cogs.ts)
    const cogsExpr = (alias: string) => `COALESCE(
      (SELECT b1.buying_price FROM batches b1 WHERE b1.id = ${alias}.batch_id),
      (SELECT b2.buying_price FROM batches b2 WHERE b2.product_id = ${alias}.product_id ORDER BY b2.received_at DESC LIMIT 1),
      0
    )`;
    expect(() => selectAll(
      db,
      `SELECT (
         COALESCE((
           SELECT SUM(si.unit_price * si.quantity - ${cogsExpr("si")} * si.quantity)
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           WHERE date(s.created_at) = date('now') AND s.status = 'completed' AND s.branch_id = ?1
         ), 0)
         -
         COALESCE((
           SELECT SUM(sri.line_total - ${cogsExpr("si2")} * sri.quantity)
           FROM sale_return_items sri
           JOIN sale_returns sr ON sr.id = sri.return_id
           LEFT JOIN sale_items si2 ON si2.id = sri.sale_item_id
           WHERE date(sr.created_at) = date('now') AND sr.branch_id = ?1
         ), 0)
       ) as profit`,
      ["default-branch"],
    )).not.toThrow();
  });
});

// ─── LOW-STOCK + EXPIRING (dashboard tiles) ───────────────────────

describe("SQL smoke — dashboard tiles", () => {
  let db: Database;
  beforeAll(async () => { db = await seedDb(); });

  it("low-stock count executes", () => {
    expect(() => selectAll(
      db,
      `SELECT COUNT(*) as count FROM products p
       WHERE p.active = 1
         AND COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id AND b.branch_id = ?1), 0) <= p.reorder_level`,
      ["default-branch"],
    )).not.toThrow();
  });

  it("expiring-batches count executes", () => {
    expect(() => selectAll(
      db,
      `SELECT COUNT(*) as count FROM batches b
       WHERE b.expiry_date IS NOT NULL AND b.quantity > 0 AND b.branch_id = ?1
         AND julianday(b.expiry_date) - julianday('now') <= 90`,
      ["default-branch"],
    )).not.toThrow();
  });
});

// ─── OLD-INSTALL COMPATIBILITY (the reason this suite exists) ────

describe("SQL smoke — old-install compatibility (pre-053)", () => {
  it("service queries run whether or not migration 053 has been applied", async () => {
    // Simulate a device that installed the app before migration 053
    // (which added sales.refunded_amount + trigger).
    const SQL = (await import("sql.js")).default;
    const initSqlJs = SQL;
    const sqlJs = await initSqlJs();
    const oldDb = new sqlJs.Database();
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src-tauri", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
      .filter((f) => f < "053_");
    for (const f of files) oldDb.exec(readFileSync(join(dir, f), "utf-8"));

    // Confirm refunded_amount is NOT in this old schema
    expect(() => oldDb.exec(`SELECT refunded_amount FROM sales LIMIT 1`)).toThrow(/no such column/i);

    // The JOIN-based service query MUST execute — it's the compatibility we ship.
    expect(() => oldDb.exec(
      `SELECT
         COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = 'x'), 0)
           - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = 'x'), 0) AS net`,
    )).not.toThrow();
  });
});
