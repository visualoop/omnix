/**
 * Service periods — lunch / dinner / brunch etc. shifts.
 * Table + seeds live in migration 082.
 *
 * Sessions record who opened + closed each shift, plus final gross
 * numbers. Only one session per period can be open at a time; opening
 * a new one when the previous is still open auto-closes the previous.
 */
import { query, execute } from "@/lib/db";
import { requirePermission } from "@/services/rbac";
import { requireActiveBranchId } from "@/stores/active-branch";

const uid = () => crypto.randomUUID();

export interface ServicePeriod {
  id: string;
  branch_id: string | null;
  name: string;
  starts_at: string;
  ends_at: string;
  active: number;
  created_at: string;
}

export interface ServicePeriodSession {
  id: string;
  period_id: string;
  period_name?: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  gross_sales: number | null;
  gross_covers: number | null;
}

export async function listServicePeriods(): Promise<ServicePeriod[]> {
  return query<ServicePeriod>(
    `SELECT id, branch_id, name, starts_at, ends_at, active, created_at
     FROM service_periods WHERE active = 1 AND branch_id = ?1 ORDER BY starts_at`,
    [requireActiveBranchId()],
  );
}

export async function upsertServicePeriod(input: {
  id?: string;
  name: string;
  startsAt: string;
  endsAt: string;
}): Promise<string> {
  await requirePermission("hospitality.tables.manage", { entityType: "service_period" });
  const branchId = requireActiveBranchId();
  const id = input.id ?? uid();
  if (input.id) {
    const [owned] = await query<{ id: string }>(`SELECT id FROM service_periods WHERE id = ?1 AND branch_id = ?2`, [id, branchId]);
    if (!owned) throw new Error("Service period not found in the active branch");
  }
  await execute(
    `INSERT INTO service_periods (id, name, starts_at, ends_at, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at`,
    [id, input.name, input.startsAt, input.endsAt, branchId],
  );
  return id;
}

export async function deleteServicePeriod(id: string): Promise<void> {
  await requirePermission("hospitality.tables.manage", { entityType: "service_period", entityId: id });
  const branchId = requireActiveBranchId();
  const result = await execute(`UPDATE service_periods SET active = 0 WHERE id = ?1 AND branch_id = ?2`, [id, branchId]);
  if (result.rowsAffected === 0) throw new Error("Service period not found in the active branch");
}

/** The session currently open right now, if any. UI header shows this. */
export async function currentOpenSession(): Promise<ServicePeriodSession | null> {
  const rows = await query<ServicePeriodSession>(
    `SELECT s.id, s.period_id, sp.name AS period_name,
            s.opened_at, s.closed_at, s.opened_by, s.closed_by,
            s.gross_sales, s.gross_covers
     FROM service_period_sessions s
     JOIN service_periods sp ON sp.id = s.period_id
     WHERE s.closed_at IS NULL AND sp.branch_id = ?1
     ORDER BY s.opened_at DESC LIMIT 1`,
    [requireActiveBranchId()],
  );
  return rows[0] ?? null;
}

/** Open a session for a given period. Any currently-open session is
 *  auto-closed with a note so we never have two open at once. */
export async function openSession(periodId: string, userId?: string): Promise<string> {
  await requirePermission("hospitality.orders.take", { entityType: "service_period_session" });
  const branchId = requireActiveBranchId();
  const [period] = await query<{ id: string }>(`SELECT id FROM service_periods WHERE id = ?1 AND branch_id = ?2`, [periodId, branchId]);
  if (!period) throw new Error("Service period not found in the active branch");
  // Close any previously-open session.
  await execute(
    `UPDATE service_period_sessions SET closed_at = datetime('now'), closed_by = ?1
     WHERE closed_at IS NULL AND period_id IN (SELECT id FROM service_periods WHERE branch_id = ?2)`,
    [userId ?? null, branchId],
  );
  const id = uid();
  await execute(
    `INSERT INTO service_period_sessions (id, period_id, opened_by) VALUES (?1, ?2, ?3)`,
    [id, periodId, userId ?? null],
  );
  return id;
}

export async function closeSession(sessionId: string, userId?: string): Promise<void> {
  await requirePermission("hospitality.orders.take", { entityType: "service_period_session", entityId: sessionId });
  // Compute gross sales + covers from hospitality_orders inside the session window.
  const branchId = requireActiveBranchId();
  const [session] = await query<{ opened_at: string }>(
    `SELECT s.opened_at FROM service_period_sessions s JOIN service_periods sp ON sp.id = s.period_id WHERE s.id = ?1 AND sp.branch_id = ?2`,
    [sessionId, branchId],
  );
  if (!session) throw new Error("Session not found");
  const [totals] = await query<{ sales: number; covers: number }>(
    `SELECT
       COALESCE(SUM(oi.line_total), 0) AS sales,
       COALESCE(SUM(o.party_size), 0) AS covers
     FROM hospitality_orders o
     LEFT JOIN hospitality_order_items oi ON oi.order_id = o.id AND oi.status != 'voided'
     WHERE o.opened_at >= ?1 AND o.opened_at <= datetime('now') AND o.branch_id = ?2`,
    [session.opened_at, branchId],
  );
  await execute(
    `UPDATE service_period_sessions
     SET closed_at = datetime('now'),
         closed_by = ?2,
         gross_sales = ?3,
         gross_covers = ?4
     WHERE id = ?1`,
    [sessionId, userId ?? null, totals?.sales ?? 0, totals?.covers ?? 0],
  );
}
