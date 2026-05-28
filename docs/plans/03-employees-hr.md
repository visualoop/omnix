# 03 — Employees & HR Plan

**Goal:** Full employee management for a Kenyan SME — staff records, contracts, attendance, leave, payroll with statutory deductions, commissions.

This is **separate from the user/login system**. A user is "someone who can log in to SokoOS"; an employee is "someone we pay". Often the same person but not always (e.g. a delivery driver is an employee but never logs in).

## Why we need this

User specifically called out: "complete plan of users management and everything... I did not see employment management etc, employees roles etc."

Right now we have RBAC for system access. We don't have:
- Salary records
- Contract tracking
- Attendance / clock in-out
- Leave management
- Statutory deduction calculation (NSSF, SHIF, PAYE)
- Payslip generation
- Commission tracking
- Termination / final pay

## Kenya regulatory context (2026)

Researched online — current rates as of February 2026:

### NSSF (National Social Security Fund)
- Year 4 phase active
- **Upper Earnings Limit:** KES 108,000/month
- **Employee:** 6% of pensionable pay, capped → max KES 6,480
- **Employer:** matches 6% → max KES 6,480
- **Combined:** up to KES 12,960/month per employee

### SHIF (Social Health Insurance Fund) — replaced NHIF
- 2.75% of gross monthly salary
- Minimum KES 300/month
- 100% employee-paid, employer just deducts and remits

### PAYE (income tax, banded)
- Up to 24,000/month: 10%
- 24,001–32,333: 25%
- 32,334–500,000: 30%
- 500,001–800,000: 32.5%
- Above 800,000: 35%
- Personal relief KES 2,400/month
- Insurance relief, mortgage relief etc available

### Housing Levy
- 1.5% of gross salary, employee
- 1.5% matched by employer
- Combined 3% goes to KRA

### NITA (industrial training levy)
- KES 50 per employee per month, employer-paid

## Schema (migration 016_hr.sql)

```sql
-- Employees table (separate from users)
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    employee_number TEXT UNIQUE NOT NULL,    -- e.g. EMP-001
    user_id TEXT REFERENCES users(id),       -- NULL if employee doesn't log in
    full_name TEXT NOT NULL,
    id_number TEXT,                           -- Kenyan National ID
    kra_pin TEXT,                             -- KRA tax PIN
    nssf_number TEXT,
    shif_number TEXT,                         -- formerly NHIF number
    phone TEXT,
    email TEXT,
    address TEXT,
    date_of_birth TEXT,
    gender TEXT,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    photo_path TEXT,                          -- attached image
    -- employment
    department_id TEXT REFERENCES departments(id),
    job_title TEXT NOT NULL,
    branch_id TEXT REFERENCES branches(id),
    employment_type TEXT NOT NULL CHECK (employment_type IN ('permanent','contract','casual','intern')),
    hire_date TEXT NOT NULL,
    termination_date TEXT,
    termination_reason TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    -- compensation
    pay_type TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_type IN ('monthly','daily','hourly','piece_rate','commission_only')),
    base_salary REAL NOT NULL DEFAULT 0,      -- gross monthly
    daily_rate REAL,
    hourly_rate REAL,
    commission_rate REAL,                     -- % of sales for commission-eligible roles
    bank_name TEXT,
    bank_account TEXT,
    bank_branch TEXT,
    paybill_or_phone TEXT,                    -- if paid via M-Pesa
    -- bookkeeping
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Attendance / clock in-out
CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    work_date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','sick','leave','holiday','half-day')),
    notes TEXT,
    UNIQUE(employee_id, work_date)
);

-- Leave types and requests
CREATE TABLE leave_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    days_per_year INTEGER NOT NULL,
    paid INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payroll runs
CREATE TABLE payroll_runs (
    id TEXT PRIMARY KEY,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
    gross_total REAL NOT NULL DEFAULT 0,
    deductions_total REAL NOT NULL DEFAULT 0,
    net_total REAL NOT NULL DEFAULT 0,
    employee_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(period_year, period_month)
);

CREATE TABLE payslips (
    id TEXT PRIMARY KEY,
    payroll_run_id TEXT NOT NULL REFERENCES payroll_runs(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    -- earnings
    base_salary REAL NOT NULL DEFAULT 0,
    overtime REAL NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    bonus REAL NOT NULL DEFAULT 0,
    allowances REAL NOT NULL DEFAULT 0,
    other_earnings REAL NOT NULL DEFAULT 0,
    gross_pay REAL NOT NULL DEFAULT 0,
    -- deductions
    paye REAL NOT NULL DEFAULT 0,
    nssf_employee REAL NOT NULL DEFAULT 0,
    shif REAL NOT NULL DEFAULT 0,
    housing_levy_employee REAL NOT NULL DEFAULT 0,
    advances REAL NOT NULL DEFAULT 0,
    loans REAL NOT NULL DEFAULT 0,
    other_deductions REAL NOT NULL DEFAULT 0,
    deductions_total REAL NOT NULL DEFAULT 0,
    -- employer-side (not deducted from employee but tracked for compliance)
    nssf_employer REAL NOT NULL DEFAULT 0,
    housing_levy_employer REAL NOT NULL DEFAULT 0,
    nita_levy REAL NOT NULL DEFAULT 0,
    -- result
    net_pay REAL NOT NULL DEFAULT 0,
    days_worked REAL,
    days_in_month INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(payroll_run_id, employee_id)
);

-- Salary advances / loans
CREATE TABLE employee_advances (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    amount REAL NOT NULL,
    reason TEXT,
    advance_date TEXT NOT NULL DEFAULT (date('now')),
    -- repayment tracking
    repaid_amount REAL NOT NULL DEFAULT 0,
    fully_repaid INTEGER NOT NULL DEFAULT 0,
    monthly_deduction REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Commission tracking (link sale → employee)
ALTER TABLE sales ADD COLUMN salesperson_id TEXT REFERENCES employees(id);
```

