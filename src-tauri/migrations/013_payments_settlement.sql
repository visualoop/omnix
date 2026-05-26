-- ============================================================================
-- 013_payments_settlement.sql
-- Customer credit payments + supplier settlement payments
-- ============================================================================

-- Customer payments: when a customer pays down their balance owed
CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount REAL NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('cash', 'mpesa', 'card', 'bank', 'other')),
    reference TEXT,                          -- M-Pesa code, cheque number, etc.
    note TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(paid_at DESC);

-- Supplier payments: when we pay down what we owe a supplier
CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    amount REAL NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('cash', 'mpesa', 'card', 'bank', 'other')),
    reference TEXT,
    note TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(paid_at DESC);
