-- Phase 8: multi-license per machine.
-- Stores every licence key the user has activated on this PC. Supersedes
-- the single 'license' table (which we keep around for backward compat —
-- the first row from it becomes the primary entry in local_licenses).
--
-- Each row corresponds to one licence active on this machine. The user
-- can hold N at once (Dawa + Retail + Hospitality is fine; Pro excludes
-- the four trade variants, enforced server-side).

CREATE TABLE IF NOT EXISTS local_licenses (
    license_key TEXT PRIMARY KEY,
    license_id TEXT,                          -- server-side licence row id (UUID)
    variant TEXT NOT NULL,                    -- pro | dawa | retail | hospitality | hardware
    tier TEXT NOT NULL DEFAULT 'trial',       -- trial | starter | business
    status TEXT NOT NULL DEFAULT 'active',    -- active | trial | lapsed | revoked | suspended
    signed_key TEXT,                          -- RSA-signed payload from the original issue
    modules TEXT,                             -- JSON array (e.g. '["dawa","insurance"]')
    max_machines INTEGER NOT NULL DEFAULT 3,
    max_branches INTEGER NOT NULL DEFAULT 1,
    auth_token TEXT,                          -- bearer for telemetry + heartbeat
    auth_token_hash TEXT,                     -- mirror of what the server has
    last_synced_at TEXT,                      -- ISO timestamp of last sync verify
    sync_status TEXT,                         -- verified | foreign | orphan_payload | recreated | seat_taken | pending
    sync_message TEXT,                        -- the human-readable note we got back
    trial_ends_at TEXT,
    maintenance_until TEXT,
    activated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_local_licenses_variant ON local_licenses(variant);
CREATE INDEX IF NOT EXISTS idx_local_licenses_status ON local_licenses(status);

-- One-shot back-fill from the legacy single-row `license` table. Only
-- runs once because we use INSERT OR IGNORE keyed on license_key.
INSERT OR IGNORE INTO local_licenses (
    license_key,
    license_id,
    variant,
    tier,
    status,
    signed_key,
    modules,
    activated_at,
    last_verified_at
)
SELECT
    license_key,
    NULL,
    COALESCE(license_type, 'pro'),
    'starter',
    'active',
    NULL,
    features_json,
    activated_at,
    last_verified_at
FROM license
WHERE EXISTS (SELECT 1 FROM license);

-- Active workspace pointer — which licence's variant the UI is currently
-- showing. Defaults to "core" (no licence) but a real value gets set
-- when the desktop loads local_licenses on startup.
INSERT OR IGNORE INTO settings (key, value, category)
VALUES ('local_licenses.active_key', '', 'licensing');
