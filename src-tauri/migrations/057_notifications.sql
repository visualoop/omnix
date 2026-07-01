-- ============================================================================
-- 057_notifications.sql — Central alerts store.
-- Producers write here (expiry scan, low-stock scan, unpaid-invoice scan,
-- cold-chain, PO ready, refill due, cash-count variance, etc.).
-- Consumers: bell icon in top bar + /notifications page.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,               -- 'expiry' | 'low_stock' | 'unpaid_invoice' | 'cold_chain' | 'po_ready' | 'refill_due' | 'variance' | 'system'
  severity TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  body TEXT,                        -- optional longer message
  link TEXT,                        -- deep-link URL inside the app (/inventory/expiry etc.)
  metadata TEXT DEFAULT '{}',       -- JSON blob for renderer-specific fields (batch ids, sale ids, etc.)
  read_at TEXT,                     -- null = unread
  snoozed_until TEXT,               -- null = not snoozed; otherwise hide until this timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_kind ON notifications(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed ON notifications(snoozed_until);
