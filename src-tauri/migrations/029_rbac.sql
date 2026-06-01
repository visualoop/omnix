-- ============================================================================
-- 029_rbac.sql — Granular RBAC (per docs/plans/09 §6)
-- Dynamic roles, permission catalog, groups, branch/module scopes, overrides.
-- users.role is kept for backward-compat; the resolver prefers user_roles.
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    module_id TEXT NOT NULL DEFAULT 'core',
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'normal'
      CHECK (risk_level IN ('low','normal','high','critical'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    branch_id TEXT,
    module_id TEXT,
    PRIMARY KEY (user_id, role_id, branch_id, module_id)
);

CREATE TABLE IF NOT EXISTS group_roles (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    branch_id TEXT,
    module_id TEXT,
    PRIMARY KEY (group_id, role_id, branch_id, module_id)
);

CREATE TABLE IF NOT EXISTS permission_overrides (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('user','group','role')),
    subject_id TEXT NOT NULL,
    permission_key TEXT NOT NULL REFERENCES permissions(key),
    effect TEXT NOT NULL CHECK (effect IN ('allow','deny')),
    branch_id TEXT,
    module_id TEXT,
    reason TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_overrides_subject ON permission_overrides(subject_type, subject_id);

-- ── Seed system roles (is_system=1, cannot be deleted) ──────────────────────
INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES
  ('role_owner',   'Owner',   'Full access — sees and changes everything',          1),
  ('role_manager', 'Manager', 'Operations — inventory, purchases, reports, no admin', 1),
  ('role_cashier', 'Cashier', 'POS-focused — sells, dispenses, runs Z-report',       1),
  ('role_viewer',  'Viewer',  'Read-only — sees reports, no changes',                1);
