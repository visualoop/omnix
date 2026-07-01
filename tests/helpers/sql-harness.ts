/**
 * Test harness — runs every migration SQL file against an in-memory
 * SQLite (via sql.js WASM), then lets tests execute queries against
 * that real schema.
 *
 * This is the piece the codebase was missing. Before this file:
 *   - Vitest tested pure-JS helpers (tax math, stage machines, etc.)
 *   - No test ever executed a SQL string against a real schema
 *   - So when v0.28.2 introduced `SELECT SUM(refunded_amount) FROM sales`
 *     nothing caught the fact that the column doesn't exist on installs
 *     that missed migration 053. Users got "no such column" in the wild.
 *
 * With this file:
 *   - Each `openTestDb()` returns a fresh in-memory SQLite with EVERY
 *     migration in src-tauri/migrations/ applied in order.
 *   - Query tests execute the actual SQL that services run.
 *   - CI fails immediately when a service references a non-existent
 *     column or a query has a syntax error.
 *
 * Sqlite dialect is 1:1 with Tauri's tauri-plugin-sql (both are libsqlite3),
 * so anything that runs here runs identically on desktop.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let sqlJs: SqlJsStatic | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) sqlJs = await initSqlJs();
  return sqlJs;
}

const MIGRATIONS_DIR = join(process.cwd(), "src-tauri", "migrations");

/** Read every .sql file in numeric order — same as the Rust migrator does. */
function readMigrations(): Array<{ name: string; sql: string }> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 001_*, 002_*, ..., 053_* — lexical == numeric for zero-padded names
  return files.map((name) => ({
    name,
    sql: readFileSync(join(MIGRATIONS_DIR, name), "utf-8"),
  }));
}

/**
 * Open a fresh in-memory SQLite with every migration applied.
 * Each test gets its own DB (no state leaks between tests).
 *
 * @param opts.skipSeeds  set true if you want an empty DB (no default rows).
 */
export async function openTestDb(): Promise<Database> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  const migrations = readMigrations();
  for (const m of migrations) {
    try {
      db.exec(m.sql);
    } catch (e) {
      throw new Error(`Migration ${m.name} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return db;
}

/**
 * Convenience: run one SELECT and return the rows as objects.
 * Mirrors the shape of the desktop `query<T>()` helper.
 */
export function selectAll<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** Convenience: run a mutation. Throws if it fails. */
export function exec(db: Database, sql: string, params: (string | number | null)[] = []): void {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
}
