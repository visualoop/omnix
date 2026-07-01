/**
 * Leave requests service
 */
import { query, execute } from "@/lib/db";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  paid: number;
  description: string | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  employee_name: string;
  employee_number: string;
  leave_type_name: string;
  leave_type_paid: number;
  approver_username: string | null;
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  return query<LeaveType>(`SELECT * FROM leave_types ORDER BY name`);
}

export async function listLeaveRequests(opts?: {
  status?: LeaveStatus;
  employeeId?: string;
}): Promise<LeaveRequestWithDetails[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.status) { conditions.push(`r.status = ?${params.length + 1}`); params.push(opts.status); }
  if (opts?.employeeId) { conditions.push(`r.employee_id = ?${params.length + 1}`); params.push(opts.employeeId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<LeaveRequestWithDetails>(
    `SELECT r.*, e.full_name AS employee_name, e.employee_number,
       lt.name AS leave_type_name, lt.paid AS leave_type_paid,
       u.username AS approver_username
     FROM leave_requests r
     JOIN employees e ON e.id = r.employee_id
     JOIN leave_types lt ON lt.id = r.leave_type_id
     LEFT JOIN users u ON u.id = r.approved_by
     ${where}
     ORDER BY r.created_at DESC
     LIMIT 500`,
    params,
  );
}

export async function createLeaveRequest(input: {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  // Calculate days inclusive
  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  await execute(
    `INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, days, reason, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')`,
    [id, input.employee_id, input.leave_type_id, input.start_date, input.end_date, days, input.reason || null],
  );
  return id;
}

export async function approveLeaveRequest(id: string, approverId: string, notes?: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status = 'approved', approved_by = ?2, approved_at = datetime('now'), notes = ?3
     WHERE id = ?1 AND status = 'pending'`,
    [id, approverId, notes || null],
  );
}

export async function rejectLeaveRequest(id: string, approverId: string, reason: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status = 'rejected', approved_by = ?2, approved_at = datetime('now'), rejection_reason = ?3
     WHERE id = ?1 AND status = 'pending'`,
    [id, approverId, reason],
  );
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status = 'cancelled' WHERE id = ?1 AND status = 'pending'`,
    [id],
  );
}

/** Days remaining for an employee for a leave type in current year. */
export async function getLeaveBalance(employeeId: string, leaveTypeId: string): Promise<{
  allowed: number;
  used: number;
  remaining: number;
}> {
  const year = new Date().getFullYear();
  const [type] = await query<LeaveType>(`SELECT * FROM leave_types WHERE id = ?1`, [leaveTypeId]);
  if (!type) return { allowed: 0, used: 0, remaining: 0 };

  const [used] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(days), 0) AS total FROM leave_requests
     WHERE employee_id = ?1 AND leave_type_id = ?2 AND status = 'approved'
       AND substr(start_date, 1, 4) = ?3`,
    [employeeId, leaveTypeId, String(year)],
  );

  return {
    allowed: type.days_per_year,
    used: used.total,
    remaining: Math.max(0, type.days_per_year - used.total),
  };
}
