/**
 * Kenya Payroll Engine
 *
 * Computes statutory deductions per Kenyan law as of 2026:
 *  - PAYE (banded income tax with KES 2,400 personal relief)
 *  - NSSF Year 4 (6% capped at KES 6,480/month, employer matches)
 *  - SHIF (2.75% of gross, replaces NHIF, min 300/month, employee-only)
 *  - Housing Levy (1.5% employee + 1.5% employer)
 *  - NITA (KES 50/employee/month, employer-only)
 *
 * RATES THAT MAY CHANGE — keep this file as the single source of truth.
 * Update the constants below when KRA / NSSF announce new rates.
 */
import { query, execute } from "@/lib/db";

// ─── Constants (as of February 2026) ────────────────────────────────
export const PAYROLL_RATES_2026 = {
  paye: {
    personal_relief: 2400,           // KES/month
    insurance_relief_pct: 0.15,      // 15% of premiums (capped 5,000/mo)
    insurance_relief_cap: 5000,
    bands: [
      { up_to: 24000, rate: 0.10 },
      { up_to: 32333, rate: 0.25 },
      { up_to: 500000, rate: 0.30 },
      { up_to: 800000, rate: 0.325 },
      { up_to: Infinity, rate: 0.35 },
    ],
  },
  nssf: {
    employee_pct: 0.06,
    employer_pct: 0.06,
    upper_earnings_limit: 108000,
    max_employee: 6480,
    max_employer: 6480,
    max_combined: 12960,
  },
  shif: {
    rate: 0.0275,
    minimum: 300,                    // KES/month
  },
  housing_levy: {
    employee_pct: 0.015,
    employer_pct: 0.015,
  },
  nita: {
    per_employee_per_month: 50,      // KES, employer-paid
  },
};

export interface PayrollInput {
  base_salary: number;
  overtime?: number;
  commission?: number;
  bonus?: number;
  allowances?: number;
  other_earnings?: number;
  advances?: number;
  loans?: number;
  other_deductions?: number;
  insurance_premiums_paid?: number; // for relief calculation
}

export interface PayrollOutput {
  // Earnings
  base_salary: number;
  overtime: number;
  commission: number;
  bonus: number;
  allowances: number;
  other_earnings: number;
  gross_pay: number;
  // Pre-tax deductions (NSSF reduces taxable income)
  nssf_employee: number;
  taxable_income: number;
  // Tax
  paye_before_relief: number;
  personal_relief: number;
  insurance_relief: number;
  paye: number;
  // Other statutory
  shif: number;
  housing_levy_employee: number;
  // Other
  advances: number;
  loans: number;
  other_deductions: number;
  // Totals
  deductions_total: number;
  net_pay: number;
  // Employer-side (cost-of-employment)
  nssf_employer: number;
  housing_levy_employer: number;
  nita_levy: number;
  total_employer_cost: number;
}

/**
 * Calculate PAYE on taxable income using progressive bands.
 */
function calculatePayeBeforeRelief(taxable: number): number {
  let tax = 0;
  let remaining = taxable;
  let lastUpTo = 0;
  for (const band of PAYROLL_RATES_2026.paye.bands) {
    const inBand = Math.min(remaining, band.up_to - lastUpTo);
    if (inBand <= 0) break;
    tax += inBand * band.rate;
    remaining -= inBand;
    lastUpTo = band.up_to;
    if (remaining <= 0) break;
  }
  return tax;
}

/**
 * The main payroll calculation.
 */
