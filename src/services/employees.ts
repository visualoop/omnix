/**
 * Employees service.
 */
import { query, execute } from "@/lib/db";

export type EmploymentType = "permanent" | "contract" | "casual" | "intern";
export type PayType = "monthly" | "daily" | "hourly" | "piece_rate" | "commission_only";
export type Gender = "male" | "female" | "other" | null;

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_number: string;
  user_id: string | null;
  full_name: string;
  id_number: string | null;
  kra_pin: string | null;
  nssf_number: string | null;
  shif_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: Gender;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  photo_path: string | null;
  department_id: string | null;
  job_title: string;
  branch_id: string | null;
  employment_type: EmploymentType;
  hire_date: string;
  termination_date: string | null;
  termination_reason: string | null;
  active: number;
  pay_type: PayType;
  base_salary: number;
  daily_rate: number | null;
  hourly_rate: number | null;
  commission_rate: number | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  paybill_or_phone: string | null;
  notes: string | null;
  is_pharmacist?: number;
  pharmacist_license_number?: string | null;
  pharmacist_license_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithDetails extends Employee {
  department_name: string | null;
  branch_name: string | null;
  username: string | null;
}

export interface LinkableUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

// ─── Departments ───────────────────────────────────────────────────────
export async function listDepartments(): Promise<Department[]> {
  return query<Department>(`SELECT * FROM departments ORDER BY name`);
}

export async function upsertDepartment(input: Partial<Department> & { name: string }): Promise<string> {
  const id = input.id || `dept-${Date.now()}`;
  if (input.id) {
    await execute(
      `UPDATE departments SET name = ?2, description = ?3, manager_id = ?4 WHERE id = ?1`,
      [id, input.name, input.description || null, input.manager_id || null],
    );
  } else {
    await execute(
      `INSERT INTO departments (id, name, description, manager_id) VALUES (?1, ?2, ?3, ?4)`,
      [id, input.name, input.description || null, input.manager_id || null],
    );
  }
  return id;
}

// ─── Employees ─────────────────────────────────────────────────────────
export async function listEmployees(opts?: {
  branchId?: string;
  departmentId?: string;
  active?: boolean;
  search?: string;
}): Promise<EmployeeWithDetails[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.active !== undefined) { conditions.push(`e.active = ?${params.length + 1}`); params.push(opts.active ? 1 : 0); }
  if (opts?.branchId) { conditions.push(`e.branch_id = ?${params.length + 1}`); params.push(opts.branchId); }
  if (opts?.departmentId) { conditions.push(`e.department_id = ?${params.length + 1}`); params.push(opts.departmentId); }
  if (opts?.search?.trim()) {
    conditions.push(`(e.full_name LIKE ?${params.length + 1} OR e.employee_number LIKE ?${params.length + 1} OR e.phone LIKE ?${params.length + 1})`);
    params.push(`%${opts.search.trim()}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query<EmployeeWithDetails>(
    `SELECT e.*,
       d.name AS department_name,
       b.name AS branch_name,
       u.username AS username
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN branches b ON b.id = e.branch_id
     LEFT JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY e.active DESC, e.full_name`,
    params,
  );
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const rows = await query<Employee>(`SELECT * FROM employees WHERE id = ?1`, [id]);
  return rows[0] || null;
}

export async function getNextEmployeeNumber(): Promise<string> {
  const [r] = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM employees`);
  return `EMP-${String((r?.count || 0) + 1).padStart(4, "0")}`;
}

export async function listLinkableUsers(currentEmployeeId?: string): Promise<LinkableUser[]> {
  return query<LinkableUser>(
    `SELECT u.id, u.username, u.full_name, u.role
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id AND (?1 IS NULL OR e.id != ?1)
     WHERE u.active = 1 AND e.id IS NULL
     ORDER BY u.full_name, u.username`,
    [currentEmployeeId || null],
  );
}

