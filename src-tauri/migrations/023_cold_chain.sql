-- ============================================================================
-- 023_cold_chain.sql
-- Cold chain (fridge) temperature logs for pharmacies
-- ============================================================================

CREATE TABLE IF NOT EXISTS cold_chain_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                       -- "Main Fridge", "Vaccine Freezer"
    location TEXT,
    target_min_c REAL NOT NULL DEFAULT 2,     -- WHO: 2-8°C for most refrigerated drugs
    target_max_c REAL NOT NULL DEFAULT 8,
    last_temp_c REAL,
    last_recorded_at TEXT,
    branch_id TEXT REFERENCES branches(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO cold_chain_units (id, name, location, target_min_c, target_max_c, branch_id) VALUES
    ('cc-main', 'Main Pharmacy Fridge', 'Pharmacy', 2, 8, 'default-branch');

CREATE TABLE IF NOT EXISTS cold_chain_logs (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES cold_chain_units(id),
    temperature_c REAL NOT NULL,
    reading_at TEXT NOT NULL DEFAULT (datetime('now')),
    in_range INTEGER NOT NULL DEFAULT 1,
    action_taken TEXT,                        -- if out of range: what was done
    notes TEXT,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cc_logs_unit ON cold_chain_logs(unit_id, reading_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_logs_out_range ON cold_chain_logs(in_range);
