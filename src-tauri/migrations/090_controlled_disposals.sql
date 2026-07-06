-- ============================================================================
-- 090_controlled_disposals.sql
-- Statutory witnessed-destruction record for controlled substances. Expired
-- scheduled drugs can't just be written off — the Narcotic Drugs & Psychotropic
-- Substances Act requires witnessed destruction (two signatories) + PPB
-- notification. This logs that event; it complements the stock write-off.
-- ============================================================================

CREATE TABLE IF NOT EXISTS controlled_disposals (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    batch_id TEXT REFERENCES batches(id),
    batch_number TEXT,
    quantity REAL NOT NULL,
    method TEXT NOT NULL,                    -- e.g. "Incineration", "Crushed + NEMA contractor"
    witness_1_name TEXT NOT NULL,
    witness_1_license TEXT,
    witness_2_name TEXT NOT NULL,
    witness_2_license TEXT,
    ppb_notified INTEGER NOT NULL DEFAULT 0,
    ppb_notification_ref TEXT,
    notes TEXT,
    disposed_by TEXT REFERENCES users(id),
    disposed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_controlled_disposals_product ON controlled_disposals(product_id);
CREATE INDEX IF NOT EXISTS idx_controlled_disposals_date ON controlled_disposals(disposed_at DESC);
