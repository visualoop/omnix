-- ============================================================================
-- 085_pharmacy_licenses.sql
-- Track statutory licenses required by every Kenyan retail pharmacy:
--   • Premises registration (issued yearly by PPB)
--   • Pharmacist / pharmaceutical technologist annual practicing licence
--   • Superintendent Pharmacist attachment letter
--   • Controlled substances handling permit
-- Renewal is the single biggest silent compliance hole once a pharmacy is
-- running — the licence lapses on 31-Dec, PPB inspectors close the shop
-- on 15-Jan. This surface makes the expiry visible.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pharmacy_licenses (
    id TEXT PRIMARY KEY,
    license_type TEXT NOT NULL CHECK (license_type IN (
        'premises',
        'pharmacist',
        'ppb_annual',
        'superintendent',
        'controlled_permit',
        'other'
    )),
    license_number TEXT NOT NULL,
    holder_name TEXT,           -- Pharmacist name, or premises name
    issued_at TEXT,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'expiring_soon',        -- computed at read-time; stored value is a hint
        'expired',
        'renewed'
    )),
    notes TEXT,
    document_path TEXT,         -- optional scan / PDF path
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_licenses_expires ON pharmacy_licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_pharmacy_licenses_type ON pharmacy_licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_pharmacy_licenses_status ON pharmacy_licenses(status);

-- Refill reminders queue. Populated by the daily scan
-- (services/refill-reminders.ts::queueRefillReminders). Downstream SMS
-- job reads sent_at IS NULL and dispatches via the SMS gateway.
CREATE TABLE IF NOT EXISTS refill_reminders (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL REFERENCES prescriptions(id),
    rx_number INTEGER NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    drug_summary TEXT NOT NULL,
    refills_remaining INTEGER NOT NULL,
    due_on TEXT NOT NULL,
    queued_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    sent_ref TEXT,
    failure_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_refill_reminders_due ON refill_reminders(due_on);
CREATE INDEX IF NOT EXISTS idx_refill_reminders_pending ON refill_reminders(sent_at) WHERE sent_at IS NULL;
