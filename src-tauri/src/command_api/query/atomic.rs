/// Parameter 1 is the server-generated command id; all other values are server-validated binds.
pub const CLAIM_COMMAND: &str = r#"
INSERT INTO command_ledger (
  command_id, fingerprint, state, user_id, node_id, session_id, branch_id,
  command_type, expected_revision, authentication_level, created_at
) VALUES (?1, ?2, 'processing', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
ON CONFLICT(command_id) DO NOTHING
"#;

pub const LOAD_COMMAND_CLAIM: &str = r#"
SELECT fingerprint, state, response_json, resulting_revision, user_id, node_id, branch_id, session_id
FROM command_ledger
WHERE command_id = ?1
"#;

pub const INSERT_AUDIT: &str = r#"
INSERT INTO audit_log (
  id, user_id, permission_key, action, outcome, risk_level, branch_id,
  entity_type, entity_id, metadata, created_at
) VALUES (?1, ?2, ?3, ?4, 'allowed', ?5, ?6, ?7, ?8, ?9, ?10)
"#;

pub const INSERT_OUTBOX: &str = r#"
INSERT INTO command_outbox (
  id, command_id, branch_id, event_type, aggregate_type, aggregate_id,
  schema_version, aggregate_revision, payload_json, created_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
"#;

pub const COMPLETE_COMMAND: &str = r#"
UPDATE command_ledger
SET state = 'completed', response_json = ?2, resulting_revision = ?3, completed_at = ?4
WHERE command_id = ?1 AND state = 'processing'
  AND user_id = ?5 AND node_id = ?6 AND branch_id = ?7
"#;

pub const VERIFY_SESSION_IDENTITY: &str = r#"
SELECT 1 FROM authenticated_sessions
WHERE id = ?1 AND user_id = ?2 AND node_id = ?3
  AND revoked_at IS NULL AND expires_at > ?4
"#;
