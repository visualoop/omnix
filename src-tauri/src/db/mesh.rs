//! Private Mesh public metadata persistence. Secret key bytes and plaintext
//! enrollment material are intentionally absent from every query boundary.

use sqlx::SqlitePool;

pub async fn register_windows_peer_key(
    pool: &SqlitePool,
    node_id: &str,
    key_id: &str,
    public_key: &str,
    custody_ref: &str,
    created_at: &str,
    rotate_at: &str,
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "UPDATE mesh_peer_keys
         SET status = 'retired', retired_at = ?1
         WHERE node_id = ?2 AND status = 'current' AND key_id <> ?3",
    )
    .bind(created_at)
    .bind(node_id)
    .bind(key_id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "INSERT INTO mesh_peer_keys
            (key_id, node_id, public_key, key_custody, key_custody_ref,
             status, activated_at, rotate_at, retired_at, created_at)
         VALUES (?1, ?2, ?3, 'windows_dpapi_machine', ?4,
                 'current', ?5, ?6, NULL, ?5)
         ON CONFLICT(key_id) DO UPDATE SET
             public_key = excluded.public_key,
             key_custody_ref = excluded.key_custody_ref,
             status = 'current',
             activated_at = COALESCE(mesh_peer_keys.activated_at, excluded.activated_at),
             rotate_at = excluded.rotate_at,
             retired_at = NULL",
    )
    .bind(key_id)
    .bind(node_id)
    .bind(public_key)
    .bind(custody_ref)
    .bind(created_at)
    .bind(rotate_at)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await
}

#[cfg(windows)]
pub async fn node_for_key(pool: &SqlitePool, key_id: &str) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT node_id FROM mesh_peer_keys WHERE key_id = ?1")
        .bind(key_id)
        .fetch_optional(pool)
        .await
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct LocalEnrollmentContext {
    pub node_id: String,
    pub requested_site_id: String,
    pub requested_allocation_id: String,
    pub signing_key_id: String,
}

pub async fn local_enrollment_context(
    pool: &SqlitePool,
) -> Result<Option<LocalEnrollmentContext>, sqlx::Error> {
    sqlx::query_as(
        "SELECT r.local_node_id AS node_id,
                s.id AS requested_site_id,
                a.id AS requested_allocation_id,
                n.signing_key_id
         FROM sync_branch_routes r
         JOIN sync_nodes n ON n.id = r.local_node_id
         JOIN mesh_sites s ON s.branch_id = r.branch_id AND s.state = 'active' AND s.deleted_at IS NULL
         JOIN mesh_allocations a ON a.site_id = s.id AND a.node_id = r.local_node_id AND a.state IN ('reserved','active')
         WHERE r.enabled = 1
         ORDER BY s.site_number LIMIT 1",
    )
    .fetch_optional(pool)
    .await
}

pub struct NewEnrollment<'a> {
    pub id: &'a str,
    pub context: &'a LocalEnrollmentContext,
    pub key_id: &'a str,
    pub public_key: &'a str,
    pub request_nonce: &'a str,
    pub secret_hash: &'a [u8],
    pub requested_at: &'a str,
    pub expires_at: &'a str,
}

