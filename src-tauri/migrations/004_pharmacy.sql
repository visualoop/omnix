-- Omnix Pharmacy (Dawa) Schema

-- Pharmacy-specific product attributes
CREATE TABLE IF NOT EXISTS pharmacy_products (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    generic_name TEXT,
    brand_name TEXT,
    dosage_form TEXT,
    strength TEXT,
    manufacturer TEXT,
    requires_prescription INTEGER NOT NULL DEFAULT 0,
    is_controlled INTEGER NOT NULL DEFAULT 0,
    schedule_class TEXT,
    storage_conditions TEXT,
    cold_chain INTEGER NOT NULL DEFAULT 0
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    rx_number INTEGER NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_age INTEGER,
    doctor_name TEXT,
    doctor_license TEXT,
    hospital TEXT,
    diagnosis TEXT,
    notes TEXT,
    dispensed_by TEXT REFERENCES users(id),
    sale_id TEXT REFERENCES sales(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispensed','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prescription items
CREATE TABLE IF NOT EXISTS prescription_items (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    quantity_prescribed REAL NOT NULL,
    quantity_dispensed REAL NOT NULL DEFAULT 0,
    substitution_allowed INTEGER NOT NULL DEFAULT 1,
    instructions TEXT
);

-- Controlled substances log (legal requirement)
CREATE TABLE IF NOT EXISTS controlled_log (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    batch_id TEXT REFERENCES batches(id),
    action TEXT NOT NULL CHECK (action IN ('received','dispensed','adjusted','destroyed')),
    quantity REAL NOT NULL,
    patient_name TEXT,
    prescription_id TEXT REFERENCES prescriptions(id),
    balance_after REAL NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sequence for prescription numbers
INSERT OR IGNORE INTO sequences (name, value) VALUES ('rx_number', 0);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_name);
CREATE INDEX IF NOT EXISTS idx_prescriptions_phone ON prescriptions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_controlled_log_product ON controlled_log(product_id);
CREATE INDEX IF NOT EXISTS idx_controlled_log_created ON controlled_log(created_at);
