-- Audit log for high/critical permission-gated actions (RBAC enforcement).
-- Append-only. Records who attempted what, the permission required, the
-- outcome (allowed/denied), and optional context (entity + metadata).

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    permission_key TEXT NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('allowed','denied')),
    risk_level TEXT NOT NULL DEFAULT 'normal',
    branch_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_perm ON audit_log(permission_key);
