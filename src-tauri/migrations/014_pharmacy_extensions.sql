-- ============================================================================
-- 014_pharmacy_extensions.sql
-- Loyalty points + doctor/prescriber database + bulk operations log
-- ============================================================================

-- Customer loyalty points balance + transaction log
ALTER TABLE customers ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN loyalty_tier TEXT NOT NULL DEFAULT 'standard'; -- 'standard' | 'silver' | 'gold' | 'platinum'

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    sale_id TEXT REFERENCES sales(id),
    points INTEGER NOT NULL,                -- positive = earned, negative = redeemed
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,                   -- 'sale', 'redemption', 'manual_adjustment', 'expiry'
    note TEXT,
    user_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_transactions(customer_id, created_at DESC);

-- Loyalty program settings (single row)
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 1,
    earn_rate REAL NOT NULL DEFAULT 1,         -- points per KES spent (e.g. 1 = 1pt per KES, 0.1 = 1pt per 10 KES)
    redeem_rate REAL NOT NULL DEFAULT 1,       -- KES value per point (e.g. 1 = 1 KES per point)
    min_redeem_points INTEGER NOT NULL DEFAULT 100,
    expiry_days INTEGER NOT NULL DEFAULT 365,  -- 0 = no expiry
    silver_threshold INTEGER NOT NULL DEFAULT 1000,
    gold_threshold INTEGER NOT NULL DEFAULT 5000,
    platinum_threshold INTEGER NOT NULL DEFAULT 20000
);
INSERT OR IGNORE INTO loyalty_settings (id) VALUES (1);

-- ─── Doctors / Prescribers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    license_number TEXT UNIQUE,             -- KMPDC license number
    specialty TEXT,                          -- 'GP', 'pediatrics', 'cardiology', etc.
    hospital TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(active);
CREATE INDEX IF NOT EXISTS idx_doctors_name ON doctors(full_name);

-- Link prescriptions to doctor records (was free-text only)
ALTER TABLE prescriptions ADD COLUMN doctor_id TEXT REFERENCES doctors(id);

-- ─── Substitution / Generic suggestions ──────────────────────────────────
-- Tracks therapeutic equivalents so the POS can suggest a generic when a
-- branded drug is out of stock or selected.
CREATE TABLE IF NOT EXISTS drug_substitutions (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    substitute_product_id TEXT NOT NULL REFERENCES products(id),
    strength_match INTEGER NOT NULL DEFAULT 1,        -- 1 = same strength, 0 = approximate
    therapeutic_match INTEGER NOT NULL DEFAULT 1,     -- 1 = therapeutically equivalent
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, substitute_product_id)
);
CREATE INDEX IF NOT EXISTS idx_substitutions_product ON drug_substitutions(product_id);

-- ─── Refills tracking ────────────────────────────────────────────────────
-- Identifies refillable prescriptions and tracks how many refills remain.
ALTER TABLE prescriptions ADD COLUMN refills_authorized INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN refills_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN parent_prescription_id TEXT REFERENCES prescriptions(id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_parent ON prescriptions(parent_prescription_id);

-- ─── Promotions / time-limited offers ───────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percent_off', 'amount_off', 'buy_x_get_y')),
    value REAL NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('cart', 'product', 'category')),
    target_id TEXT,                          -- product_id or category_id, NULL for cart-wide
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    min_purchase REAL DEFAULT 0,
    max_uses INTEGER DEFAULT NULL,           -- NULL = unlimited
    uses_count INTEGER NOT NULL DEFAULT 0,
    code TEXT,                               -- optional promo code, NULL for automatic
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;

-- ─── Petty cash (separate from main register) ───────────────────────────
CREATE TABLE IF NOT EXISTS petty_cash (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,                    -- positive = top-up, negative = expense
    type TEXT NOT NULL CHECK (type IN ('topup', 'expense', 'reimbursement', 'count_adjustment')),
    description TEXT NOT NULL,
    receipt_ref TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    transaction_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash(transaction_date DESC);
