/**
 * hardware.spec.ts — the regression the user actually hit: hardware quotations
 * crashed with "no such column: quote_number" because migrations 018 and 031
 * both CREATE TABLE IF NOT EXISTS quotations with different columns. 018 wins.
 *
 * These tests exercise the SQL layer directly (using the same statements the
 * service issues after v0.37.7's rewrite) to confirm every field survives a
 * round-trip on the shared 018+073 schema.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "sql.js";
import { openTestDb, selectAll, exec } from "./helpers/sql-harness";

describe("hardware quotations — schema round-trip", () => {
  let db: Database;

  beforeEach(async () => {
    db = await openTestDb();
    exec(
      db,
      `INSERT INTO users (id, username, full_name, password_hash, role) VALUES ('u-1', 'test', 'Test User', 'x', 'owner')`,
    );
    exec(
      db,
      `INSERT INTO customers (id, name, phone) VALUES ('c-1', 'Kilifi Hardware Ltd', '0700123456')`,
    );
    exec(
      db,
      `INSERT INTO employees (id, employee_number, full_name, job_title, active) VALUES ('e-1', 'EMP-001', 'Salesperson One', 'Sales Rep', 1)`,
    );
  });

  it("inserts and reads back a quotation with hardware-only columns", () => {
    exec(
      db,
      `INSERT INTO quotations
         (id, quotation_number, branch_id, customer_id, customer_name, status, valid_until,
          subtotal, discount_amount, tax_amount, total, salesperson_id, notes, user_id)
       VALUES ('q-1', 'QT-00001', NULL, 'c-1', 'Kilifi Hardware Ltd', 'draft', '2026-08-01',
               10000, 500, 1520, 11020, 'e-1', 'trade discount applied', 'u-1')`,
    );

    const rows = selectAll<{
      id: string;
      quotation_number: string;
      customer_id: string;
      customer_name: string;
      status: string;
      total: number;
      salesperson_id: string;
      converted_sale_id: string | null;
    }>(
      db,
      `SELECT id, quotation_number, customer_id, customer_name, status, total,
              salesperson_id, converted_sale_id
       FROM quotations WHERE id = 'q-1'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].quotation_number).toBe("QT-00001");
    expect(rows[0].customer_name).toBe("Kilifi Hardware Ltd");
    expect(rows[0].salesperson_id).toBe("e-1");
    expect(rows[0].converted_sale_id).toBeNull();
    expect(rows[0].total).toBe(11020);
  });

  it("inserts and reads back quotation items using the shared 018 schema", () => {
    exec(
      db,
      `INSERT INTO quotations
         (id, quotation_number, customer_id, customer_name, status, valid_until,
          subtotal, discount_amount, tax_amount, total, user_id)
       VALUES ('q-2', 'QT-00002', 'c-1', 'Kilifi Hardware Ltd', 'draft', '2026-08-01',
               0, 0, 0, 0, 'u-1')`,
    );
    exec(
      db,
      `INSERT INTO quotation_items
         (id, quotation_id, product_id, description, quantity, unit, unit_price, tax_rate, discount_amount, line_total, sort_order)
       VALUES ('qi-1', 'q-2', NULL, 'Portland cement 50kg', 20, 'bag', 850, 16, 0, 17000, 0)`,
    );

    const rows = selectAll<{
      description: string;
      unit: string;
      quantity: number;
      line_total: number;
    }>(
      db,
      `SELECT description, unit, quantity, line_total FROM quotation_items WHERE quotation_id = 'q-2'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Portland cement 50kg");
    expect(rows[0].unit).toBe("bag");
    expect(rows[0].quantity).toBe(20);
  });

  it("can UPDATE converted_sale_id when a quote checks out via POS", () => {
    exec(
      db,
      `INSERT INTO quotations
         (id, quotation_number, customer_id, customer_name, status, valid_until,
          subtotal, discount_amount, tax_amount, total, user_id)
       VALUES ('q-3', 'QT-00003', 'c-1', 'Kilifi Hardware Ltd', 'draft', '2026-08-01',
               0, 0, 0, 0, 'u-1')`,
    );

    exec(
      db,
      `UPDATE quotations SET status = 'converted', converted_sale_id = 's-99' WHERE id = 'q-3'`,
    );

    const rows = selectAll<{ status: string; converted_sale_id: string }>(
      db,
      `SELECT status, converted_sale_id FROM quotations WHERE id = 'q-3'`,
    );
    expect(rows[0].status).toBe("converted");
    expect(rows[0].converted_sale_id).toBe("s-99");
  });

  it("has indexes on salesperson_id and converted_sale_id from migration 073", () => {
    const rows = selectAll<{ name: string }>(
      db,
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'quotations'`,
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("idx_quotations_salesperson");
    expect(names).toContain("idx_quotations_converted_sale");
  });
});
