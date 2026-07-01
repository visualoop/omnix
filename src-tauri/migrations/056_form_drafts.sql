-- ============================================================================
-- 056_form_drafts.sql — Autosave for long forms.
-- Any form (invoice-new, purchase-orders, stock-take) that risks data loss
-- via crash / accidental navigation writes into this table on every change,
-- then reads back on open with a "Restore draft?" banner.
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_drafts (
  id TEXT PRIMARY KEY,             -- <user_id>:<form_key>:<entity_id_or_new>
  user_id TEXT NOT NULL,
  form_key TEXT NOT NULL,          -- 'invoice-new', 'purchase-order', 'stock-take'
  entity_id TEXT,                  -- null when creating new; set when editing existing
  payload TEXT NOT NULL,           -- JSON blob of the form state
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_drafts_user_form ON form_drafts(user_id, form_key);
CREATE INDEX IF NOT EXISTS idx_form_drafts_updated ON form_drafts(updated_at);