export function calculatePayroll(input: PayrollInput): PayrollOutput {
  const r = PAYROLL_RATES_2026;

  // Earnings
  const base = input.base_salary || 0;
  const overtime = input.overtime || 0;
  const commission = input.commission || 0;
  const bonus = input.bonus || 0;
  const allowances = input.allowances || 0;
  const other_earnings = input.other_earnings || 0;
  const gross = base + overtime + commission + bonus + allowances + other_earnings;

  // NSSF (employee, capped, deducted pre-tax)
  const nssfPensionable = Math.min(gross, r.nssf.upper_earnings_limit);
  const nssfEmployee = Math.min(nssfPensionable * r.nssf.employee_pct, r.nssf.max_employee);
  const nssfEmployer = Math.min(nssfPensionable * r.nssf.employer_pct, r.nssf.max_employer);

  // Taxable income = gross - NSSF (NSSF is pre-tax in Kenya)
  const taxable = Math.max(0, gross - nssfEmployee);

  // PAYE
  const payeBeforeRelief = calculatePayeBeforeRelief(taxable);
  const personalRelief = r.paye.personal_relief;
  const insuranceRelief = Math.min(
    (input.insurance_premiums_paid || 0) * r.paye.insurance_relief_pct,
    r.paye.insurance_relief_cap,
  );
  const paye = Math.max(0, payeBeforeRelief - personalRelief - insuranceRelief);

  // SHIF (2.75% of gross, minimum 300, employee-only)
  const shif = Math.max(gross * r.shif.rate, r.shif.minimum);

  // Housing Levy
  const housingEmployee = gross * r.housing_levy.employee_pct;
  const housingEmployer = gross * r.housing_levy.employer_pct;

  // NITA — flat KES 50 per month per employee (employer-only)
  const nitaLevy = r.nita.per_employee_per_month;

  // Other deductions
  const advances = input.advances || 0;
  const loans = input.loans || 0;
  const otherDeductions = input.other_deductions || 0;

  // Totals
  const deductionsTotal = nssfEmployee + paye + shif + housingEmployee + advances + loans + otherDeductions;
  const netPay = gross - deductionsTotal;

  const totalEmployerCost = gross + nssfEmployer + housingEmployer + nitaLevy;

  // Round all values to 2 decimal places for consistency
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    base_salary: round(base),
    overtime: round(overtime),
    commission: round(commission),
    bonus: round(bonus),
    allowances: round(allowances),
    other_earnings: round(other_earnings),
    gross_pay: round(gross),
    nssf_employee: round(nssfEmployee),
    taxable_income: round(taxable),
    paye_before_relief: round(payeBeforeRelief),
    personal_relief: round(personalRelief),
    insurance_relief: round(insuranceRelief),
    paye: round(paye),
    shif: round(shif),
    housing_levy_employee: round(housingEmployee),
    advances: round(advances),
    loans: round(loans),
    other_deductions: round(otherDeductions),
    deductions_total: round(deductionsTotal),
    net_pay: round(netPay),
    nssf_employer: round(nssfEmployer),
    housing_levy_employer: round(housingEmployer),
    nita_levy: round(nitaLevy),
    total_employer_cost: round(totalEmployerCost),
  };
}

// ─── Payroll runs ──────────────────────────────────────────────────────
export interface PayrollRun {
  id: string;
  period_year: number;
  period_month: number;
  status: "draft" | "approved" | "paid" | "cancelled";
  gross_total: number;
  deductions_total: number;
  net_total: number;
  employee_count: number;
  notes: string | null;
  created_by: string;
  approved_by: string | null;
  paid_at: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number;
  overtime: number;
  commission: number;
  bonus: number;
  allowances: number;
  other_earnings: number;
  gross_pay: number;
  paye: number;
  nssf_employee: number;
  shif: number;
  housing_levy_employee: number;
  advances: number;
  loans: number;
  other_deductions: number;
  deductions_total: number;
  nssf_employer: number;
  housing_levy_employer: number;
  nita_levy: number;
  net_pay: number;
  days_worked: number | null;
  days_in_month: number | null;
  notes: string | null;
  created_at: string;
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  return query<PayrollRun>(
    `SELECT * FROM payroll_runs ORDER BY period_year DESC, period_month DESC LIMIT 200`,
  );
}

