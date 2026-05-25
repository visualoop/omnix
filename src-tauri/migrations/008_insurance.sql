-- Phase 6C: SHA/SHIF Insurance + Private Insurers

-- Insurance providers (SHA + private insurers like Jubilee, AAR, CIC, Madison, Britam)
CREATE TABLE IF NOT EXISTS insurance_providers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sha', 'private')),
    api_endpoint TEXT,
    api_key TEXT,
    api_secret TEXT,
    facility_code TEXT,         -- Pharmacy's code with this insurer
    contact_phone TEXT,
    contact_email TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    test_mode INTEGER NOT NULL DEFAULT 1,
    requires_preauth INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cache of verified members (avoids re-querying)
CREATE TABLE IF NOT EXISTS insurance_members (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
    member_number TEXT NOT NULL,
    national_id TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    scheme_name TEXT,             -- e.g., "SHIF", "Jubilee Premier", "AAR Gold"
    scheme_type TEXT,             -- e.g., "outpatient", "inpatient", "comprehensive"
    benefit_balance REAL,         -- Remaining benefit (KES)
    copay_percentage REAL DEFAULT 0,  -- Member's share % (0 = fully covered)
    copay_fixed REAL DEFAULT 0,   -- Fixed copay amount per visit
    valid_from TEXT,
    valid_to TEXT,
    last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
    raw_response TEXT,
    UNIQUE(provider_id, member_number)
);

-- Claims (one per sale that uses insurance)
CREATE TABLE IF NOT EXISTS insurance_claims (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id),
    provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
    member_id TEXT REFERENCES insurance_members(id),
    member_number TEXT NOT NULL,
    member_name TEXT NOT NULL,
    -- Diagnosis & prescription
    diagnosis_code TEXT,           -- ICD-10
    diagnosis_text TEXT,
    prescription_id TEXT REFERENCES prescriptions(id),
    prescriber_name TEXT,
    prescriber_license TEXT,
    -- Amounts
    gross_amount REAL NOT NULL,        -- Total bill
    copay_amount REAL NOT NULL DEFAULT 0,  -- Member's share
    claim_amount REAL NOT NULL,        -- Insurer's share
    approved_amount REAL,
    paid_amount REAL DEFAULT 0,
    -- Pre-authorization
    preauth_number TEXT,
    preauth_status TEXT CHECK (preauth_status IN ('not_required','pending','approved','denied','expired')),
    preauth_approved_at TEXT,
    -- Claim submission
    claim_number TEXT,                 -- Insurer's claim ID
    submitted_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','partially_paid','paid','rejected','cancelled')),
    rejection_reason TEXT,
    paid_at TEXT,
    payment_reference TEXT,
    -- Audit
    notes TEXT,
    payload_json TEXT,
    response_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Itemized claim lines (for line-level approval/rejection)
CREATE TABLE IF NOT EXISTS insurance_claim_items (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
    sale_item_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    approved_qty REAL,
    approved_amount REAL,
    rejected_reason TEXT
);

-- Claim batches (insurers want bulk submission)
CREATE TABLE IF NOT EXISTS insurance_batches (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL UNIQUE,
    provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    claim_count INTEGER NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','acknowledged','settled')),
    submitted_at TEXT,
    settled_at TEXT,
    settled_amount REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Link claims to batches
ALTER TABLE insurance_claims ADD COLUMN batch_id TEXT REFERENCES insurance_batches(id);

-- Seed common Kenyan insurers
INSERT OR IGNORE INTO insurance_providers (id, code, name, type, requires_preauth) VALUES
    ('sha-default', 'SHA', 'Social Health Authority (SHIF)', 'sha', 1),
    ('jubilee', 'JUB', 'Jubilee Health Insurance', 'private', 1),
    ('aar', 'AAR', 'AAR Insurance', 'private', 1),
    ('cic', 'CIC', 'CIC Insurance', 'private', 1),
    ('madison', 'MAD', 'Madison Insurance', 'private', 1),
    ('britam', 'BRT', 'Britam Insurance', 'private', 1),
    ('apa', 'APA', 'APA Insurance', 'private', 1),
    ('uap', 'UAP', 'UAP Old Mutual', 'private', 1);

-- Add insurance payment method
INSERT OR IGNORE INTO payment_methods (id, name, type, sort_order) VALUES
    ('insurance', 'Insurance', 'insurance', 5);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claims_sale ON insurance_claims(sale_id);
CREATE INDEX IF NOT EXISTS idx_claims_provider ON insurance_claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_batch ON insurance_claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_created ON insurance_claims(created_at);
CREATE INDEX IF NOT EXISTS idx_members_lookup ON insurance_members(provider_id, member_number);
