/**
 * Attendance service
 */
import { query, execute } from "@/lib/db";
import { getActiveBranchId } from "@/stores/active-branch";

export type AttendanceStatus = "present" | "absent" | "sick" | "leave" | "holiday" | "half-day";

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  status: AttendanceStatus;
  notes: string | null;
  branch_id: string | null;
}

export interface AttendanceWithEmployee extends Attendance {
  employee_name: string;
  employee_number: string;
  job_title: string;
}

export async function listAttendance(opts?: {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  branchId?: string;
}): Promise<AttendanceWithEmployee[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.startDate) { conditions.push(`a.work_date >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`a.work_date <= ?${params.length + 1}`); params.push(opts.endDate); }
  if (opts?.employeeId) { conditions.push(`a.employee_id = ?${params.length + 1}`); params.push(opts.employeeId); }
  if (opts?.branchId) { conditions.push(`a.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<AttendanceWithEmployee>(
    `SELECT a.*, e.full_name AS employee_name, e.employee_number, e.job_title
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     ${where}
     ORDER BY a.work_date DESC, e.full_name
     LIMIT 500`,
    params,
  );
}

export async function getTodayAttendance(employeeId: string): Promise<Attendance | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await query<Attendance>(
    `SELECT * FROM attendance WHERE employee_id = ?1 AND work_date = ?2`,
    [employeeId, today],
  );
  return rows[0] || null;
}

export async function clockIn(employeeId: string, notes?: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const existing = await getTodayAttendance(employeeId);
  if (existing) {
    if (existing.clock_in) throw new Error("Already clocked in today");
    await execute(
      `UPDATE attendance SET clock_in = ?2, status = 'present' WHERE id = ?1`,
      [existing.id, now],
    );
    return existing.id;
  }
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO attendance (id, employee_id, work_date, clock_in, status, notes, branch_id)
     VALUES (?1, ?2, ?3, ?4, 'present', ?5, ?6)`,
    [id, employeeId, today, now, notes || null, getActiveBranchId()],
  );
  return id;
}

export async function clockOut(employeeId: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getTodayAttendance(employeeId);
  if (!existing) throw new Error("Not clocked in today");
  if (existing.clock_out) throw new Error("Already clocked out");
  await execute(
    `UPDATE attendance SET clock_out = ?2 WHERE id = ?1`,
    [existing.id, now],
  );
}

export async function setAttendanceStatus(input: {
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  notes?: string;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM attendance WHERE employee_id = ?1 AND work_date = ?2`,
    [input.employee_id, input.work_date],
  );
  if (rows[0]) {
    await execute(
      `UPDATE attendance SET status = ?2, notes = ?3 WHERE id = ?1`,
      [rows[0].id, input.status, input.notes || null],
    );
    return rows[0].id;
  }
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO attendance (id, employee_id, work_date, status, notes, branch_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, input.employee_id, input.work_date, input.status, input.notes || null, getActiveBranchId()],
  );
  return id;
}

/** Worked minutes for a given record (clock_out - clock_in - break). */
export function workedMinutes(a: Attendance): number {
  if (!a.clock_in || !a.clock_out) return 0;
  const ms = new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime();
  return Math.max(0, Math.floor(ms / 60000) - (a.break_minutes || 0));
}

export function formatDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/** Aggregate days worked / hours worked for an employee in a period. Used by payroll for daily/hourly pay types. */
export async function getEmployeePeriodStats(employeeId: string, startDate: string, endDate: string): Promise<{
  days_present: number;
  days_absent: number;
  days_sick: number;
  days_leave: number;
  total_minutes_worked: number;
}> {
  const rows = await query<Attendance>(
    `SELECT * FROM attendance WHERE employee_id = ?1 AND work_date >= ?2 AND work_date <= ?3`,
    [employeeId, startDate, endDate],
  );
  let stats = { days_present: 0, days_absent: 0, days_sick: 0, days_leave: 0, total_minutes_worked: 0 };
  for (const r of rows) {
    if (r.status === "present" || r.status === "half-day") {
      stats.days_present += r.status === "half-day" ? 0.5 : 1;
      stats.total_minutes_worked += workedMinutes(r);
    } else if (r.status === "absent") stats.days_absent += 1;
    else if (r.status === "sick") stats.days_sick += 1;
    else if (r.status === "leave") stats.days_leave += 1;
  }
  return stats;
}
