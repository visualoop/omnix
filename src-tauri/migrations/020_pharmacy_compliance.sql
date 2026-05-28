-- ============================================================================
-- 020_pharmacy_compliance.sql
-- Pharmacist on duty + PPB compliance + drug allergies + controlled register
-- ============================================================================

-- Pharmacist licensing info on employees
ALTER TABLE employees ADD COLUMN pharmacist_license_number TEXT;
ALTER TABLE employees ADD COLUMN is_pharmacist INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN pharmacist_license_expiry TEXT;

-- Track pharmacist for each prescription dispense (separate from cashier who punches in)
ALTER TABLE prescriptions ADD COLUMN pharmacist_id TEXT REFERENCES employees(id);

-- Extend controlled_log with statutory fields needed for PPB register
ALTER TABLE controlled_log ADD COLUMN patient_id_number TEXT;
ALTER TABLE controlled_log ADD COLUMN prescribed_by TEXT;
ALTER TABLE controlled_log ADD COLUMN prescription_number TEXT;
ALTER TABLE controlled_log ADD COLUMN pharmacist_id TEXT REFERENCES employees(id);

-- PPB / regulatory fields for pharmacy products
ALTER TABLE products ADD COLUMN ppb_registration_number TEXT;
ALTER TABLE products ADD COLUMN drug_schedule TEXT
    CHECK (drug_schedule IS NULL OR drug_schedule IN ('OTC','POM','Schedule_II','Schedule_III','Schedule_IV','controlled'));
ALTER TABLE products ADD COLUMN species TEXT NOT NULL DEFAULT 'human'
    CHECK (species IN ('human','veterinary','both'));

-- Patient chronic conditions (allergies already exist from migration 012)
CREATE TABLE IF NOT EXISTS patient_conditions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    condition TEXT NOT NULL,                 -- "Diabetes Type 2", "Hypertension"
    icd10_code TEXT,
    diagnosed_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conditions_customer ON patient_conditions(customer_id);

-- Drug-allergy mapping (which drugs flag which allergy classes)
-- Pre-populate common ones
CREATE TABLE IF NOT EXISTS drug_allergy_class (
    id TEXT PRIMARY KEY,
    drug_pattern TEXT NOT NULL,              -- "amoxicillin", "ampicillin" etc.
    allergy_class TEXT NOT NULL,             -- "penicillin", "sulfa", etc.
    severity TEXT NOT NULL DEFAULT 'moderate'
);
CREATE INDEX IF NOT EXISTS idx_drug_allergy_class ON drug_allergy_class(allergy_class);

-- Seed common penicillin family
INSERT OR IGNORE INTO drug_allergy_class (id, drug_pattern, allergy_class, severity) VALUES
    ('da-pen-amox', 'amoxicillin', 'penicillin', 'severe'),
    ('da-pen-amp', 'ampicillin', 'penicillin', 'severe'),
    ('da-pen-pen', 'penicillin', 'penicillin', 'severe'),
    ('da-pen-coa', 'co-amoxiclav', 'penicillin', 'severe'),
    ('da-pen-fluc', 'flucloxacillin', 'penicillin', 'severe'),
    ('da-sulfa-cot', 'cotrimoxazole', 'sulfa', 'severe'),
    ('da-sulfa-bac', 'bactrim', 'sulfa', 'severe'),
    ('da-nsaid-ibu', 'ibuprofen', 'nsaid', 'moderate'),
    ('da-nsaid-dic', 'diclofenac', 'nsaid', 'moderate'),
    ('da-nsaid-asp', 'aspirin', 'aspirin', 'moderate'),
    ('da-cep-cef', 'cefuroxime', 'cephalosporin', 'moderate'),
    ('da-cep-ceft', 'ceftriaxone', 'cephalosporin', 'moderate');