export async function getPayrollRun(id: string): Promise<{
  run: PayrollRun;
  payslips: Array<Payslip & { employee_name: string; employee_number: string }>;
} | null> {
  const [run] = await query<PayrollRun>(`SELECT * FROM payroll_runs WHERE id = ?1`, [id]);
  if (!run) return null;
  const payslips = await query<Payslip & { employee_name: string; employee_number: string }>(
    `SELECT p.*, e.full_name AS employee_name, e.employee_number
     FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     WHERE p.payroll_run_id = ?1
     ORDER BY e.full_name`,
    [id],
  );
  return { run, payslips };
}

/** Generate a payroll run for a given month + branch (or all branches if branchId omitted). */
export async function createPayrollRun(input: {
  year: number;
  month: number;
  branch_id?: string;
  user_id: string;
}): Promise<string> {
  const runId = crypto.randomUUID();

  // Find eligible employees
  const employees = await query<{
    id: string;
    base_salary: number;
    pay_type: string;
  }>(
    `SELECT id, base_salary, pay_type FROM employees
     WHERE active = 1 AND base_salary > 0
       ${input.branch_id ? "AND branch_id = ?1" : ""}`,
    input.branch_id ? [input.branch_id] : [],
  );

  if (employees.length === 0) {
    throw new Error("No eligible employees found");
  }

  await execute(
    `INSERT INTO payroll_runs (id, period_year, period_month, status, created_by, branch_id)
     VALUES (?1, ?2, ?3, 'draft', ?4, ?5)`,
    [runId, input.year, input.month, input.user_id, input.branch_id || null],
  );

  let grossTotal = 0;
  let deductionsTotal = 0;
  let netTotal = 0;

  for (const emp of employees) {
    const calc = calculatePayroll({ base_salary: emp.base_salary });
    const payslipId = crypto.randomUUID();
    await execute(
      `INSERT INTO payslips (
        id, payroll_run_id, employee_id,
        base_salary, overtime, commission, bonus, allowances, other_earnings, gross_pay,
        paye, nssf_employee, shif, housing_levy_employee,
        advances, loans, other_deductions, deductions_total,
        nssf_employer, housing_levy_employer, nita_levy,
        net_pay
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`,
      [
        payslipId, runId, emp.id,
        calc.base_salary, calc.overtime, calc.commission, calc.bonus, calc.allowances, calc.other_earnings, calc.gross_pay,
        calc.paye, calc.nssf_employee, calc.shif, calc.housing_levy_employee,
        calc.advances, calc.loans, calc.other_deductions, calc.deductions_total,
        calc.nssf_employer, calc.housing_levy_employer, calc.nita_levy,
        calc.net_pay,
      ],
    );
    grossTotal += calc.gross_pay;
    deductionsTotal += calc.deductions_total;
    netTotal += calc.net_pay;
  }

  await execute(
    `UPDATE payroll_runs SET gross_total = ?1, deductions_total = ?2, net_total = ?3, employee_count = ?4 WHERE id = ?5`,
    [grossTotal, deductionsTotal, netTotal, employees.length, runId],
  );

  return runId;
}

export async function approvePayrollRun(id: string, userId: string): Promise<void> {
  const { requirePermission } = await import("@/services/rbac");
  await requirePermission("hr.payroll.approve", { entityType: "payroll_run", entityId: id });
  await execute(
    `UPDATE payroll_runs SET status = 'approved', approved_by = ?2 WHERE id = ?1 AND status = 'draft'`,
    [id, userId],
  );
}

export async function markPayrollRunPaid(id: string): Promise<void> {
  await execute(
    `UPDATE payroll_runs SET status = 'paid', paid_at = datetime('now') WHERE id = ?1 AND status = 'approved'`,
    [id],
  );
}

export async function deletePayrollRun(id: string): Promise<void> {
  await execute(`DELETE FROM payslips WHERE payroll_run_id = ?1`, [id]);
  await execute(`DELETE FROM payroll_runs WHERE id = ?1`, [id]);
}
