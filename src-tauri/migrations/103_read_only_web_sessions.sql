-- One-time desktop-authorised grants for read-only browser sessions.
-- The browser may redeem a grant exactly once; neither grant nor session token
-- is stored in plaintext. Claim snapshots cannot be widened during redemption.
CREATE TABLE IF NOT EXISTS web_read_session_grants (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE
    CHECK(length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  user_id TEXT NOT NULL REFERENCES users(id),
  authorized_by_user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('viewer', 'manager')),
  assigned_branch_ids_json TEXT NOT NULL
    CHECK(json_valid(assigned_branch_ids_json)
      AND json_type(assigned_branch_ids_json) = 'array'
      AND json_array_length(assigned_branch_ids_json) BETWEEN 1 AND 100),
  permissions_json TEXT NOT NULL
    CHECK(json_valid(permissions_json)
      AND json_type(permissions_json) = 'array'
      AND json_array_length(permissions_json) BETWEEN 1 AND 6),
  device_label TEXT NOT NULL CHECK(length(device_label) BETWEEN 1 AND 120),
  issued_at_unix_seconds INTEGER NOT NULL,
  session_expires_at_unix_seconds INTEGER NOT NULL,
  grant_expires_at_unix_seconds INTEGER NOT NULL,
  redeemed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(session_expires_at_unix_seconds > issued_at_unix_seconds),
  CHECK(session_expires_at_unix_seconds - issued_at_unix_seconds <= 28800),
  CHECK(grant_expires_at_unix_seconds > issued_at_unix_seconds),
  CHECK(grant_expires_at_unix_seconds - issued_at_unix_seconds <= 600)
);

CREATE INDEX IF NOT EXISTS idx_web_read_session_grants_redeem
  ON web_read_session_grants(code_hash, grant_expires_at_unix_seconds)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_web_read_session_grants_user
  ON web_read_session_grants(user_id, session_expires_at_unix_seconds);

CREATE INDEX IF NOT EXISTS idx_web_read_sessions_admin_list
  ON web_read_sessions(revoked_at, expires_at_unix_seconds, created_at DESC);
