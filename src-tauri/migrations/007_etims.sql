-- Phase 6B: KRA eTIMS (Electronic Tax Invoice Management System)

-- eTIMS configuration (one row, single business)
CREATE TABLE IF NOT EXISTS etims_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    kra_pin TEXT,
    vscu_serial TEXT,
    api_endpoint TEXT DEFAULT 'https://etims-api.kra.go.ke',
    branch_id TEXT DEFAULT '00',
    business_name TEXT,
    active INTEGER NOT NULL DEFAULT 0,
    test_mode INTEGER NOT NULL DEFAULT 1,
    last_sync_at TEXT,
    notes TEXT
);

-- Signed invoices (every sale gets an entry)
CREATE TABLE IF NOT EXISTS etims_invoices (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id),
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_type TEXT NOT NULL DEFAULT 'normal' CHECK (invoice_type IN ('normal', 'credit_note', 'debit_note')),
    -- KRA-required fields
    seller_pin TEXT NOT NULL,
    buyer_pin TEXT,
    buyer_name TEXT,
    -- Amounts
    subtotal REAL NOT NULL,
    tax_amount REAL NOT NULL,
    total REAL NOT NULL,
    -- KRA response
    kra_internal_control_no TEXT,
    kra_signature TEXT,
    kra_qr_code TEXT,
    kra_invoice_no TEXT,
    submitted_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','failed','queued')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    -- Stored payload for re-submission
    payload_json TEXT,
    response_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tax categories (HS codes for KRA)
CREATE TABLE IF NOT EXISTS hs_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    tax_class TEXT NOT NULL DEFAULT 'B', -- A=Exempt, B=Standard16%, C=Zero-rated, D=Non-VAT
    tax_rate REAL NOT NULL DEFAULT 16.0
);

-- Add HS code reference to products
ALTER TABLE products ADD COLUMN hs_code TEXT REFERENCES hs_codes(code);
ALTER TABLE products ADD COLUMN tax_class TEXT NOT NULL DEFAULT 'B';

-- Seed common HS codes for pharmacy
INSERT OR IGNORE INTO hs_codes (code, description, tax_class, tax_rate) VALUES
    ('3004.90.00', 'Medicaments, packaged for retail sale', 'A', 0.0),
    ('3003.90.00', 'Medicaments (mixtures), unpackaged', 'A', 0.0),
    ('3005.10.00', 'Adhesive dressings & similar', 'B', 16.0),
    ('3006.10.00', 'Sterile surgical catgut', 'A', 0.0),
    ('3306.10.00', 'Toothpaste, dentifrices', 'B', 16.0),
    ('3307.30.00', 'Bath salts & preparations', 'B', 16.0),
    ('9018.90.90', 'Medical instruments', 'A', 0.0),
    ('9990.90.00', 'Other (default)', 'B', 16.0);

-- Default config row
INSERT OR IGNORE INTO etims_config (id) VALUES ('default');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_etims_invoices_status ON etims_invoices(status);
CREATE INDEX IF NOT EXISTS idx_etims_invoices_sale ON etims_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_etims_invoices_created ON etims_invoices(created_at);
