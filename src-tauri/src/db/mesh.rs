//! Private Mesh public metadata persistence. Secret key bytes and plaintext
//! enrollment material are intentionally absent from every query boundary.

use sqlx::SqlitePool;

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct PublishedHubEndpoint {
    pub node_id: String,
    pub host: String,
    pub port: i64,
    pub published_at: String,
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct LatestEndpointObservation {
    pub endpoint_host: String,
    pub endpoint_port: i64,
    pub observed_public_address: Option<String>,
    pub endpoint_class: String,
    pub nat_class: String,
    pub observed_at: String,
    pub expires_at: String,
    pub verified: bool,
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct HubPeerMetadata {
    pub public_key: String,
    pub endpoint_host: String,
    pub endpoint_port: i64,
}

pub async fn local_hq_node_id(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT n.id
         FROM sync_branch_routes r
         JOIN sync_nodes n ON n.id = r.local_node_id
         WHERE r.enabled = 1 AND n.role = 'hq' AND n.key_status <> 'revoked'
           AND n.deleted_at IS NULL
         ORDER BY r.updated_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
}

pub async fn save_hub_endpoint(
    pool: &SqlitePool,
    node_id: &str,
    host: &str,
    port: u16,
    published_at: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE sync_nodes
         SET mesh_endpoint_host = ?1, mesh_endpoint_port = ?2,
             mesh_endpoint_published_at = ?3
         WHERE id = ?4 AND role = 'hq' AND deleted_at IS NULL",
    )
    .bind(host)
    .bind(i64::from(port))
    .bind(published_at)
    .bind(node_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn published_hub_endpoint(
    pool: &SqlitePool,
    node_id: &str,
) -> Result<Option<PublishedHubEndpoint>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id AS node_id, mesh_endpoint_host AS host,
                mesh_endpoint_port AS port,
                mesh_endpoint_published_at AS published_at
         FROM sync_nodes
         WHERE id = ?1 AND role = 'hq' AND deleted_at IS NULL
           AND mesh_endpoint_host IS NOT NULL
           AND mesh_endpoint_port IS NOT NULL
           AND mesh_endpoint_published_at IS NOT NULL",
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
}

pub async fn latest_endpoint_observation(
    pool: &SqlitePool,
    node_id: &str,
    endpoint_host: &str,
    endpoint_port: u16,
    now: &str,
) -> Result<Option<LatestEndpointObservation>, sqlx::Error> {
    sqlx::query_as(
        "SELECT endpoint_host, endpoint_port, observed_public_address,
                endpoint_class, nat_class, observed_at, expires_at, verified
         FROM mesh_endpoint_observations
         WHERE node_id = ?1 AND endpoint_host = ?2 AND endpoint_port = ?3
           AND expires_at > ?4
         ORDER BY verified DESC, observed_at DESC LIMIT 1",
    )
    .bind(node_id)
    .bind(endpoint_host)
    .bind(i64::from(endpoint_port))
    .bind(now)
    .fetch_optional(pool)
    .await
}

pub async fn hub_peer_metadata(
    pool: &SqlitePool,
    mesh_pool: &str,
) -> Result<Option<HubPeerMetadata>, sqlx::Error> {
    sqlx::query_as(
        "SELECT k.public_key, n.mesh_endpoint_host AS endpoint_host,
                n.mesh_endpoint_port AS endpoint_port
         FROM mesh_sites s
         JOIN mesh_allocations a ON a.site_id = s.id AND a.state = 'active'
         JOIN sync_nodes n ON n.id = a.node_id AND n.role = 'hq'
                          AND n.key_status <> 'revoked' AND n.deleted_at IS NULL
         JOIN mesh_peer_keys k ON k.node_id = n.id AND k.status = 'current'
         WHERE s.role = 'hq' AND s.ipv4_pool = ?1 AND s.state = 'active'
           AND s.deleted_at IS NULL AND n.mesh_endpoint_host IS NOT NULL
           AND n.mesh_endpoint_port IS NOT NULL
         ORDER BY a.host_number LIMIT 1",
    )
    .bind(mesh_pool)
    .fetch_optional(pool)
    .await
}

pub async fn latest_nat_class(
    pool: &SqlitePool,
    node_id: &str,
    now: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT nat_class FROM mesh_endpoint_observations
         WHERE node_id = ?1 AND expires_at > ?2
         ORDER BY verified DESC, observed_at DESC LIMIT 1",
    )
    .bind(node_id)
    .bind(now)
    .fetch_optional(pool)
    .await
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct LocalHubTunnelMetadata {
    pub ipv4_pool: String,
    pub ipv4_address: String,
    pub prefix_length: i64,
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct HubTunnelPeer {
    pub public_key: String,
    pub ipv4_address: String,
    pub prefix_length: i64,
}

pub async fn local_hub_tunnel_metadata(
    pool: &SqlitePool,
    node_id: &str,
) -> Result<Option<LocalHubTunnelMetadata>, sqlx::Error> {
    sqlx::query_as(
        "SELECT s.ipv4_pool, a.ipv4_address, a.prefix_length
         FROM mesh_sites s
         JOIN mesh_allocations a ON a.site_id = s.id AND a.node_id = ?1
                                AND a.state = 'active'
         WHERE s.role = 'hq' AND s.state = 'active' AND s.deleted_at IS NULL
         LIMIT 1",
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await
}

pub async fn active_hub_tunnel_peers(
    pool: &SqlitePool,
    hub_node_id: &str,
    mesh_pool: &str,
) -> Result<Vec<HubTunnelPeer>, sqlx::Error> {
    sqlx::query_as(
        "SELECT k.public_key, a.ipv4_address, a.prefix_length
         FROM mesh_sites s
         JOIN mesh_allocations a ON a.site_id = s.id AND a.state = 'active'
         JOIN mesh_peer_keys k ON k.node_id = a.node_id AND k.status = 'current'
         JOIN sync_nodes n ON n.id = a.node_id AND n.key_status <> 'revoked'
                          AND n.deleted_at IS NULL
         WHERE s.ipv4_pool = ?1 AND s.state = 'active' AND s.deleted_at IS NULL
           AND a.node_id <> ?2
         ORDER BY s.site_number, a.host_number",
    )
    .bind(mesh_pool)
    .bind(hub_node_id)
    .fetch_all(pool)
    .await
}

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

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct AndroidEnrollmentMetadata {
    pub enrollment_id: String,
    pub enrollment_status: String,
    pub node_id: String,
    pub hub_name: String,
    pub key_id: String,
    pub device_public_key: String,
    pub interface_address: String,
    pub prefix_length: i64,
    pub mesh_subnet: String,
    pub hub_public_key: String,
    pub endpoint_host: String,
    pub endpoint_port: i64,
    pub hub_address: String,
}

/// Reads the latest approved Android allocation plus the endpoint published by
/// the authoritative HQ node. Device tunnel generation remains owned by the
/// shared Private Mesh configuration builder.
pub async fn android_enrollment_metadata(
    pool: &SqlitePool,
    node_id: &str,
    branch_id: &str,
    now: &str,
) -> Result<Option<AndroidEnrollmentMetadata>, sqlx::Error> {
    let schema_ready: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mesh_enrollments'",
    )
    .fetch_optional(pool)
    .await?;
    if schema_ready.is_none() {
        return Ok(None);
    }
    sqlx::query_as(
        "SELECT e.id AS enrollment_id, e.status AS enrollment_status,
                e.node_id, b.name AS hub_name,
                e.wireguard_key_id AS key_id,
                e.wireguard_public_key AS device_public_key,
                client.ipv4_address AS interface_address,
                client.prefix_length,
                site.ipv4_pool AS mesh_subnet,
                hub_key.public_key AS hub_public_key,
                hub_node.mesh_endpoint_host AS endpoint_host,
                hub_node.mesh_endpoint_port AS endpoint_port,
                hub.ipv4_address AS hub_address
         FROM mesh_enrollments e
         JOIN sync_nodes device ON device.id = e.node_id
                               AND device.role = 'android'
                               AND device.branch_id = ?2
                               AND device.key_status <> 'revoked'
                               AND device.deleted_at IS NULL
         JOIN mesh_allocations client ON client.id = e.requested_allocation_id
                                     AND client.node_id = e.node_id
                                     AND client.state = 'active'
         JOIN mesh_sites site ON site.id = client.site_id
                             AND site.branch_id = ?2
                             AND site.state = 'active'
                             AND site.deleted_at IS NULL
         JOIN branches b ON b.id = ?2 AND b.active = 1
         JOIN sync_branch_routes route ON route.branch_id = ?2 AND route.enabled = 1
         JOIN sync_nodes hub_node ON hub_node.id = route.local_node_id
                                  AND hub_node.role = 'hq'
                                  AND hub_node.key_status <> 'revoked'
                                  AND hub_node.deleted_at IS NULL
                                  AND hub_node.mesh_endpoint_host IS NOT NULL
                                  AND hub_node.mesh_endpoint_port IS NOT NULL
         JOIN mesh_allocations hub ON hub.node_id = hub_node.id
                                  AND hub.site_id = site.id
                                  AND hub.state = 'active'
         JOIN mesh_peer_keys hub_key ON hub_key.node_id = hub_node.id
                                    AND hub_key.status = 'current'
         WHERE e.node_id = ?1
           AND (e.status = 'consumed'
                OR (e.status = 'approved' AND e.expires_at > ?3))
         ORDER BY CASE e.status WHEN 'consumed' THEN 0 ELSE 1 END,
                  e.approved_at DESC
         LIMIT 1",
    )
    .bind(node_id)
    .bind(branch_id)
    .bind(now)
    .fetch_optional(pool)
    .await
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

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    use super::{published_hub_endpoint, save_hub_endpoint};

    #[tokio::test]
    async fn published_endpoint_round_trips_on_the_hq_node_record() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(
            "CREATE TABLE sync_nodes (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                deleted_at TEXT,
                mesh_endpoint_host TEXT,
                mesh_endpoint_port INTEGER,
                mesh_endpoint_published_at TEXT
             );
             INSERT INTO sync_nodes (id, role) VALUES ('hq-node', 'hq');",
        )
        .execute(&pool)
        .await
        .unwrap();

        assert!(save_hub_endpoint(
            &pool,
            "hq-node",
            "hq-west.ddns.example.co.ke",
            51_820,
            "2026-08-02T09:30:00Z",
        )
        .await
        .unwrap());
        let endpoint = published_hub_endpoint(&pool, "hq-node")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(endpoint.node_id, "hq-node");
        assert_eq!(endpoint.host, "hq-west.ddns.example.co.ke");
        assert_eq!(endpoint.port, 51_820);
        assert_eq!(endpoint.published_at, "2026-08-02T09:30:00Z");
    }
}
