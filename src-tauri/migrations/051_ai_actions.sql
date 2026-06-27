-- ============================================================================
-- 051_ai_actions.sql — human-in-the-loop AI write-action ledger.
--
-- The AI can PROPOSE a structured mutation (categorise products, set a reorder
-- level, draft a purchase order). The user confirms it in a dialog; only then
-- does it run, through the same audited services a human uses. Every proposal —
-- applied, rejected, or failed — is recorded here for transparency + an audit
-- trail of what the assistant did on the operator's behalf.
--
-- This table never authorises anything; it's a record. Permission checks and
-- the actual mutation happen in services/ai/actions.ts + the target service.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_actions (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,                 -- e.g. 'draft_purchase_order'
  summary TEXT NOT NULL,                   -- human one-liner shown at confirm time
  payload_json TEXT NOT NULL,              -- the exact proposed payload
  status TEXT NOT NULL DEFAULT 'proposed'  -- proposed | applied | rejected | failed
    CHECK (status IN ('proposed','applied','rejected','failed')),
  result_message TEXT,                     -- outcome / error text
  proposed_by TEXT REFERENCES users(id),
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);

-- ─── Register the new AI features surfaced this release ─────────────────────
-- (Data-driven: they appear automatically in Settings → AI → Features.)

INSERT OR IGNORE INTO ai_features (feature_id, display_name, description, enabled, privacy_tier, task_kind) VALUES
  ('ask_data',        'Ask your data',      'Answers business questions from live ERP data (profit, reorder, churn, supplier scores)', 1, 'medium', 'text'),
  ('action_proposer', 'AI actions',         'Proposes confirmable actions (draft PO, categorise products, set reorder levels)',        1, 'medium', 'reasoning');
