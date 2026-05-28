/**
 * Branches service — multi-location support.
 */
import { query, execute } from "@/lib/db";

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

export const DEFAULT_BRANCH_ID = "default-branch";

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

export async function getDefaultBranchId(): Promise<string> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM branches WHERE is_default = 1 LIMIT 1`,
  );
  return rows[0]?.id || DEFAULT_BRANCH_ID;
}

export async function upsertBranch(input: Partial<Branch> & { code: string; name: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
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
        input.timezone || "Africa/Nairobi", input.kra_pin || null,
        input.etims_device_id || null, input.open_time || null,
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
        input.timezone || "Africa/Nairobi", input.kra_pin || null,
        input.etims_device_id || null, input.open_time || null,
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

export async function assignUserToBranch(userId: string, branchId: string, isPrimary = false): Promise<void> {
  await execute(
    `INSERT OR REPLACE INTO user_branches (user_id, branch_id, is_primary)
     VALUES (?1, ?2, ?3)`,
    [userId, branchId, isPrimary ? 1 : 0],
  );
  if (isPrimary) {
    await execute(
      `UPDATE user_branches SET is_primary = 0 WHERE user_id = ?1 AND branch_id != ?2`,
      [userId, branchId],
    );
  }
}

export async function removeUserFromBranch(userId: string, branchId: string): Promise<void> {
  await execute(
    `DELETE FROM user_branches WHERE user_id = ?1 AND branch_id = ?2`,
    [userId, branchId],
  );
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
