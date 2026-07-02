-- ============================================================================
-- 071_medium_batch_c.sql — Platform level: anomaly log, scheduled reports,
-- custom fields registry + values, data-quality flags, consolidated dashboard.
-- ============================================================================

-- ─── Anomaly alerts (Task 54) ──────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_log (
  id TEXT PRIMARY KEY,
  detector TEXT NOT NULL,                -- 'variance_jump' | 'expiry_spike' | 'sales_drop' | 'staff_discount_high'
  severity TEXT NOT NULL DEFAULT 'warning',
  entity_kind TEXT,                      -- 'branch' | 'staff' | 'sku' | 'day'
  entity_id TEXT,
  baseline_value REAL,
  observed_value REAL,
  variance_pct REAL,
  window_start TEXT,
  window_end TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  message TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_by TEXT,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_log(status, detected_at DESC);

-- ─── Report scheduling / Excel export flag on saved_reports ───
-- saved_reports table exists in migration 067. Add missing fields.
ALTER TABLE saved_reports ADD COLUMN export_format TEXT NOT NULL DEFAULT 'pdf';
-- 'pdf' | 'xlsx' | 'csv'
ALTER TABLE saved_reports ADD COLUMN last_run_at TEXT;
ALTER TABLE saved_reports ADD COLUMN last_run_status TEXT;

CREATE TABLE IF NOT EXISTS report_run_log (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'failed'
  rows_generated INTEGER,
  export_path TEXT,
  error_message TEXT
);

-- ─── Custom / user-defined fields (Task 59) ────────────
CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  entity_kind TEXT NOT NULL,             -- 'product' | 'customer' | 'supplier' | 'employee'
  field_key TEXT NOT NULL,               -- unique within entity_kind: 'shelf_location', 'shirt_size'
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,              -- 'text' | 'number' | 'date' | 'boolean' | 'select'
  options TEXT,                          -- JSON array for 'select' type
  required INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entity_kind, field_key)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,               -- product.id / customer.id / etc.
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (field_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_cfv_entity ON custom_field_values(entity_id);

-- ─── Data-quality flags (Task 61) ──────────────────────
-- Populated by a scan job; UI at /data-quality lists open issues.
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id TEXT PRIMARY KEY,
  issue_kind TEXT NOT NULL,              -- 'duplicate_customer' | 'orphan_sale' | 'negative_stock' | 'unreconciled_payment' | 'missing_customer'
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,                          -- JSON blob with specifics
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  UNIQUE (issue_kind, entity_id) ON CONFLICT REPLACE
);
CREATE INDEX IF NOT EXISTS idx_dq_status ON data_quality_issues(status, detected_at DESC);
