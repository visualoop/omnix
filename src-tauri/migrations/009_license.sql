-- Phase 7: License storage
-- Stores the activated license key, bound to this machine.

CREATE TABLE IF NOT EXISTS license (
    id TEXT PRIMARY KEY DEFAULT 'active',
    license_key TEXT NOT NULL,
    license_kid TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    maintenance_expires_at TEXT NOT NULL,
    license_type TEXT NOT NULL,
    features_json TEXT NOT NULL,
    machine_fingerprint TEXT NOT NULL,
    activated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Activation log (for audit + future server-side activation tracking)
CREATE TABLE IF NOT EXISTS license_activations (
    id TEXT PRIMARY KEY,
    license_kid TEXT NOT NULL,
    machine_fingerprint TEXT NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('activated', 'verified', 'failed', 'deactivated')),
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_license_activations_kid ON license_activations(license_kid);
