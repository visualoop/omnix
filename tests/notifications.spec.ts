/**
 * Notification centre — SQL smoke test.
 * Verifies the notifications table schema + queries the service uses.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

describe("SQL smoke — notifications", () => {
  it("notifications table exists after all migrations", async () => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'`,
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });

  it("insert + count-unread + mark-read chain", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO notifications (id, kind, severity, title, body, link, metadata, created_at)
       VALUES ('n1', 'expiry', 'warning', 'Panadol expires in 5 days', 'Batch on shelf', '/expiry', '{}', datetime('now'))`,
    );
    db.run(
      `INSERT INTO notifications (id, kind, severity, title, body, link, metadata, created_at)
       VALUES ('n2', 'low_stock', 'critical', 'Ibuprofen out of stock', null, '/inventory', '{}', datetime('now'))`,
    );

    const [countResult] = db.exec(
      `SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL`,
    );
    expect(countResult.values[0][0]).toBe(2);

    db.run(`UPDATE notifications SET read_at = datetime('now') WHERE id = 'n1'`);
    const [afterMark] = db.exec(
      `SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL`,
    );
    expect(afterMark.values[0][0]).toBe(1);
  });

  it("snoozed notifications are hidden from unread until snoozed_until passes", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO notifications (id, kind, severity, title, snoozed_until, created_at)
       VALUES ('n3', 'expiry', 'info', 'Later', datetime('now', '+1 day'), datetime('now'))`,
    );
    const [visible] = db.exec(
      `SELECT COUNT(*) AS n FROM notifications
        WHERE read_at IS NULL
          AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))`,
    );
    expect(visible.values[0][0]).toBe(0);

    // Simulate snooze expiring by setting to past
    db.run(`UPDATE notifications SET snoozed_until = datetime('now', '-1 hour') WHERE id = 'n3'`);
    const [visibleAfter] = db.exec(
      `SELECT COUNT(*) AS n FROM notifications
        WHERE read_at IS NULL
          AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))`,
    );
    expect(visibleAfter.values[0][0]).toBe(1);
  });
});
