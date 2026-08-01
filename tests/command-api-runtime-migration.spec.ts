import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("src-tauri/migrations/102_command_api_runtime.sql"), "utf8");

function rows(db: Database, sql: string): Array<Record<string, unknown>> {
  const result = db.exec(sql)[0];
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(
    result.columns.map((column, index) => [column, values[index]]),
  ));
}

async function upgradedDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE devices(id TEXT PRIMARY KEY);
    CREATE TABLE branches(id TEXT PRIMARY KEY, active INTEGER);
    CREATE TABLE products(
      id TEXT PRIMARY KEY, name TEXT, sku TEXT, barcode TEXT, unit TEXT,
      reorder_level INTEGER, active INTEGER, updated_at TEXT
    );
    CREATE TABLE customers(
      id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
      credit_limit REAL, active INTEGER
    );
    CREATE TABLE product_prices(
      product_id TEXT, price_list_id TEXT, buying_price REAL, selling_price REAL
    );
    CREATE TABLE batches(
      id TEXT PRIMARY KEY, product_id TEXT, branch_id TEXT, quantity REAL
    );
    CREATE TABLE sales(id TEXT PRIMARY KEY);
    CREATE TABLE purchase_orders(id TEXT PRIMARY KEY);
    CREATE TABLE cash_register(id TEXT PRIMARY KEY);
    CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT, category TEXT);
    CREATE TABLE api_tokens(
      token TEXT PRIMARY KEY, device_name TEXT, device_fingerprint TEXT,
      created_at TEXT, last_seen_at TEXT, revoked INTEGER
    );
  `);
  return db;
}

describe("migration 102 command API runtime", () => {
  it("backfills minor/milli projections with explicit rounding and enables only existing paired upgrades", async () => {
    const db = await upgradedDatabase();
    db.exec(`
      INSERT INTO branches VALUES('11111111-1111-4111-8111-111111111111', 1);
      INSERT INTO products VALUES('22222222-2222-4222-8222-222222222222','Measured item','SKU-1',NULL,'kg',3,1,'2026-01-01T00:00:00Z');
      INSERT INTO product_prices VALUES('22222222-2222-4222-8222-222222222222','default',12.345,19.999);
      INSERT INTO batches VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',1.2346);
      INSERT INTO customers VALUES('44444444-4444-4444-8444-444444444444','Customer',NULL,NULL,10.555,1);
      INSERT INTO api_tokens VALUES('legacy-clear','Till',NULL,'2026-01-01',NULL,0);
    `);

    db.exec(migration);

    expect(rows(db, `SELECT buying_price_minor, selling_price_minor, reorder_level_milli, quantity_milli FROM branch_inventory_items`)).toEqual([
      { buying_price_minor: 1235, selling_price_minor: 2000, reorder_level_milli: 3000, quantity_milli: 1235 },
    ]);
    expect(rows(db, `SELECT credit_limit_minor FROM branch_customers`)).toEqual([{ credit_limit_minor: 1056 }]);
    expect(rows(db, `SELECT value FROM settings WHERE key = 'network.legacy_trusted_lan'`)).toEqual([{ value: "1" }]);
    expect(rows(db, `SELECT name, dflt_value FROM pragma_table_info('sales') WHERE name = 'revision'`)).toEqual([
      { name: "revision", dflt_value: "1" },
    ]);
  });

  it("keeps the raw compatibility surface disabled on a fresh master", async () => {
    const db = await upgradedDatabase();
    db.exec(migration);
    expect(rows(db, `SELECT value FROM settings WHERE key = 'network.legacy_trusted_lan'`)).toEqual([{ value: "0" }]);
  });
});
