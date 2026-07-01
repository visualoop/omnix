/**
 * Period close — freezes accounting periods so historical books can't be re-edited.
 *
 * Model:
 *   - financial_years span 12 months.
 *   - accounting_periods are optional monthly sub-periods.
 *   - Once a period is `closed`, journal_entries with entry_date inside it are read-only.
 *   - `soft_closed` allows edits by owner only.
 *
 * Guards to wire into calling code:
 *   ensureCanPost(entry_date) — throws if the date falls in a closed period.
 */
import { execute, query } from "@/lib/db";

export interface FinancialYear {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  closed_at: string | null;
  closed_by: string | null;
}

export interface Period {
  id: string;
  financial_year_id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "open" | "soft_closed" | "closed";
  closed_at: string | null;
  closed_by: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export async function listFinancialYears(): Promise<FinancialYear[]> {
  return query<FinancialYear>(
    `SELECT id, label, start_date, end_date, closed_at, closed_by
     FROM financial_years ORDER BY start_date DESC`,
  );
}

export async function createFinancialYear(label: string, startDate: string, endDate: string): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO financial_years (id, label, start_date, end_date) VALUES (?1, ?2, ?3, ?4)`,
    [id, label, startDate, endDate],
  );
  return id;
}

export async function closeFinancialYear(id: string, closedBy?: string): Promise<void> {
  await execute(
    `UPDATE financial_years SET closed_at = datetime('now'), closed_by = ?2 WHERE id = ?1`,
    [id, closedBy ?? null],
  );
}

export async function reopenFinancialYear(id: string): Promise<void> {
  await execute(`UPDATE financial_years SET closed_at = NULL, closed_by = NULL WHERE id = ?1`, [id]);
}

export async function listPeriods(fyId?: string): Promise<Period[]> {
  if (fyId) {
    return query<Period>(
      `SELECT id, financial_year_id, label, start_date, end_date, status, closed_at, closed_by
       FROM accounting_periods WHERE financial_year_id = ?1 ORDER BY start_date ASC`,
      [fyId],
    );
  }
  return query<Period>(
    `SELECT id, financial_year_id, label, start_date, end_date, status, closed_at, closed_by
     FROM accounting_periods ORDER BY start_date ASC`,
  );
}

export async function createPeriod(fyId: string, label: string, startDate: string, endDate: string): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO accounting_periods (id, financial_year_id, label, start_date, end_date)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, fyId, label, startDate, endDate],
  );
  return id;
}

export async function updatePeriodStatus(id: string, status: Period["status"], closedBy?: string): Promise<void> {
  if (status === "open") {
    await execute(
      `UPDATE accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ?1`,
      [id],
    );
  } else {
    await execute(
      `UPDATE accounting_periods SET status = ?2, closed_at = datetime('now'), closed_by = ?3 WHERE id = ?1`,
      [id, status, closedBy ?? null],
    );
  }
}

/**
 * Throws if posting a journal on `date` isn't allowed by open-period rules.
 * Call this from services/gl.ts before postJournal in a future patch.
 */
export async function ensureCanPost(date: string): Promise<void> {
  const rows = await query<{ status: string; label: string }>(
    `SELECT status, label FROM accounting_periods
      WHERE ?1 BETWEEN start_date AND end_date
      ORDER BY start_date DESC LIMIT 1`,
    [date],
  );
  const p = rows[0];
  if (!p) return; // no matching period → allow
  if (p.status === "closed") {
    throw new Error(`Period ${p.label} is closed — cannot post entries here. Reopen the period first.`);
  }
  // soft_closed intentionally allows through (owner override handled at UI).
}

/**
 * Ensure monthly periods exist for the given financial year.
 * Idempotent — safe to call multiple times.
 */
export async function ensureMonthlyPeriods(fyId: string): Promise<number> {
  const [fy] = await query<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM financial_years WHERE id = ?1`,
    [fyId],
  );
  if (!fy) return 0;
  const start = new Date(fy.start_date);
  const end = new Date(fy.end_date);
  let created = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const label = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = `${label}-01`;
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const monthEnd = `${label}-${String(nextMonth.getDate()).padStart(2, "0")}`;
    const [existing] = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM accounting_periods WHERE financial_year_id = ?1 AND label = ?2`,
      [fyId, label],
    );
    if ((existing?.n ?? 0) === 0) {
      await createPeriod(fyId, label, monthStart, monthEnd);
      created++;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return created;
}
