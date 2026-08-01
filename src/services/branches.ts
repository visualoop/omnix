/**
 * Branches service — multi-location support.
 */
import { query, execute, transaction } from "@/lib/db";
import { getCountryFieldMetadata } from "@/lib/countries";
import { useCountry } from "@/stores/country";

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  is_default: number;
  active: number;
  timezone: string;
  kra_pin: string | null;
  etims_device_id: string | null;
  open_time: string | null;
  close_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface BranchWithStats extends Branch {
  manager_name: string | null;
  user_count: number;
  sales_today: number;
  sales_today_count: number;
}

export async function listBranches(includeInactive = false): Promise<BranchWithStats[]> {
  const where = includeInactive ? "1=1" : "b.active = 1";
  return query<BranchWithStats>(
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
     WHERE ${where}
     ORDER BY b.is_default DESC, b.name`,
  );
}

export async function getBranch(id: string): Promise<Branch | null> {
  const rows = await query<Branch>(`SELECT * FROM branches WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function getDefaultBranchId(): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM branches WHERE is_default = 1 LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

export async function upsertBranch(input: Partial<Branch> & { code: string; name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  const countryCode = useCountry.getState().code;
  const timezone = input.timezone || getCountryFieldMetadata(countryCode).timezone;
  const kenyaOnlyKraPin = countryCode === "KE" ? input.kra_pin || null : null;
  const kenyaOnlyEtimsDevice = countryCode === "KE" ? input.etims_device_id || null : null;
  if (input.id) {
    await execute(
      `UPDATE branches SET
         code = ?2, name = ?3, address = ?4, phone = ?5, email = ?6,
         manager_id = ?7, active = ?8, timezone = ?9, kra_pin = ?10,
         etims_device_id = ?11, open_time = ?12, close_time = ?13, notes = ?14
       WHERE id = ?1`,
      [
        id, input.code, input.name, input.address || null, input.phone || null,
        input.email || null, input.manager_id || null, input.active ?? 1,
        timezone, kenyaOnlyKraPin,
        kenyaOnlyEtimsDevice, input.open_time || null,
        input.close_time || null, input.notes || null,
      ],
    );
  } else {
    await execute(
      `INSERT INTO branches (id, code, name, address, phone, email, manager_id, active, timezone,
         kra_pin, etims_device_id, open_time, close_time, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      [
        id, input.code, input.name, input.address || null, input.phone || null,
        input.email || null, input.manager_id || null, input.active ?? 1,
        timezone, kenyaOnlyKraPin,
        kenyaOnlyEtimsDevice, input.open_time || null,
        input.close_time || null, input.notes || null,
      ],
    );
  }
  return id;
}

export async function setDefaultBranch(id: string): Promise<void> {
  await execute(`UPDATE branches SET is_default = CASE WHEN id = ?1 THEN 1 ELSE 0 END`, [id]);
}

export async function deactivateBranch(id: string): Promise<void> {
  const def = await getDefaultBranchId();
  if (id === def) throw new Error("Cannot deactivate the default branch");
  await execute(`UPDATE branches SET active = 0 WHERE id = ?1`, [id]);
}

// ─── User-branch assignments ───────────────────────────────────────────
export async function getUserBranches(userId: string): Promise<Branch[]> {
  return query<Branch>(
    `SELECT b.* FROM branches b
     JOIN user_branches ub ON ub.branch_id = b.id
     WHERE ub.user_id = ?1 AND b.active = 1
     ORDER BY ub.is_primary DESC, b.name`,
    [userId],
  );
}

/**
 * Resolve legacy missing branch access without widening deliberate revocations.
 * Only real, active rows are eligible: the active default branch, or the sole
 * active branch when no active default exists. The chosen row is persisted.
 */
export async function getOrRepairUserBranches(userId: string): Promise<Branch[]> {
  const assigned = await getUserBranches(userId);
  if (assigned.length > 0) return assigned;

  const candidates = await query<Branch>(
    `WITH preferred_branch AS (
       SELECT id
       FROM branches
       WHERE active = 1 AND is_default = 1
       ORDER BY created_at, id
       LIMIT 1
     ),
     single_active_branch AS (
       SELECT MIN(id) AS id
       FROM branches
       WHERE active = 1
       HAVING COUNT(*) = 1
     ),
     candidate AS (
       SELECT id FROM preferred_branch
       UNION ALL
       SELECT id FROM single_active_branch
       WHERE NOT EXISTS (SELECT 1 FROM preferred_branch)
       LIMIT 1
     )
     SELECT b.*
     FROM branches b
     JOIN candidate ON candidate.id = b.id
     WHERE NOT EXISTS (
       SELECT 1
       FROM user_branch_assignment_revocations revoked
       WHERE revoked.user_id = ?1
     )`,
    [userId],
  );
  const candidate = candidates[0];
  if (!candidate) return [];

  // Re-check the revocation marker inside the mutation to avoid granting
  // access if an administrator revoked the user during the preceding read.
  await execute(
    `INSERT OR IGNORE INTO user_branches (user_id, branch_id, is_primary)
     SELECT ?1, ?2, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM user_branch_assignment_revocations WHERE user_id = ?1
     )`,
    [userId, candidate.id],
  );
  return getUserBranches(userId);
}

export async function assignUserToBranch(userId: string, branchId: string, isPrimary = false): Promise<void> {
  await transaction([
    {
      sql: `DELETE FROM user_branch_assignment_revocations WHERE user_id = ?1`,
      params: [userId],
    },
    {
      sql: `INSERT INTO user_branches (user_id, branch_id, is_primary)
            SELECT ?1, ?2,
                   CASE WHEN ?3 = 1 OR NOT EXISTS (
                     SELECT 1 FROM user_branches WHERE user_id = ?1
                   ) THEN 1 ELSE 0 END
            ON CONFLICT(user_id, branch_id) DO UPDATE SET
              is_primary = CASE
                WHEN excluded.is_primary = 1 THEN 1
                ELSE user_branches.is_primary
              END`,
      params: [userId, branchId, isPrimary ? 1 : 0],
    },
    ...(isPrimary ? [{
      sql: `UPDATE user_branches
            SET is_primary = CASE WHEN branch_id = ?2 THEN 1 ELSE 0 END
            WHERE user_id = ?1`,
      params: [userId, branchId],
    }] : []),
  ]);
}

export async function removeUserFromBranch(userId: string, branchId: string): Promise<void> {
  await transaction([
    {
      sql: `DELETE FROM user_branches WHERE user_id = ?1 AND branch_id = ?2`,
      params: [userId, branchId],
    },
    {
      sql: `UPDATE user_branches
            SET is_primary = CASE WHEN branch_id = (
              SELECT branch_id
              FROM user_branches
              WHERE user_id = ?1
              ORDER BY is_primary DESC, granted_at, branch_id
              LIMIT 1
            ) THEN 1 ELSE 0 END
            WHERE user_id = ?1`,
      params: [userId],
    },
    {
      sql: `INSERT INTO user_branch_assignment_revocations (user_id, revoked_at)
            SELECT ?1, datetime('now')
            WHERE NOT EXISTS (
              SELECT 1 FROM user_branches WHERE user_id = ?1
            )
            ON CONFLICT(user_id) DO UPDATE SET revoked_at = excluded.revoked_at`,
      params: [userId],
    },
  ]);
}


export async function listUserBranches(userId: string): Promise<Array<{ id: string; name: string; is_primary: number }>> {
  return query<{ id: string; name: string; is_primary: number }>(
    `SELECT b.id, b.name, ub.is_primary
     FROM user_branches ub
     JOIN branches b ON b.id = ub.branch_id
     WHERE ub.user_id = ?1
     ORDER BY ub.is_primary DESC, b.name`,
    [userId],
  );
}

/**
 * Read-only branch performance visible to a manager. Owners may use
 * listBranches(); non-owner manager views must use this assignment-scoped
 * query so an unassigned branch cannot leak through aggregate cards.
 */
export async function listAssignedBranchPerformance(
  userId: string,
  includeInactive = false,
): Promise<BranchWithStats[]> {
  const activeClause = includeInactive ? "1=1" : "b.active = 1";
  return query<BranchWithStats>(
    `SELECT
       b.*,
       u.full_name AS manager_name,
       (SELECT COUNT(*) FROM user_branches members WHERE members.branch_id = b.id) AS user_count,
       COALESCE((SELECT SUM(total) FROM sales
         WHERE branch_id = b.id AND date(created_at) = date('now') AND status = 'completed'), 0)
       - COALESCE((SELECT SUM(refund_amount) FROM sale_returns
         WHERE branch_id = b.id AND date(created_at) = date('now')), 0) AS sales_today,
       COALESCE((SELECT COUNT(*) FROM sales
         WHERE branch_id = b.id AND date(created_at) = date('now') AND status = 'completed'), 0) AS sales_today_count
     FROM user_branches access
     JOIN branches b ON b.id = access.branch_id
     LEFT JOIN users u ON u.id = b.manager_id
     WHERE access.user_id = ?1 AND ${activeClause}
     ORDER BY b.is_default DESC, b.name`,
    [userId],
  );
}
