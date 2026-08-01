/// Branch-local login lookup. Parameters: node id, branch id, normalized username.
/// The selected principal must still be expanded from RBAC leaves in the same local database.
pub const FIND_LOCAL_CREDENTIAL: &str = r#"
SELECT u.id, u.username, u.password_hash, ub.branch_id, d.id AS node_id,
       u.active AS user_active, d.approved AS node_approved
FROM users u
JOIN user_branches ub ON ub.user_id = u.id AND ub.branch_id = ?2
JOIN devices d ON d.id = ?1 AND d.approved = 1
JOIN branches b ON b.id = ub.branch_id AND b.active = 1
WHERE lower(u.username) = ?3 AND u.active = 1
LIMIT 1
"#;

pub const INSERT_LOCAL_SESSION: &str = r#"
INSERT INTO authenticated_sessions (
  id, token_hash, user_id, node_id, access_mode, authentication_level,
  branch_local, issued_at, expires_at, revoked_at
) VALUES (?1, ?2, ?3, ?4, ?5, 'user', 1, ?6, ?7, NULL)
"#;

pub const RESOLVE_SESSION: &str = r#"
SELECT s.id, s.user_id, s.node_id, s.access_mode, s.authentication_level,
       s.branch_local, s.issued_at, s.expires_at, s.revoked_at
FROM authenticated_sessions s
JOIN users u ON u.id = s.user_id AND u.active = 1
JOIN devices d ON d.id = s.node_id AND d.approved = 1
WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND s.revoked_at IS NULL
LIMIT 1
"#;

/// Server-side principal expansion. These fixed leaves never accept caller SQL.
pub const LOAD_ASSIGNED_BRANCHES: &str = r#"
SELECT ub.branch_id
FROM user_branches ub
JOIN branches b ON b.id = ub.branch_id AND b.active = 1
WHERE ub.user_id = ?1
ORDER BY ub.branch_id
"#;

pub const LOAD_ROLE_GRANTS: &str = r#"
SELECT role_id, branch_id, module_id FROM user_roles WHERE user_id = ?1
UNION
SELECT gr.role_id, gr.branch_id, gr.module_id
FROM group_roles gr JOIN group_members gm ON gm.group_id = gr.group_id
WHERE gm.user_id = ?1
"#;

pub const LOAD_LEGACY_ROLE: &str = "SELECT role FROM users WHERE id = ?1 AND active = 1";

pub const LOAD_PERMISSION_GRANTS: &str = r#"
SELECT rp.permission_key, rp.effect, ur.branch_id, ur.module_id
FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
WHERE ur.user_id = ?1
UNION ALL
SELECT rp.permission_key, rp.effect, gr.branch_id, gr.module_id
FROM group_members gm
JOIN group_roles gr ON gr.group_id = gm.group_id
JOIN role_permissions rp ON rp.role_id = gr.role_id
WHERE gm.user_id = ?1
UNION ALL
SELECT po.permission_key, po.effect, po.branch_id, po.module_id
FROM permission_overrides po
WHERE (po.subject_type = 'user' AND po.subject_id = ?1)
   OR (po.subject_type = 'group' AND po.subject_id IN
       (SELECT group_id FROM group_members WHERE user_id = ?1))
   OR (po.subject_type = 'role' AND po.subject_id IN
       (SELECT role_id FROM user_roles WHERE user_id = ?1
        UNION SELECT gr.role_id FROM group_roles gr
        JOIN group_members gm ON gm.group_id = gr.group_id WHERE gm.user_id = ?1))
"#;

pub const LOAD_LICENCE_FACTS: &str = r#"
SELECT variant, modules
FROM local_licenses
WHERE status IN ('active','trial')
  AND (trial_ends_at IS NULL OR datetime(trial_ends_at) > datetime(?1))
ORDER BY activated_at DESC
"#;

pub const LOAD_LEGACY_LICENCE_COUNT: &str = "SELECT COUNT(*) FROM license";

pub const RECORD_LOCAL_LOGIN_FAILURE: &str = r#"
INSERT INTO audit_log (
 id, permission_key, action, outcome, risk_level, branch_id, entity_type, entity_id, metadata, created_at
) VALUES (?1, 'auth.login', 'auth.branch_local_login', 'denied', 'normal', ?2,
          'authenticated_session', NULL, ?3, ?4)
"#;

pub const INSERT_LOCAL_LOGIN_AUDIT: &str = r#"
INSERT INTO audit_log (
 id, user_id, permission_key, action, outcome, risk_level, branch_id,
 entity_type, entity_id, metadata, created_at
) VALUES (?1, ?2, 'auth.login', 'auth.branch_local_login', 'allowed', 'normal', ?3,
          'authenticated_session', ?4, ?5, ?6)
"#;
