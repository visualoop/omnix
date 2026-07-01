-- ============================================================================
-- 064_approvals.sql — Approval workflow for POs and expenses above thresholds.
-- Setup: approval_rules define who approves what (by amount + module).
-- Runtime: approval_requests hold pending decisions; approval_actions log every
-- approve/reject with actor + timestamp.
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_rules (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- 'purchase_order' | 'expense' | 'stock_transfer' | 'debit_note'
  branch_id TEXT,                      -- null = applies to all branches
  min_amount REAL NOT NULL DEFAULT 0,  -- rule fires when amount >= this
  max_amount REAL,                     -- rule caps (nullable = no cap)
  approver_role TEXT NOT NULL,         -- 'owner' | 'manager'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appr_rules_kind ON approval_rules(kind, active);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- same as approval_rules.kind
  resource_id TEXT NOT NULL,           -- id of the po/expense/etc. being approved
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'cancelled'
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by TEXT,
  decided_at TEXT,
  decision_note TEXT,
  metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_appr_req_status ON approval_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_appr_req_resource ON approval_requests(kind, resource_id);

-- Seed sensible defaults for a Kenyan SME.
INSERT OR IGNORE INTO approval_rules (id, kind, min_amount, approver_role) VALUES
  ('rule-po-30k', 'purchase_order', 30000, 'manager'),
  ('rule-po-100k', 'purchase_order', 100000, 'owner'),
  ('rule-expense-10k', 'expense', 10000, 'manager'),
  ('rule-expense-50k', 'expense', 50000, 'owner');
