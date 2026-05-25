-- Phase 6: Payments configuration & transaction tracking

-- Payment provider config (Paystack, future others)
CREATE TABLE IF NOT EXISTS payment_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT,
    secret_key TEXT,
    config_json TEXT,
    active INTEGER NOT NULL DEFAULT 0,
    test_mode INTEGER NOT NULL DEFAULT 1,
    connected_at TEXT
);

-- Payment transactions (Paystack STK push tracking)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id),
    provider TEXT NOT NULL,
    provider_ref TEXT,
    paystack_reference TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'pending',
    customer_phone TEXT,
    initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    error_message TEXT,
    metadata TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_tx_sale ON payment_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_ref ON payment_transactions(paystack_reference);
