-- ============================================================================
-- 015_trial_mode.sql
-- Local trial mode (no server needed). 30 days from first launch, then
-- the user must enter a license key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS trial_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    machine_fingerprint TEXT NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    -- "trial_started" event creates the row. Once this exists, the trial
    -- has been consumed for this machine and cannot be restarted by clearing
    -- localStorage (the row stays in the DB).
    consumed INTEGER NOT NULL DEFAULT 1
);
