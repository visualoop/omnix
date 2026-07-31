-- Dedicated sessions for the LAN browser reporting companion.
-- Raw bearer material is never stored: token_hash is lowercase SHA-256 hex.
-- Claims are an issuance-time authorization snapshot and every HTTP request
-- still enforces expiry, read_only, branch assignment, and report permission.
CREATE TABLE IF NOT EXISTS web_read_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE
    CHECK(length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('viewer', 'manager')),
  read_only INTEGER NOT NULL DEFAULT 1 CHECK(read_only = 1),
  assigned_branch_ids_json TEXT NOT NULL
    CHECK(json_valid(assigned_branch_ids_json)
      AND json_type(assigned_branch_ids_json) = 'array'
      AND json_array_length(assigned_branch_ids_json) BETWEEN 1 AND 100),
  permissions_json TEXT NOT NULL
    CHECK(json_valid(permissions_json)
      AND json_type(permissions_json) = 'array'
      AND json_array_length(permissions_json) BETWEEN 1 AND 6),
  device_label TEXT NOT NULL CHECK(length(device_label) BETWEEN 1 AND 120),
  issued_at_unix_seconds INTEGER NOT NULL CHECK(typeof(issued_at_unix_seconds) = 'integer'),
  expires_at_unix_seconds INTEGER NOT NULL CHECK(typeof(expires_at_unix_seconds) = 'integer'),
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(expires_at_unix_seconds > issued_at_unix_seconds),
  CHECK(expires_at_unix_seconds - issued_at_unix_seconds <= 28800)
);

CREATE INDEX IF NOT EXISTS idx_web_read_sessions_active
  ON web_read_sessions(token_hash, expires_at_unix_seconds)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_web_read_sessions_user
  ON web_read_sessions(user_id, expires_at_unix_seconds);
