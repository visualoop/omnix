-- ============================================================================
-- 072_low_tier.sql — Rental (Task 69), loyalty tiers (Task 70), signed audit
-- chain (Task 70), plugin registry (Task 65), channel manager (Task 66),
-- self-checkout config (Task 67), NFC config (Task 68).
-- ============================================================================

-- ─── Rental workflow (Task 69) ─────────────────────────
CREATE TABLE IF NOT EXISTS rental_agreements (
  id TEXT PRIMARY KEY,
  agreement_number TEXT NOT NULL UNIQUE, -- 'RA-2026-00001'
  customer_id TEXT NOT NULL REFERENCES customers(id),
  branch_id TEXT REFERENCES branches(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  actual_returned_at TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'returned' | 'overdue' | 'lost'
  deposit_amount REAL NOT NULL DEFAULT 0,
  deposit_returned INTEGER NOT NULL DEFAULT 0,
  damage_fee REAL NOT NULL DEFAULT 0,
  late_fee REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rental_status ON rental_agreements(status);

CREATE TABLE IF NOT EXISTS rental_items (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES rental_agreements(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  serial TEXT,                           -- per-unit serial if applicable
  quantity REAL NOT NULL DEFAULT 1,
  daily_rate REAL NOT NULL,
  returned_quantity REAL NOT NULL DEFAULT 0,
  condition_on_return TEXT
);

-- ─── Loyalty tiers UI (Task 70) ────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,             -- 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_points INTEGER NOT NULL,
  min_lifetime_spend REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  perks_json TEXT DEFAULT '[]',          -- JSON array of perk strings
  active INTEGER NOT NULL DEFAULT 1,
  color_hex TEXT DEFAULT '#8b5cf6',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed a standard tier ladder
INSERT OR IGNORE INTO loyalty_tiers (id, name, min_points, min_lifetime_spend, discount_pct, color_hex) VALUES
  ('tier-bronze', 'Bronze', 0, 0, 0, '#cd7f32'),
  ('tier-silver', 'Silver', 500, 25000, 2, '#c0c0c0'),
  ('tier-gold', 'Gold', 2000, 100000, 5, '#ffd700'),
  ('tier-platinum', 'Platinum', 10000, 500000, 10, '#e5e4e2');

-- ─── Signed audit chain (Task 70) ──────────────────────
-- Hash-chain: each new entry embeds SHA-256 of the previous. Tamper detection.
ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_log ADD COLUMN this_hash TEXT;

-- ─── Plugin registry (Task 65) ─────────────────────────
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  plugin_key TEXT NOT NULL UNIQUE,       -- 'omnix.first-party.dispatch'
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  publisher TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT DEFAULT '{}',
  scopes TEXT                            -- comma-separated permission scopes
);

-- ─── Channel manager (Task 66) — lodging OTA sync ──────
CREATE TABLE IF NOT EXISTS ota_channels (
  id TEXT PRIMARY KEY,
  channel_key TEXT NOT NULL UNIQUE,      -- 'booking.com', 'airbnb'
  name TEXT NOT NULL,
  api_key_encrypted TEXT,
  last_sync_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  config_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ota_reservations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES ota_channels(id),
  external_id TEXT NOT NULL,             -- OTA-side booking id
  omnix_reservation_id TEXT REFERENCES reservations(id),
  raw_payload TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (channel_id, external_id)
);

-- ─── Self-checkout config (Task 67) ────────────────────
-- No new tables — leverages settings for `pos.self_checkout.enabled` etc.
-- Add a marker so the setup wizard knows to expose it.
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('pos.self_checkout.enabled', 'false', 'pos'),
  ('pos.self_checkout.max_items', '10', 'pos');

-- ─── NFC tap-to-pay reader (Task 68) ───────────────────
CREATE TABLE IF NOT EXISTS nfc_readers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT,                           -- 'verifone' | 'ingenico' | 'pax'
  connection_string TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_transaction_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
