/**
 * Statutory return exports — CSVs ready for upload to KRA iTax (PAYE), NSSF portal, and SHIF portal.
 *
 * Each function returns a CSV string. Caller saves to disk via Tauri or browser download.
 */
import { query } from "@/lib/db";

const csvEscape = (v: any): string => {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const csvRow = (cells: any[]): string => cells.map(csvEscape).join(",");

interface PayrollExportRow {
  full_name: string;
  id_number: string | null;
  kra_pin: string | null;
  nssf_number: string | null;
  shif_number: string | null;
  base_salary: number;
  gross_pay: number;
  paye: number;
  nssf_employee: number;
  nssf_employer: number;
  shif: number;
  housing_levy_employee: number;
  housing_levy_employer: number;
  net_pay: number;
}

async function getPayrollRows(runId: string): Promise<PayrollExportRow[]> {
  return query<PayrollExportRow>(
    `SELECT
       e.full_name, e.id_number, e.kra_pin, e.nssf_number, e.shif_number,
       p.base_salary, p.gross_pay, p.paye,
       p.nssf_employee, p.nssf_employer,
       p.shif,
       p.housing_levy_employee, p.housing_levy_employer,
       p.net_pay
     FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     WHERE p.payroll_run_id = ?1
     ORDER BY e.full_name`,
    [runId],
  );
}

/**
 * KRA P10 / iTax PAYE return.
 * Headers per KRA's PAYE_iTax_Excel_Template (simplified column set).
 */
export async function exportPayeP10Csv(runId: string): Promise<string> {
  const rows = await getPayrollRows(runId);
  const header = csvRow([
    "PIN of Employee",
    "Name of Employee",
    "Residential Status",
    "Type of Employee",
    "Basic Salary (Ksh)",
    "Allowances (Ksh)",
    "Gross Pay (Ksh)",
    "Defined Contribution Retirement Scheme (Ksh)",
    "Owner Occupier Interest (Ksh)",
    "Total Tax (Ksh)",
    "Personal Relief (Ksh)",
    "Insurance Relief (Ksh)",
    "PAYE Tax (Ksh)",
  ]);
  const lines = rows.map((r) =>
    csvRow([
      r.kra_pin || "",
      r.full_name,
      "Resident",
      "Primary",
      r.base_salary.toFixed(2),
      "0.00",
      r.gross_pay.toFixed(2),
      r.nssf_employee.toFixed(2),
      "0.00",
      (r.paye + 2400).toFixed(2),
      "2400.00",
      "0.00",
      r.paye.toFixed(2),
    ]),
  );
  return [header, ...lines].join("\n");
}

/**
 * NSSF Year 4 monthly return CSV.
 */
export async function exportNssfReturnCsv(runId: string): Promise<string> {
  const rows = await getPayrollRows(runId);
  const header = csvRow([
    "Member Number",
    "ID Number",
    "Member Name",
    "Member Voluntary Contribution",
    "Employer Voluntary Contribution",
    "Mandatory Member Contribution",
    "Mandatory Employer Contribution",
    "Total Contribution",
  ]);
  const lines = rows.map((r) =>
    csvRow([
      r.nssf_number || "",
      r.id_number || "",
      r.full_name,
      "0.00",
      "0.00",
      r.nssf_employee.toFixed(2),
      r.nssf_employer.toFixed(2),
      (r.nssf_employee + r.nssf_employer).toFixed(2),
    ]),
  );
  return [header, ...lines].join("\n");
}

/**
 * SHIF (formerly NHIF) monthly contribution return.
 */
export async function exportShifReturnCsv(runId: string): Promise<string> {
  const rows = await getPayrollRows(runId);
  const header = csvRow([
    "SHIF Number",
    "ID Number",
    "Member Name",
    "Gross Pay",
    "Contribution",
  ]);
  const lines = rows.map((r) =>
    csvRow([
      r.shif_number || "",
      r.id_number || "",
      r.full_name,
      r.gross_pay.toFixed(2),
      r.shif.toFixed(2),
    ]),
  );
  return [header, ...lines].join("\n");
}

/**
 * Affordable Housing Levy (AHL) monthly return.
 */
export async function exportHousingLevyReturnCsv(runId: string): Promise<string> {
  const rows = await getPayrollRows(runId);
  const header = csvRow([
    "KRA PIN",
    "ID Number",
    "Employee Name",
    "Gross Pay",
    "Employee Contribution (1.5%)",
    "Employer Contribution (1.5%)",
    "Total",
  ]);
  const lines = rows.map((r) =>
    csvRow([
      r.kra_pin || "",
      r.id_number || "",
      r.full_name,
      r.gross_pay.toFixed(2),
      r.housing_levy_employee.toFixed(2),
      r.housing_levy_employer.toFixed(2),
      (r.housing_levy_employee + r.housing_levy_employer).toFixed(2),
    ]),
  );
  return [header, ...lines].join("\n");
}

/**
 * Bank file CSV — for batch payroll payment upload to KCB / Equity / Co-op online banking.
 * Generic format that most Kenyan banks accept.
 */
export async function exportBankFileCsv(runId: string): Promise<string> {
  const rows = await query<{
    full_name: string;
    bank_account: string | null;
    bank_name: string | null;
    paybill_or_phone: string | null;
    net_pay: number;
  }>(
    `SELECT e.full_name, e.bank_account, e.bank_name, e.paybill_or_phone, p.net_pay
     FROM payslips p
     JOIN employees e ON e.id = p.employee_id
     WHERE p.payroll_run_id = ?1
     ORDER BY e.full_name`,
    [runId],
  );
  const header = csvRow([
    "Beneficiary Name",
    "Bank Name",
    "Account Number",
    "Mobile Number (M-Pesa)",
    "Amount",
    "Reference",
  ]);
  const lines = rows.map((r) =>
    csvRow([
      r.full_name,
      r.bank_name || "",
      r.bank_account || "",
      r.paybill_or_phone || "",
      r.net_pay.toFixed(2),
      "Salary",
    ]),
  );
  return [header, ...lines].join("\n");
}

/** Helper to trigger browser download. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