## Pages

1. **`/hr/employees`** — list + filters (department, branch, active)
2. **`/hr/employees/:id`** — single employee detail with tabs:
   - Profile (basic info)
   - Compensation (salary, bank)
   - Attendance (calendar view)
   - Leave (history + balance)
   - Documents (contract scan, ID copy)
   - Payslips (history)
3. **`/hr/attendance`** — daily attendance grid (rows=employees, cols=days)
4. **`/hr/leave`** — pending requests + approval queue
5. **`/hr/payroll`** — list of payroll runs
6. **`/hr/payroll/new`** — create + approve a payroll run
7. **`/hr/payroll/:id`** — review payslips before approval
8. **`/hr/reports`** — payroll register, KRA P9, NSSF return, SHIF return

## Services

1. `services/employees.ts` — CRUD
2. `services/attendance.ts` — clock in/out, daily report
3. `services/leave.ts` — requests, balances, approvals
4. `services/payroll.ts` — Kenya tax calc (PAYE bands, NSSF cap, SHIF, Housing Levy), run creation, payslip generation, payslip print HTML
5. `services/commissions.ts` — calculate commission per salesperson per period

## Permissions (extends `lib/permissions.ts`)

New permissions:
- `hr.employees.view`
- `hr.employees.manage`
- `hr.attendance.view`
- `hr.attendance.record`
- `hr.leave.request` (employees can request own leave if they have user account)
- `hr.leave.approve` (manager+)
- `hr.payroll.view`
- `hr.payroll.run` (owner only)
- `hr.payroll.approve` (owner only)

## Reports / printables

1. **Payslip** — A5 PDF with logo, employee details, earnings, deductions, net, signature lines
2. **P9 form** — KRA annual return for an employee
3. **NSSF monthly return** — formatted for upload to NSSF iPortal
4. **SHIF monthly return** — formatted for SHIF/SHA portal
5. **Bank payment file** — CSV in bank-specific format for batch payroll payment

## Build order

1. **Migration 016** + employees CRUD + employee list page (1 batch)
2. **Compensation tab** + bank details + departments (1 batch)
3. **Attendance** clock-in/out + grid view (1 batch)
4. **Leave** types + requests + approval (1 batch)
5. **Payroll engine** — Kenya tax calculation, payslip generation (1 batch — biggest one)
6. **Payroll UI** — create/approve/pay flow (1 batch)
7. **Reports** — payslip PDF + P9 + NSSF/SHIF returns (1 batch)
8. **Commissions** — link to sales, monthly summary (1 batch)
9. **Termination flow** + final pay calculation (1 batch)

## Out of scope (v1)

- Loans (multi-month repayment with interest) — defer
- Performance reviews
- Shift scheduling (vs simple attendance)
- Document expiry alerts (work permit, contract renewal)
- Payroll approval workflow with multiple approvers

## Edge cases to handle

- Mid-month hire (prorate salary)
- Mid-month termination (final pay = pro-rata + leave days due)
- Negative net pay (deductions > earnings) — should warn, not allow
- Salary advance repayment plan crossing payroll periods
- Tax bracket changes mid-year (recalculation)
- New employee in their first month (no full month attendance)
