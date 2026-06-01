-- ============================================================================
-- 031_hardware.sql — Hardware & Building Materials module (plan 10)
-- Quotations + delivery notes (generic, Core-leaning), contractor accounts with
-- credit/aging, and salesperson commissions. Extends Core via FKs only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    customer_id TEXT REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','sent','accepted','converted','expired','cancelled')),
    valid_until TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    converted_sale_id TEXT REFERENCES sales(id),
    salesperson_id TEXT REFERENCES employees(id),
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    uom TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_notes (
    id TEXT PRIMARY KEY,
    note_number TEXT UNIQUE NOT NULL,
    branch_id TEXT,
    customer_id TEXT REFERENCES customers(id),
    sale_id TEXT REFERENCES sales(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','dispatched','delivered','cancelled')),
    delivery_address TEXT,
    vehicle TEXT,
    driver TEXT,
    dispatched_at TEXT,
    delivered_at TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
    id TEXT PRIMARY KEY,
    delivery_note_id TEXT NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    name TEXT NOT NULL,
    uom TEXT,
    quantity REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_accounts (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id),
    credit_limit REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    terms_days INTEGER NOT NULL DEFAULT 30,
    on_hold INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('charge','payment','adjustment')),
    sale_id TEXT REFERENCES sales(id),
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    due_date TEXT,
    reference TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_rules (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    category_id TEXT,
    percent REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS commission_accruals (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    sale_id TEXT REFERENCES sales(id),
    base_amount REAL NOT NULL,
    percent REAL NOT NULL,
    amount REAL NOT NULL,
    payroll_period TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_account_ledger_customer ON account_ledger(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_accruals_emp ON commission_accruals(employee_id);
