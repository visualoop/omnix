import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("src-tauri/migrations/101_branch_assignment_backfill.sql"),
  "utf8",
);

async function legacyDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, active INTEGER NOT NULL);
    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_branches (
      user_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, branch_id)
    );
  `);
  return db;
}

function rows(db: Database, sql: string): Array<Record<string, unknown>> {
  const result = db.exec(sql)[0];
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(
    result.columns.map((column, index) => [column, values[index]]),
  ));
}

describe("migration 101 branch assignment backfill", () => {
  it("repairs every active upgraded user with no assignment using the real default branch", async () => {
    const db = await legacyDatabase();
    db.exec(`
      INSERT INTO users (id, active) VALUES ('missing', 1), ('assigned', 1), ('inactive', 0);
      INSERT INTO branches (id, is_default, active) VALUES
        ('real-default', 1, 1),
        ('other-active', 0, 1);
      INSERT INTO user_branches (user_id, branch_id, is_primary)
      VALUES ('assigned', 'other-active', 1);
    `);

    db.exec(migration);
    db.exec(migration);

    expect(rows(db, `SELECT user_id, branch_id, is_primary FROM user_branches ORDER BY user_id`)).toEqual([
      { user_id: "assigned", branch_id: "other-active", is_primary: 1 },
      { user_id: "missing", branch_id: "real-default", is_primary: 1 },
    ]);
  });

  it("uses the sole active branch when there is no active default", async () => {
    const db = await legacyDatabase();
    db.exec(`
      INSERT INTO users (id, active) VALUES ('missing', 1);
      INSERT INTO branches (id, is_default, active) VALUES
        ('sole-active', 0, 1),
        ('old-default', 1, 0);
    `);

    db.exec(migration);

    expect(rows(db, `SELECT user_id, branch_id, is_primary FROM user_branches`)).toEqual([
      { user_id: "missing", branch_id: "sole-active", is_primary: 1 },
    ]);
  });
});