pub async fn create_pending_enrollment(
    pool: &SqlitePool,
    enrollment: &NewEnrollment<'_>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO mesh_enrollments
            (id, node_id, requested_site_id, requested_allocation_id,
             wireguard_key_id, wireguard_public_key, signing_key_id,
             request_nonce, enrollment_secret_hash, status, requested_at, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, ?11)",
    )
    .bind(enrollment.id)
    .bind(&enrollment.context.node_id)
    .bind(&enrollment.context.requested_site_id)
    .bind(&enrollment.context.requested_allocation_id)
    .bind(enrollment.key_id)
    .bind(enrollment.public_key)
    .bind(&enrollment.context.signing_key_id)
    .bind(enrollment.request_nonce)
    .bind(enrollment.secret_hash)
    .bind(enrollment.requested_at)
    .bind(enrollment.expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct ApprovedEnrollment {
    pub enrollment_id: String,
    pub node_id: String,
    pub key_id: String,
    pub public_key: String,
    pub requested_at: String,
    pub expires_at: String,
    pub ipv4_address: String,
    pub prefix_length: i64,
    pub ipv4_pool: String,
    pub active_peers: i64,
}

pub async fn approved_enrollment(
    pool: &SqlitePool,
    enrollment_id: &str,
    now: &str,
) -> Result<Option<ApprovedEnrollment>, sqlx::Error> {
    sqlx::query_as(
        "SELECT e.id AS enrollment_id, e.node_id, e.wireguard_key_id AS key_id,
                e.wireguard_public_key AS public_key, e.requested_at, e.expires_at,
                a.ipv4_address, a.prefix_length, s.ipv4_pool,
                (SELECT COUNT(*) FROM mesh_peer_keys k
                 WHERE k.status IN ('current', 'next')) AS active_peers
         FROM mesh_enrollments e
         JOIN mesh_allocations a ON a.id = e.requested_allocation_id
                              AND a.node_id = e.node_id
                              AND a.state IN ('reserved', 'active')
         JOIN mesh_sites s ON s.id = e.requested_site_id
                          AND s.id = a.site_id
                          AND s.state = 'active'
                          AND s.deleted_at IS NULL
         WHERE e.id = ?1 AND e.status = 'approved'
           AND e.approved_at IS NOT NULL AND e.expires_at > ?2",
    )
    .bind(enrollment_id)
    .bind(now)
    .fetch_optional(pool)
    .await
}

pub struct ConsumeEnrollment<'a> {
    pub enrollment_id: &'a str,
    pub node_id: &'a str,
    pub key_id: &'a str,
    pub public_key: &'a str,
    pub custody_ref: &'a str,
    pub consumed_at: &'a str,
    pub rotate_at: &'a str,
}

pub async fn consume_approved_enrollment(
    pool: &SqlitePool,
    enrollment: &ConsumeEnrollment<'_>,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let consumed = sqlx::query(
        "UPDATE mesh_enrollments
         SET status = 'consumed', consumed_at = ?1
         WHERE id = ?2 AND node_id = ?3 AND wireguard_key_id = ?4
           AND wireguard_public_key = ?5 AND status = 'approved'
           AND approved_at IS NOT NULL AND expires_at > ?1",
    )
    .bind(enrollment.consumed_at)
    .bind(enrollment.enrollment_id)
    .bind(enrollment.node_id)
    .bind(enrollment.key_id)
    .bind(enrollment.public_key)
    .execute(&mut *transaction)
    .await?;
    if consumed.rows_affected() != 1 {
        transaction.rollback().await?;
        return Ok(false);
    }
    sqlx::query(
        "UPDATE mesh_peer_keys
         SET status = 'retired', retired_at = ?1
         WHERE node_id = ?2 AND status = 'current' AND key_id <> ?3",
    )
    .bind(enrollment.consumed_at)
    .bind(enrollment.node_id)
    .bind(enrollment.key_id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "INSERT INTO mesh_peer_keys
            (key_id, node_id, public_key, key_custody, key_custody_ref,
             status, activated_at, rotate_at, retired_at, created_at)
         VALUES (?1, ?2, ?3, 'windows_dpapi_machine', ?4,
                 'current', ?5, ?6, NULL, ?5)",
    )
    .bind(enrollment.key_id)
    .bind(enrollment.node_id)
    .bind(enrollment.public_key)
    .bind(enrollment.custody_ref)
    .bind(enrollment.consumed_at)
    .bind(enrollment.rotate_at)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(true)
}

#[cfg(windows)]
pub async fn record_windows_key_revocation(
    pool: &SqlitePool,
    node_id: &str,
    key_id: &str,
    reason: &str,
    revoked_at: &str,
    compromised: bool,
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let control_event_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO mesh_revocations
            (id, node_id, key_id, reason, revoked_by_user_id, control_event_id, revoked_at)
         VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(node_id)
    .bind(key_id)
    .bind(reason)
    .bind(control_event_id)
    .bind(revoked_at)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("UPDATE mesh_peer_keys SET status = 'revoked', retired_at = ?1 WHERE key_id = ?2")
        .bind(revoked_at)
        .bind(key_id)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        "UPDATE mesh_enrollments SET status = 'revoked' WHERE node_id = ?1 AND status <> 'revoked'",
    )
    .bind(node_id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("UPDATE sync_nodes SET key_status = 'revoked', revoked_at = ?1 WHERE id = ?2")
        .bind(revoked_at)
        .bind(node_id)
        .execute(&mut *transaction)
        .await?;
    if compromised {
        sqlx::query(
            "UPDATE sync_epochs SET branch_epoch = branch_epoch + 1, updated_at = ?1
             WHERE branch_id IN (SELECT branch_id FROM sync_nodes WHERE id = ?2)",
        )
        .bind(revoked_at)
        .bind(node_id)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await
}
