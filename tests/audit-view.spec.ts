/**
 * audit-view.spec.ts — migration 074 creates a `audit_log_unified` VIEW that
 * UNIONs license_activations + sales + audit_log into a common shape.
 * These tests verify:
 *   • The view exists after migrations.
 *   • Each source contributes rows with the expected 'kind' label.
 *   • Held sales are excluded.
 *   • Description formatting for each kind renders sensible text.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "sql.js";
import { openTestDb, selectAll, exec } from "./helpers/sql-harness";

describe("audit_log_unified view", () => {
  let db: Database;

  beforeEach(async () => {
    db = await openTestDb();
    exec(
      db,
      `INSERT INTO users (id, username, full_name, password_hash, role) VALUES ('u-1', 't', 'Test User', 'x', 'owner')`,
    );
  });

  it("exists as a VIEW after migrations", () => {
    const rows = selectAll<{ type: string; name: string }>(
      db,
      `SELECT type, name FROM sqlite_master WHERE name = 'audit_log_unified'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("view");
  });

  it("surfaces permission events as kind='permission'", () => {
    exec(
      db,
      `INSERT INTO audit_log (id, user_id, user_name, permission_key, action, outcome, risk_level)
       VALUES ('a-1', 'u-1', 'Test User', 'inventory.edit', 'edit', 'allowed', 'low')`,
    );
    const rows = selectAll<{ kind: string; description: string }>(
      db,
      `SELECT kind, description FROM audit_log_unified WHERE id = 'perm-a-1'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("permission");
    expect(rows[0].description).toContain("Allowed");
    expect(rows[0].description).toContain("inventory.edit");
  });

  it("surfaces license_activations as kind='license'", () => {
    exec(
      db,
      `INSERT INTO license_activations (id, license_kid, machine_fingerprint, event)
       VALUES ('l-1', 'kid-abc', 'FP-XYZ', 'activated')`,
    );
    const rows = selectAll<{ kind: string; description: string }>(
      db,
      `SELECT kind, description FROM audit_log_unified WHERE id = 'lic-l-1'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("license");
    expect(rows[0].description).toBe("License activated: kid-abc");
  });

  it("surfaces completed sales as kind='sale'", () => {
    exec(
      db,
      `INSERT INTO sales (id, sale_number, user_id, branch_id, status, total, subtotal)
       VALUES ('s-1', 42, 'u-1', 'default-branch', 'completed', 1500.50, 1500.50)`,
    );
    const rows = selectAll<{ kind: string; description: string }>(
      db,
      `SELECT kind, description FROM audit_log_unified WHERE id = 'sale-s-1'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("sale");
    expect(rows[0].description).toBe("Sale #42 (1500.50)");
  });

  it("surfaces voided sales as kind='void'", () => {
    exec(
      db,
      `INSERT INTO sales (id, sale_number, user_id, branch_id, status, total, subtotal)
       VALUES ('s-2', 43, 'u-1', 'default-branch', 'voided', 2000, 2000)`,
    );
    const rows = selectAll<{ kind: string; description: string }>(
      db,
      `SELECT kind, description FROM audit_log_unified WHERE id = 'sale-s-2'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("void");
    expect(rows[0].description).toContain("voided");
  });

  it("excludes held sales", () => {
    exec(
      db,
      `INSERT INTO sales (id, sale_number, user_id, branch_id, status, total, subtotal)
       VALUES ('s-3', 44, 'u-1', 'default-branch', 'held', 100, 100)`,
    );
    const rows = selectAll<{ id: string }>(
      db,
      `SELECT id FROM audit_log_unified WHERE id = 'sale-s-3'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("supports paginating the merged feed via LIMIT/OFFSET", () => {
    for (let i = 0; i < 20; i++) {
      exec(
        db,
        `INSERT INTO audit_log (id, user_id, user_name, permission_key, action, outcome, risk_level, created_at)
         VALUES ('p-${i}', 'u-1', 'Test User', 'sales.void', 'void', 'allowed', 'low', datetime('now', '-${i} hours'))`,
      );
    }
    const page1 = selectAll<{ id: string }>(
      db,
      `SELECT id FROM audit_log_unified ORDER BY created_at DESC LIMIT 5 OFFSET 0`,
    );
    const page2 = selectAll<{ id: string }>(
      db,
      `SELECT id FROM audit_log_unified ORDER BY created_at DESC LIMIT 5 OFFSET 5`,
    );
    expect(page1).toHaveLength(5);
    expect(page2).toHaveLength(5);
    // Every page1 id should differ from every page2 id
    const overlap = page1.filter((r) => page2.some((r2) => r2.id === r.id));
    expect(overlap).toHaveLength(0);
  });
});
