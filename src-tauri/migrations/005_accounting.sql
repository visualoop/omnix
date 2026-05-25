-- SokoOS Accounting Schema

-- Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES expense_categories(id),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES expense_categories(id),
    category_name TEXT,
    amount REAL NOT NULL,
    description TEXT,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference TEXT,
    receipt_image TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_period TEXT,
    expense_date TEXT NOT NULL DEFAULT (date('now')),
    recorded_by TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cash register / shift management
CREATE TABLE IF NOT EXISTS cash_register (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    expected_closing REAL,
    actual_closing REAL,
    difference REAL,
    cash_in REAL NOT NULL DEFAULT 0,
    cash_out REAL NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

-- Other income (besides sales)
CREATE TABLE IF NOT EXISTS other_income (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    income_date TEXT NOT NULL DEFAULT (date('now')),
    recorded_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default expense categories
INSERT OR IGNORE INTO expense_categories (id, name, sort_order) VALUES
    ('rent', 'Rent', 1),
    ('utilities', 'Utilities (Electricity, Water)', 2),
    ('salaries', 'Salaries & Wages', 3),
    ('supplies', 'Office Supplies', 4),
    ('transport', 'Transport', 5),
    ('marketing', 'Marketing & Advertising', 6),
    ('maintenance', 'Maintenance & Repairs', 7),
    ('licenses', 'Licenses & Permits', 8),
    ('insurance', 'Insurance', 9),
    ('communication', 'Phone & Internet', 10),
    ('professional', 'Professional Fees', 11),
    ('other', 'Other Expenses', 99);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_user ON cash_register(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_status ON cash_register(status);
