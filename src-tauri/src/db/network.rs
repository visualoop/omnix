use sha2::{Digest, Sha256};
use sqlx::{Sqlite, SqlitePool, Transaction};

#[derive(Debug, thiserror::Error)]
pub enum NetworkDbError {
    #[error("network storage unavailable")]
    Storage(#[from] sqlx::Error),
    #[error("pairing code is invalid or expired")]
    InvalidPairingCode,
}

const CLAIM_PAIRING_CODE: &str = r#"
UPDATE pairing_codes SET used_at = datetime('now'), issued_token = ?2
WHERE code = ?1 AND used_at IS NULL AND datetime(expires_at) > datetime('now')
"#;
const INSERT_API_TOKEN: &str = r#"
INSERT INTO api_tokens (
 token, token_hash, token_scope, legacy_enabled, device_name, device_fingerprint, last_seen_at
) VALUES (?1, ?2, 'legacy_trusted_lan', ?3, ?4, ?5, datetime('now'))
"#;
const UPSERT_DEVICE: &str = r#"
INSERT INTO devices(id, fingerprint, name, role, approved, last_seen)
VALUES (?1, ?2, ?3, 'client', 1, datetime('now'))
ON CONFLICT(fingerprint) DO UPDATE SET name = excluded.name, approved = 1, last_seen = excluded.last_seen
"#;
const LOAD_DEVICE_ID: &str = "SELECT id FROM devices WHERE fingerprint = ?1 AND approved = 1";
const LEGACY_FLAG: &str = "SELECT value FROM settings WHERE key = 'network.legacy_trusted_lan'";
const LOAD_UNHASHED_TOKENS: &str = "SELECT token FROM api_tokens WHERE token_hash IS NULL";
const STORE_TOKEN_HASH: &str =
    "UPDATE api_tokens SET token_hash = ?2 WHERE token = ?1 AND token_hash IS NULL";
const VERIFY_LEGACY_TOKEN: &str = r#"
SELECT 1 FROM api_tokens
WHERE token_hash = ?1 AND token_scope = 'legacy_trusted_lan'
  AND legacy_enabled = 1 AND revoked = 0
"#;
const TOUCH_LEGACY_TOKEN: &str = r#"
UPDATE api_tokens SET last_seen_at = datetime('now')
WHERE token_hash = ?1 AND token_scope = 'legacy_trusted_lan'
"#;
const INSERT_LEGACY_AUDIT: &str = r#"
INSERT INTO audit_log (
 id, permission_key, action, outcome, risk_level, entity_type, metadata, created_at
) VALUES (?1, 'legacy.sql', ?2, 'allowed', 'critical', 'legacy_lan_request', ?3, ?4)
"#;

pub fn token_hash(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

pub async fn prepare_legacy_token_hashes(pool: &SqlitePool) -> Result<(), NetworkDbError> {
    let tokens: Vec<String> = sqlx::query_scalar(LOAD_UNHASHED_TOKENS)
        .fetch_all(pool)
        .await?;
    for token in tokens {
        sqlx::query(STORE_TOKEN_HASH)
            .bind(&token)
            .bind(token_hash(&token))
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn legacy_enabled(pool: &SqlitePool) -> Result<bool, NetworkDbError> {
    let value: Option<String> = sqlx::query_scalar(LEGACY_FLAG).fetch_optional(pool).await?;
    Ok(value.as_deref() == Some("1"))
}

pub async fn claim_pairing_and_issue(
    pool: &SqlitePool,
    code: &str,
    clear_token: &str,
    device_name: &str,
    fingerprint: &str,
    proposed_node_id: &str,
) -> Result<String, NetworkDbError> {
    let mut tx = pool.begin().await?;
    let legacy = legacy_enabled_in_tx(&mut tx).await?;
    sqlx::query(INSERT_API_TOKEN)
        .bind(clear_token)
        .bind(token_hash(clear_token))
        .bind(i64::from(legacy))
        .bind(device_name)
        .bind(fingerprint)
        .execute(&mut *tx)
        .await?;
    sqlx::query(UPSERT_DEVICE)
        .bind(proposed_node_id)
        .bind(fingerprint)
        .bind(device_name)
        .execute(&mut *tx)
        .await?;
    let claimed = sqlx::query(CLAIM_PAIRING_CODE)
        .bind(code)
        .bind(clear_token)
        .execute(&mut *tx)
        .await?;
    if claimed.rows_affected() != 1 {
        return Err(NetworkDbError::InvalidPairingCode);
    }
    let node_id: String = sqlx::query_scalar(LOAD_DEVICE_ID)
        .bind(fingerprint)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(node_id)
}

async fn legacy_enabled_in_tx(tx: &mut Transaction<'_, Sqlite>) -> Result<bool, sqlx::Error> {
    let value: Option<String> = sqlx::query_scalar(LEGACY_FLAG)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(value.as_deref() == Some("1"))
}

pub async fn authenticate_legacy_token(
    pool: &SqlitePool,
    clear_token: &str,
) -> Result<bool, NetworkDbError> {
    if !legacy_enabled(pool).await? {
        return Ok(false);
    }
    let hash = token_hash(clear_token);
    let valid: Option<i64> = sqlx::query_scalar(VERIFY_LEGACY_TOKEN)
        .bind(&hash)
        .fetch_optional(pool)
        .await?;
    if valid.is_some() {
        sqlx::query(TOUCH_LEGACY_TOKEN)
            .bind(hash)
            .execute(pool)
            .await?;
    }
    Ok(valid.is_some())
}

pub async fn audit_legacy_use(
    pool: &SqlitePool,
    action: &str,
    source: &str,
    now: &str,
) -> Result<(), NetworkDbError> {
    let metadata = serde_json::json!({"source": source, "compatibilityMode": true}).to_string();
    sqlx::query(INSERT_LEGACY_AUDIT)
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(action)
        .bind(metadata)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}
