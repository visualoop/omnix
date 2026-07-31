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
