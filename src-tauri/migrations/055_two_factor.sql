-- ============================================================================
-- 055_two_factor.sql — Persist TOTP secrets + backup codes to SQLite.
-- localStorage-only 2FA is lost on cache clear; we mirror to a durable table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor (
  user_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,                     -- base32 TOTP secret
  backup_codes TEXT NOT NULL DEFAULT '[]',  -- JSON array of remaining backup codes
  enabled INTEGER NOT NULL DEFAULT 0,       -- 0 = enrolling, 1 = active
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_two_factor_enabled ON two_factor(enabled);