export async function upsertEmployee(input: Partial<Employee> & { full_name: string; job_title: string }): Promise<string> {
  const id = input.id || crypto.randomUUID();
  const empNumber = input.employee_number || (input.id ? input.employee_number : await getNextEmployeeNumber());

  if (input.id) {
    await execute(
      `UPDATE employees SET
        employee_number = ?2, user_id = ?3, full_name = ?4, id_number = ?5,
        kra_pin = ?6, nssf_number = ?7, shif_number = ?8,
        phone = ?9, email = ?10, address = ?11, date_of_birth = ?12, gender = ?13,
        next_of_kin_name = ?14, next_of_kin_phone = ?15, next_of_kin_relationship = ?16,
        photo_path = ?17, department_id = ?18, job_title = ?19, branch_id = ?20,
        employment_type = ?21, hire_date = ?22, termination_date = ?23, termination_reason = ?24,
        active = ?25, pay_type = ?26, base_salary = ?27, daily_rate = ?28,
        hourly_rate = ?29, commission_rate = ?30, bank_name = ?31, bank_account = ?32,
        bank_branch = ?33, paybill_or_phone = ?34, notes = ?35,
        is_pharmacist = ?36, pharmacist_license_number = ?37, pharmacist_license_expiry = ?38,
        updated_at = datetime('now')
      WHERE id = ?1`,
      [
        id, empNumber, input.user_id || null, input.full_name, input.id_number || null,
        input.kra_pin || null, input.nssf_number || null, input.shif_number || null,
        input.phone || null, input.email || null, input.address || null, input.date_of_birth || null, input.gender || null,
        input.next_of_kin_name || null, input.next_of_kin_phone || null, input.next_of_kin_relationship || null,
        input.photo_path || null, input.department_id || null, input.job_title, input.branch_id || null,
        input.employment_type || "permanent", input.hire_date || new Date().toISOString().slice(0, 10),
        input.termination_date || null, input.termination_reason || null,
        input.active ?? 1, input.pay_type || "monthly", input.base_salary || 0,
        input.daily_rate || null, input.hourly_rate || null, input.commission_rate || null,
        input.bank_name || null, input.bank_account || null, input.bank_branch || null,
        input.paybill_or_phone || null, input.notes || null,
        input.is_pharmacist || 0, input.pharmacist_license_number || null, input.pharmacist_license_expiry || null,
      ],
    );
  } else {
    await execute(
      `INSERT INTO employees (
        id, employee_number, user_id, full_name, id_number,
        kra_pin, nssf_number, shif_number,
        phone, email, address, date_of_birth, gender,
        next_of_kin_name, next_of_kin_phone, next_of_kin_relationship,
        photo_path, department_id, job_title, branch_id,
        employment_type, hire_date,
        active, pay_type, base_salary, daily_rate,
        hourly_rate, commission_rate, bank_name, bank_account,
        bank_branch, paybill_or_phone, notes,
        is_pharmacist, pharmacist_license_number, pharmacist_license_expiry
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36)`,
      [
        id, empNumber, input.user_id || null, input.full_name, input.id_number || null,
        input.kra_pin || null, input.nssf_number || null, input.shif_number || null,
        input.phone || null, input.email || null, input.address || null, input.date_of_birth || null, input.gender || null,
        input.next_of_kin_name || null, input.next_of_kin_phone || null, input.next_of_kin_relationship || null,
        input.photo_path || null, input.department_id || null, input.job_title, input.branch_id || null,
        input.employment_type || "permanent", input.hire_date || new Date().toISOString().slice(0, 10),
        input.active ?? 1, input.pay_type || "monthly", input.base_salary || 0,
        input.daily_rate || null, input.hourly_rate || null, input.commission_rate || null,
        input.bank_name || null, input.bank_account || null, input.bank_branch || null,
        input.paybill_or_phone || null, input.notes || null,
        input.is_pharmacist || 0, input.pharmacist_license_number || null, input.pharmacist_license_expiry || null,
      ],
    );
  }
  return id;
}

export async function terminateEmployee(id: string, reason: string, date?: string): Promise<void> {
  await execute(
    `UPDATE employees SET active = 0, termination_date = ?2, termination_reason = ?3, updated_at = datetime('now') WHERE id = ?1`,
    [id, date || new Date().toISOString().slice(0, 10), reason],
  );
}

export async function reactivateEmployee(id: string): Promise<void> {
  await execute(
    `UPDATE employees SET active = 1, termination_date = NULL, termination_reason = NULL, updated_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}
