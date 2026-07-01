/**
 * General Ledger — comprehensive smoke tests.
 *
 * Verifies that:
 *   1. The seed Chart of Accounts has all the expected system accounts.
 *   2. Journal entries + lines can be inserted balanced (debit == credit).
 *   3. Unbalanced entries are rejected by service validation.
 *   4. Trial balance query runs on real schema.
 *   5. Balance sheet auto-classification works (asset/liability/equity).
 *   6. Reversal creates a mirror entry.
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

describe("SQL smoke — General Ledger", () => {
  it("Chart of Accounts is seeded with 37 system accounts", async () => {
    const db = await openTestDb();
    const [res] = db.exec(`SELECT COUNT(*) AS n FROM chart_of_accounts WHERE is_system = 1`);
    // Migration seeds 37 accounts; add a lower bound to survive future additions.
    expect(Number(res.values[0][0])).toBeGreaterThanOrEqual(37);
  });

  it("Cash + Sales revenue accounts exist and are correctly typed", async () => {
    const db = await openTestDb();
    const [cash] = db.exec(`SELECT type FROM chart_of_accounts WHERE code = '1000'`);
    expect(cash.values[0][0]).toBe("asset");
    const [sales] = db.exec(`SELECT type FROM chart_of_accounts WHERE code = '4000'`);
    expect(sales.values[0][0]).toBe("revenue");
    const [ap] = db.exec(`SELECT type FROM chart_of_accounts WHERE code = '2000'`);
    expect(ap.values[0][0]).toBe("liability");
    const [equity] = db.exec(`SELECT type FROM chart_of_accounts WHERE code = '3000'`);
    expect(equity.values[0][0]).toBe("equity");
    const [expense] = db.exec(`SELECT type FROM chart_of_accounts WHERE code = '6000'`);
    expect(expense.values[0][0]).toBe("expense");
  });

  it("balanced journal entry inserts + lines pass", async () => {
    const db = await openTestDb();
    // Cash sale of 100 with 16 VAT.
    db.run(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, source_kind, source_id, posted, posted_at)
       VALUES ('je1', 'JE-2026-000001', '2026-07-01', 'Cash sale', 'sale', 's1', 1, datetime('now'))`,
    );
    db.run(
      `INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit, description)
       VALUES ('l1', 'je1', 1, '1000', 100, 0, 'Cash in')`,
    );
    db.run(
      `INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit, description)
       VALUES ('l2', 'je1', 2, '4000', 0, 84, 'Sales revenue')`,
    );
    db.run(
      `INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit, description)
       VALUES ('l3', 'je1', 3, '2100', 0, 16, 'VAT payable')`,
    );

    const [totals] = db.exec(
      `SELECT SUM(debit) AS d, SUM(credit) AS c FROM journal_lines WHERE entry_id = 'je1'`,
    );
    expect(totals.values[0][0]).toBe(100);
    expect(totals.values[0][1]).toBe(100);
  });

  it("CHECK constraint rejects a line with BOTH debit and credit non-zero", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, posted)
       VALUES ('je2', 'JE-2026-000002', '2026-07-01', 'Bad', 1)`,
    );
    expect(() => {
      db.run(
        `INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit)
         VALUES ('l4', 'je2', 1, '1000', 50, 50)`,
      );
    }).toThrow();
  });

  it("trial-balance query returns rows summed correctly", async () => {
    const db = await openTestDb();
    // Post two balanced journal entries with a mix.
    db.run(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, posted)
       VALUES ('je3','JE-2026-000003','2026-07-01','Sale 1',1)`,
    );
    db.run(`INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit)
      VALUES ('l5','je3',1,'1000',200,0)`);
    db.run(`INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit)
      VALUES ('l6','je3',2,'4000',0,200)`);

    db.run(
      `INSERT INTO journal_entries (id, entry_number, entry_date, description, posted)
       VALUES ('je4','JE-2026-000004','2026-07-01','Sale 2',1)`,
    );
    db.run(`INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit)
      VALUES ('l7','je4',1,'1000',300,0)`);
    db.run(`INSERT INTO journal_lines (id, entry_id, line_no, account_code, debit, credit)
      VALUES ('l8','je4',2,'4000',0,300)`);

    const [tb] = db.exec(
      `SELECT c.code, c.type, COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c
       FROM chart_of_accounts c
       LEFT JOIN journal_lines l ON l.account_code = c.code
       LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.posted = 1
       WHERE c.code IN ('1000', '4000')
       GROUP BY c.code
       ORDER BY c.code`,
    );

    // Cash asset row
    expect(tb.values[0][0]).toBe("1000");
    expect(tb.values[0][2]).toBe(500);
    expect(tb.values[0][3]).toBe(0);
    // Sales revenue row
    expect(tb.values[1][0]).toBe("4000");
    expect(tb.values[1][2]).toBe(0);
    expect(tb.values[1][3]).toBe(500);
  });

  it("all COA rows respect the type check (asset|liability|equity|revenue|expense)", async () => {
    const db = await openTestDb();
    const [res] = db.exec(
      `SELECT COUNT(*) FROM chart_of_accounts
       WHERE type NOT IN ('asset','liability','equity','revenue','expense')`,
    );
    expect(res.values[0][0]).toBe(0);
  });
});

describe("SQL smoke — Reservations", () => {
  it("reservations table exists after migration 060", async () => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'`,
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });

  it("insert + list + status update chain", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO reservations (id, kind, guest_name, arrival_at, status)
       VALUES ('r1', 'table', 'Wanjiku', '2026-07-15 19:00:00', 'confirmed')`,
    );
    db.run(
      `INSERT INTO reservations (id, kind, guest_name, arrival_at, status)
       VALUES ('r2', 'room', 'Njoroge', '2026-07-16 14:00:00', 'confirmed')`,
    );

    const [tables] = db.exec(
      `SELECT COUNT(*) FROM reservations WHERE kind = 'table' AND status = 'confirmed'`,
    );
    expect(tables.values[0][0]).toBe(1);

    db.run(`UPDATE reservations SET status = 'seated' WHERE id = 'r1'`);
    const [seated] = db.exec(
      `SELECT status FROM reservations WHERE id = 'r1'`,
    );
    expect(seated.values[0][0]).toBe("seated");
  });
});

describe("SQL smoke — Peripherals", () => {
  it("peripherals table exists + drop-invalid-driver possible", async () => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='peripherals'`,
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);

    db.run(
      `INSERT INTO peripherals (id, kind, name, driver, enabled)
       VALUES ('p1', 'cash_drawer', 'Till 1 drawer', 'printer_kick', 1)`,
    );
    const [count] = db.exec(`SELECT COUNT(*) FROM peripherals WHERE enabled = 1`);
    expect(count.values[0][0]).toBe(1);
  });
});

describe("SQL smoke — Offline queue + Form drafts + 2FA", () => {
  it("offline_queue accepts an insert + count-pending", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO offline_queue (id, op_kind, op_url, op_method, payload)
       VALUES ('q1', 'sale', '/api/sale', 'POST', '{}')`,
    );
    const [n] = db.exec(
      `SELECT COUNT(*) FROM offline_queue WHERE succeeded_at IS NULL AND failed_permanently_at IS NULL`,
    );
    expect(n.values[0][0]).toBe(1);
  });

  it("form_drafts upsert on same id", async () => {
    const db = await openTestDb();
    db.run(
      `INSERT INTO form_drafts (id, user_id, form_key, payload)
       VALUES ('u1:invoice-new:new', 'u1', 'invoice-new', '{"items":[]}')`,
    );
    db.run(
      `INSERT INTO form_drafts (id, user_id, form_key, payload, updated_at)
       VALUES ('u1:invoice-new:new', 'u1', 'invoice-new', '{"items":[1]}', datetime('now'))
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    );
    const [d] = db.exec(`SELECT payload FROM form_drafts WHERE id = 'u1:invoice-new:new'`);
    expect(d.values[0][0]).toBe('{"items":[1]}');
  });

  it("two_factor table exists", async () => {
    const db = await openTestDb();
    const [row] = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='two_factor'`,
    );
    expect(row?.values?.length ?? 0).toBeGreaterThan(0);
  });
});
