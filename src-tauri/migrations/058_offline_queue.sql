-- ============================================================================
-- 058_offline_queue.sql — LAN client offline queue.
-- When the master is unreachable, LAN clients write mutating operations
-- (sales, payments, returns) here instead of failing. A background worker
-- replays them the moment the master is reachable again.
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_queue (
  id TEXT PRIMARY KEY,
  op_kind TEXT NOT NULL,               -- 'sale', 'payment', 'return', 'customer_payment', ...
  op_url TEXT NOT NULL,                -- master URL path we would have called
  op_method TEXT NOT NULL DEFAULT 'POST',
  payload TEXT NOT NULL,               -- JSON body
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  succeeded_at TEXT,                   -- null = pending, non-null = replayed OK
  failed_permanently_at TEXT           -- non-null = won't retry (needs manual review)
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_pending
  ON offline_queue(created_at)
  WHERE succeeded_at IS NULL AND failed_permanently_at IS NULL;
