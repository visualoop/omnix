-- ============================================================================
-- 067_platform_extensions.sql — Bulk platform tables for the High-tier batch:
-- - Customer communication history + follow-ups
-- - Fixed assets + depreciation
-- - Multi-currency (currencies + exchange_rates)
-- - Pharmacy recalls
-- - Room status + housekeeping
-- - Per-record change history for money entities
-- - Report builder saved queries
-- - Password policies + PIN login
-- ============================================================================

-- ─── Customer communications + follow-ups ─────────────────
CREATE TABLE IF NOT EXISTS customer_communications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,             -- 'sms' | 'email' | 'whatsapp' | 'call' | 'in_person'
  direction TEXT NOT NULL,           -- 'outbound' | 'inbound'
  subject TEXT,
  body TEXT,
  staff_id TEXT,                     -- users.id who logged it
  external_ref TEXT,                 -- SMS gateway id, email message-id, etc.
  status TEXT NOT NULL DEFAULT 'sent', -- 'draft' | 'sent' | 'delivered' | 'failed' | 'received'
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comms_customer ON customer_communications(customer_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  entity_kind TEXT,                  -- 'invoice' | 'quote' | 'lead' | null
  entity_id TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  due_at TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'done' | 'cancelled'
  completed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_followup_due ON follow_ups(status, due_at);
CREATE INDEX IF NOT EXISTS idx_followup_assignee ON follow_ups(assignee_id, due_at);

-- ─── Fixed assets + depreciation ───────────────────────────
CREATE TABLE IF NOT EXISTS fixed_assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,                     -- 'furniture' | 'equipment' | 'vehicles' | 'buildings'
  acquired_date TEXT NOT NULL,
  cost REAL NOT NULL,
  salvage_value REAL NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'straight_line', -- 'straight_line' | 'reducing_balance'
  accumulated_depreciation REAL NOT NULL DEFAULT 0,
  branch_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'disposed' | 'written_off'
  disposed_date TEXT,
  disposal_proceeds REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fa_status ON fixed_assets(status);

CREATE TABLE IF NOT EXISTS depreciation_entries (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,        -- 'YYYY-MM'
  depreciation_amount REAL NOT NULL,
  book_value_after REAL NOT NULL,
  journal_entry_id TEXT,             -- link to journal_entries.id when posted
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asset_id, period_label)
);

-- ─── Multi-currency ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,             -- 'KES', 'USD', 'EUR', 'NGN', 'UGX', 'TZS'
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 2,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY,
  from_code TEXT NOT NULL REFERENCES currencies(code),
  to_code TEXT NOT NULL REFERENCES currencies(code),
  rate REAL NOT NULL,
  as_of_date TEXT NOT NULL,
  source TEXT,                       -- 'manual' | 'cbk' | 'ecb'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (from_code, to_code, as_of_date)
);

-- Seed base + common regional currencies.
INSERT OR IGNORE INTO currencies (code, name, symbol) VALUES
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('UGX', 'Ugandan Shilling', 'USh'),
  ('TZS', 'Tanzanian Shilling', 'TSh'),
  ('RWF', 'Rwandan Franc', 'FRw'),
  ('NGN', 'Nigerian Naira', '₦');

-- ─── Pharmacy recalls ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS recalls (
  id TEXT PRIMARY KEY,
  recall_number TEXT NOT NULL UNIQUE,
  product_id TEXT REFERENCES products(id),
  batch_number TEXT,                 -- matches batches.batch_number for filter
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  issued_by TEXT,                    -- MOH, KEMSA, WHO, or self
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  quarantine_action TEXT,            -- 'return_supplier' | 'destroy' | 'hold_for_review'
  affected_batches TEXT,             -- JSON array of batch ids
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'closed'
  notes TEXT,
  created_by TEXT,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recalls_status ON recalls(status);

-- Quarantine flag on batches. If a recall applies, batches.quarantined = 1 → POS filters out.
ALTER TABLE batches ADD COLUMN quarantined INTEGER NOT NULL DEFAULT 0;

-- ─── Room status + housekeeping (hospitality lodging) ───────
-- rooms table exists (migration 035); we add per-room-status tracking here.
CREATE TABLE IF NOT EXISTS room_status_log (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL,              -- 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'occupied'
  changed_by TEXT,
  notes TEXT,
  photo_url TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_room_status ON room_status_log(room_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  task_kind TEXT NOT NULL,           -- 'clean' | 'inspect' | 'linen_change' | 'deep_clean'
  assigned_to TEXT,                  -- staff id
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'done'
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extend rooms with a live status column for quick reads.
ALTER TABLE rooms ADD COLUMN current_status TEXT NOT NULL DEFAULT 'clean';

-- ─── Per-record change history for money entities ───────────
CREATE TABLE IF NOT EXISTS record_history (
  id TEXT PRIMARY KEY,
  entity_kind TEXT NOT NULL,          -- 'product' | 'invoice' | 'sale' | 'expense' | 'price'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,               -- 'create' | 'update' | 'delete'
  before_state TEXT,                  -- JSON snapshot before change
  after_state TEXT,                   -- JSON snapshot after change
  changed_by TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_entity ON record_history(entity_kind, entity_id, changed_at DESC);

-- ─── Report builder ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                     -- 'sales' | 'purchases' | 'inventory' | 'finance' | 'custom'
  query_json TEXT NOT NULL,          -- serialised query definition (dimensions, measures, filters)
  schedule TEXT,                     -- cron-ish: 'daily' | 'weekly' | 'monthly' | null
  next_run_at TEXT,
  recipient_emails TEXT,             -- comma-separated
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Password policies + PIN login ─────────────────────────
CREATE TABLE IF NOT EXISTS password_policies (
  id TEXT PRIMARY KEY DEFAULT 'default',
  min_length INTEGER NOT NULL DEFAULT 8,
  require_uppercase INTEGER NOT NULL DEFAULT 0,
  require_number INTEGER NOT NULL DEFAULT 1,
  require_symbol INTEGER NOT NULL DEFAULT 0,
  max_age_days INTEGER,              -- null = no rotation required
  reuse_limit INTEGER NOT NULL DEFAULT 5,
  lockout_after_failures INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO password_policies (id) VALUES ('default');

-- PIN column on users for POS quick-switch on shared tills.
ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_updated_at TEXT;

-- Login attempts (for lockout)
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  ip_address TEXT,
  succeeded INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, attempted_at DESC);
