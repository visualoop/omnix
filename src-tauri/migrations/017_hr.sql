-- ============================================================================
-- 017_hr.sql
-- Employee management + payroll + attendance + leave
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    manager_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO departments (id, name) VALUES
    ('dept-management', 'Management'),
    ('dept-sales', 'Sales'),
    ('dept-pharmacy', 'Pharmacy'),
    ('dept-inventory', 'Inventory'),
    ('dept-accounting', 'Accounting'),
    ('dept-cleaning', 'Cleaning & Support');

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employee_number TEXT UNIQUE NOT NULL,
    user_id TEXT REFERENCES users(id),       -- NULL if employee doesn't log in
    -- personal
    full_name TEXT NOT NULL,
    id_number TEXT,                           -- Kenyan National ID
    kra_pin TEXT,
    nssf_number TEXT,
    shif_number TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    date_of_birth TEXT,
    gender TEXT CHECK (gender IS NULL OR gender IN ('male','female','other')),
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    photo_path TEXT,
    -- employment
    department_id TEXT REFERENCES departments(id),
    job_title TEXT NOT NULL,
    branch_id TEXT REFERENCES branches(id),
    employment_type TEXT NOT NULL DEFAULT 'permanent'
        CHECK (employment_type IN ('permanent','contract','casual','intern')),
    hire_date TEXT NOT NULL DEFAULT (date('now')),
    termination_date TEXT,
    termination_reason TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    -- compensation
    pay_type TEXT NOT NULL DEFAULT 'monthly'
        CHECK (pay_type IN ('monthly','daily','hourly','piece_rate','commission_only')),
    base_salary REAL NOT NULL DEFAULT 0,
    daily_rate REAL,
    hourly_rate REAL,
    commission_rate REAL,                     -- % of sales for commission-eligible
    -- bank/payroll
    bank_name TEXT,
    bank_account TEXT,
    bank_branch TEXT,
    paybill_or_phone TEXT,                    -- M-Pesa number
    -- bookkeeping
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    work_date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'present'
        CHECK (status IN ('present','absent','sick','leave','holiday','half-day')),
    notes TEXT,
    branch_id TEXT REFERENCES branches(id),
    UNIQUE(employee_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date);

CREATE TABLE IF NOT EXISTS leave_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    days_per_year INTEGER NOT NULL,
    paid INTEGER NOT NULL DEFAULT 1,
    description TEXT
);

INSERT OR IGNORE INTO leave_types (id, name, days_per_year, paid, description) VALUES
    ('lt-annual', 'Annual Leave', 21, 1, 'Statutory annual leave (Employment Act 2007)'),
    ('lt-sick', 'Sick Leave', 14, 1, 'After 2 months of continuous service'),
    ('lt-maternity', 'Maternity Leave', 90, 1, 'Female employees, 3 months'),
    ('lt-paternity', 'Paternity Leave', 14, 1, 'Male employees, 2 weeks'),
    ('lt-compassionate', 'Compassionate Leave', 5, 1, 'Death of immediate family'),
    ('lt-unpaid', 'Unpaid Leave', 0, 0, 'No statutory limit');

CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','cancelled')),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT,
    rejection_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','approved','paid','cancelled')),
    gross_total REAL NOT NULL DEFAULT 0,
    deductions_total REAL NOT NULL DEFAULT 0,
    net_total REAL NOT NULL DEFAULT 0,
    employee_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    paid_at TEXT,
    branch_id TEXT REFERENCES branches(id),    -- NULL = all branches
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(period_year, period_month, branch_id)
);

CREATE TABLE IF NOT EXISTS payslips (
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
    -- statutory deductions
    paye REAL NOT NULL DEFAULT 0,
    nssf_employee REAL NOT NULL DEFAULT 0,
    shif REAL NOT NULL DEFAULT 0,
    housing_levy_employee REAL NOT NULL DEFAULT 0,
    -- other deductions
    advances REAL NOT NULL DEFAULT 0,
    loans REAL NOT NULL DEFAULT 0,
    other_deductions REAL NOT NULL DEFAULT 0,
    deductions_total REAL NOT NULL DEFAULT 0,
    -- employer-side (for compliance reporting)
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
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_advances (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    amount REAL NOT NULL CHECK (amount > 0),
    reason TEXT,
    advance_date TEXT NOT NULL DEFAULT (date('now')),
    repaid_amount REAL NOT NULL DEFAULT 0,
    fully_repaid INTEGER NOT NULL DEFAULT 0,
    monthly_deduction REAL NOT NULL DEFAULT 0,
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sales: who sold this? (for commissions)
ALTER TABLE sales ADD COLUMN salesperson_id TEXT REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS idx_sales_salesperson ON sales(salesperson_id);
