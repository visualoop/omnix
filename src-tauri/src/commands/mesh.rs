//! Typed Private Mesh commands. Privileged operations are delegated to the
//! fixed-purpose, signed helper with a fixed operation switch and one UAC
//! prompt. React can supply public peer metadata, never private key material,
//! paths, service names, or process arguments.

#[cfg(windows)]
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[cfg(windows)]
use crate::mesh_contracts::{
    assess_hub_reachability, Endpoint, EndpointClass, MeshError, NatClass, PeerLifecycle,
    PortReachability, ReachabilityObservation, RevocationReason, RotationStatus,
};
use crate::mesh_contracts::{
    evaluate_enrollment, EnrollmentDecision, EnrollmentPolicy, EnrollmentRequest, KeyId, NodeId,
    UnixMillis, WireGuardKey,
};
use crate::mesh_windows::TunnelState;
#[cfg(windows)]
use crate::mesh_windows::{enrolled_device_tunnel_config, hub_tunnel_config, MeshPeer};

#[cfg(windows)]
const HELPER_FILE: &str = "omnix-mesh-service.exe";
#[cfg(windows)]
const SERVICE_NAME: &str = "WireGuardTunnel$omnix-mesh";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshPublicKey {
    pub key_id: String,
    pub public_key: String,
    pub custody_ref: String,
    pub created_at: String,
}

#[cfg(windows)]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredMeshState {
    schema_version: u16,
    state: TunnelState,
    current_key: Option<MeshPublicKey>,
    next_key: Option<MeshPublicKey>,
    last_error: Option<String>,
    updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubEndpointStatus {
    pub host: String,
    pub port: u16,
    pub published_at: String,
    pub observed_public_address: Option<String>,
    pub udp_reachability: &'static str,
    pub nat_class: &'static str,
    pub warning: Option<&'static str>,
    pub observed_at: Option<String>,
    pub observation_requirement: &'static str,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PublishHubEndpointInput {
    pub host: String,
    pub port: u16,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateMeshStatus {
    pub available: bool,
    pub installed: bool,
    pub running: bool,
    pub state: TunnelState,
    pub current_key: Option<MeshPublicKey>,
    pub next_key: Option<MeshPublicKey>,
    pub last_error: Option<String>,
    pub updated_at: Option<String>,
    pub route_scope: &'static str,
    pub requires_elevation: bool,
    pub is_hub: bool,
    pub hub_endpoint: Option<HubEndpointStatus>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MeshEnrollmentApproval {
    pub enrollment_id: String,
    pub node_id: String,
    pub key_id: String,
    pub public_key: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeshRevocationReason {
    DeviceLost,
    DeviceReplaced,
    Compromised,
    AuthorizationRemoved,
    Administrative,
}

#[tauri::command]
pub async fn private_mesh_status(app: tauri::AppHandle) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(PrivateMeshStatus {
            available: false,
            installed: false,
            running: false,
            state: TunnelState::NotInstalled,
            current_key: None,
            next_key: None,
            last_error: None,
            updated_at: None,
            route_scope: "private_omnix_subnet_only",
            requires_elevation: true,
            is_hub: false,
            hub_endpoint: None,
        })
    }
    #[cfg(windows)]
    {
        let installed = service_query()?.0;
        let running = service_query()?.1;
        let stored = read_public_state().ok();
        let state = if running {
            TunnelState::Running
        } else if !installed {
            TunnelState::NotInstalled
        } else {
            stored
                .as_ref()
                .map(|state| state.state)
                .unwrap_or(TunnelState::Installed)
        };
        let (is_hub, hub_endpoint) = load_hub_endpoint_status(&app).await?;
        Ok(PrivateMeshStatus {
            available: true,
            installed,
            running,
            state,
            current_key: stored.as_ref().and_then(|state| state.current_key.clone()),
            next_key: stored.as_ref().and_then(|state| state.next_key.clone()),
            last_error: stored.as_ref().and_then(|state| state.last_error.clone()),
            updated_at: stored.map(|state| state.updated_at),
            route_scope: "private_omnix_subnet_only",
            requires_elevation: true,
            is_hub,
            hub_endpoint,
        })
    }
}

/// Explicit optional install. The normal current-user installer never attempts
/// driver/service changes and never silently elevates.
#[tauri::command]
pub async fn install_private_mesh(app: tauri::AppHandle) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Private Mesh installation is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let helper = staged_helper(&app)?;
        run_elevated(&helper, "/install")?;
        private_mesh_status(app.clone()).await
    }
}

#[tauri::command]
pub async fn publish_private_mesh_hub_endpoint(
    app: tauri::AppHandle,
    input: PublishHubEndpointInput,
) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = input;
        Err("Private Mesh endpoint publication is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let endpoint =
            Endpoint::parse_public(&input.host, input.port).map_err(endpoint_validation_message)?;
        let status = private_mesh_status(app.clone()).await?;
        if !status.installed {
            return Err("Install Private Mesh before publishing the hub endpoint".to_owned());
        }
        let current_key = status
            .current_key
            .as_ref()
            .ok_or_else(|| "The hub's DPAPI-protected WireGuard key is unavailable".to_owned())?;
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&mesh_db_url(&app)?)
            .await
            .map_err(|_| "Could not open mesh metadata storage".to_owned())?;
        let node_id = crate::db::mesh::local_hq_node_id(&pool)
            .await
            .map_err(|_| "Could not load the local HQ node".to_owned())?
            .ok_or_else(|| {
                "Only the configured HQ hub can publish a Private Mesh endpoint".to_owned()
            })?;
        let hub = crate::db::mesh::local_hub_tunnel_metadata(&pool, &node_id)
            .await
            .map_err(|_| "Could not load the hub mesh allocation".to_owned())?
            .ok_or_else(|| {
                "Allocate the HQ hub's Private Mesh address before publishing its endpoint"
                    .to_owned()
            })?;
        let peer_rows = crate::db::mesh::active_hub_tunnel_peers(&pool, &node_id, &hub.ipv4_pool)
            .await
            .map_err(|_| "Could not load active Private Mesh peers".to_owned())?;
        let peers = peer_rows
            .into_iter()
            .map(|peer| MeshPeer {
                public_key: peer.public_key,
                allowed_ips: vec![format!("{}/{}", peer.ipv4_address, peer.prefix_length)],
                endpoint: None,
                persistent_keepalive_seconds: None,
            })
            .collect();
        let configuration = hub_tunnel_config(
            &hub.ipv4_pool,
            &format!("{}/{}", hub.ipv4_address, hub.prefix_length),
            endpoint.port,
            peers,
        )
        .map_err(|error| error.to_string())?;

        let published_at = chrono::Utc::now();
        let rotate_at =
            published_at + chrono::Duration::days(crate::mesh_windows::DEFAULT_ROTATION_DAYS);
        crate::db::mesh::register_windows_peer_key(
            &pool,
            &node_id,
            &current_key.key_id,
            &current_key.public_key,
            &current_key.custody_ref,
            &current_key.created_at,
            &rotate_at.to_rfc3339(),
        )
        .await
        .map_err(|_| "Could not register the hub's public WireGuard key".to_owned())?;

        let inbox = mesh_data_dir()?.join("desired-tunnel.inbox.json");
        std::fs::write(
            inbox,
            serde_json::to_vec_pretty(&configuration)
                .map_err(|_| "invalid hub mesh configuration".to_owned())?,
        )
        .map_err(|_| "could not stage the public hub mesh configuration".to_owned())?;
        run_installed_helper("/apply")?;

        let saved = crate::db::mesh::save_hub_endpoint(
            &pool,
            &node_id,
            &endpoint.host_text(),
            endpoint.port,
            &published_at.to_rfc3339(),
        )
        .await
        .map_err(|_| "Could not save the published hub endpoint".to_owned())?;
        pool.close().await;
        if !saved {
            return Err("The local HQ hub record is no longer active".to_owned());
        }
        private_mesh_status(app.clone()).await
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshEnrollmentRequestStatus {
    pub enrollment_id: String,
    pub node_id: String,
    pub key_id: String,
    pub public_key: String,
    pub status: &'static str,
    pub expires_at: String,
}

#[tauri::command]
pub async fn request_private_mesh_enrollment(
    app: tauri::AppHandle,
) -> Result<MeshEnrollmentRequestStatus, String> {
    let status = private_mesh_status(app.clone()).await?;
    let key = status
        .current_key
        .ok_or_else(|| "Install Private Mesh before requesting enrollment".to_owned())?;
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&mesh_db_url(&app)?)
        .await
        .map_err(|_| "Could not open mesh metadata storage".to_owned())?;
    let context = crate::db::mesh::local_enrollment_context(&pool)
        .await
        .map_err(|_| "Could not load mesh allocation metadata".to_owned())?
        .ok_or_else(|| {
            "Set up this branch and allocate its Private Mesh address at HQ first".to_owned()
        })?;
    let requested_at = chrono::Utc::now();
    let expires_at = requested_at + chrono::Duration::minutes(15);
    let contract = EnrollmentRequest {
        node_id: NodeId::parse(&context.node_id)
            .map_err(|_| "The local sync node id is invalid".to_owned())?,
        key_id: KeyId::new(key.key_id.clone())
            .map_err(|_| "The mesh key id is invalid".to_owned())?,
        public_key: WireGuardKey::new(key.public_key.clone())
            .map_err(|_| "The mesh public key is invalid".to_owned())?,
        requested_at: UnixMillis(
            u64::try_from(requested_at.timestamp_millis())
                .map_err(|_| "System clock is invalid".to_owned())?,
        ),
        expires_at: UnixMillis(
            u64::try_from(expires_at.timestamp_millis())
                .map_err(|_| "System clock is invalid".to_owned())?,
        ),
        approved_by_hq: false,
    };
    let decision = evaluate_enrollment(&lifecycle_policy(), &contract, contract.requested_at, 0)
        .map_err(|error| format!("{error:?}"))?;
    if decision != EnrollmentDecision::RejectUnapproved {
        return Err("Enrollment request did not enter the pending HQ approval state".to_owned());
    }
    let enrollment_id = uuid::Uuid::new_v4().to_string();
    let request_nonce = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let mut secret = [0_u8; 32];
    use rand::RngCore;
    rand::rngs::OsRng.fill_bytes(&mut secret);
    use sha2::Digest;
    let secret_hash = sha2::Sha256::digest(secret);
    secret.fill(0);
    crate::db::mesh::create_pending_enrollment(
        &pool,
        &crate::db::mesh::NewEnrollment {
            id: &enrollment_id,
            context: &context,
            key_id: &key.key_id,
            public_key: &key.public_key,
            request_nonce: &request_nonce,
            secret_hash: &secret_hash,
            requested_at: &requested_at.to_rfc3339(),
            expires_at: &expires_at.to_rfc3339(),
        },
    )
    .await
    .map_err(|_| "Could not create the pending mesh enrollment".to_owned())?;
    pool.close().await;
    Ok(MeshEnrollmentRequestStatus {
        enrollment_id,
        node_id: context.node_id,
        key_id: key.key_id,
        public_key: key.public_key,
        status: "pending_hq_approval",
        expires_at: expires_at.to_rfc3339(),
    })
}

#[tauri::command]
pub async fn apply_private_mesh_configuration(
    app: tauri::AppHandle,
    approval: MeshEnrollmentApproval,
) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = approval;
        Err("Private Mesh configuration is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let status = private_mesh_status(app.clone()).await?;
        let current = status
            .current_key
            .as_ref()
            .ok_or_else(|| "Install Private Mesh before enrolling this device".to_owned())?;
        if current.key_id != approval.key_id
            || current.public_key != approval.public_key
            || !status.installed
        {
            return Err(
                "The HQ approval does not match this device's protected mesh key".to_owned(),
            );
        }
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&mesh_db_url(&app)?)
            .await
            .map_err(|_| "Could not open mesh metadata storage".to_owned())?;
        let activated_at = chrono::Utc::now();
        let approved = crate::db::mesh::approved_enrollment(
            &pool,
            &approval.enrollment_id,
            &activated_at.to_rfc3339(),
        )
        .await
        .map_err(|_| "Could not verify HQ mesh approval".to_owned())?
        .ok_or_else(|| "HQ approval is missing, expired, consumed, or revoked".to_owned())?;
        if approved.enrollment_id != approval.enrollment_id
            || approved.node_id != approval.node_id
            || approved.key_id != approval.key_id
            || approved.public_key != approval.public_key
        {
            return Err("The HQ approval does not match this device allocation".to_owned());
        }
        let requested_at = chrono::DateTime::parse_from_rfc3339(&approved.requested_at)
            .map_err(|_| "HQ approval has an invalid request time".to_owned())?;
        let expires_at = chrono::DateTime::parse_from_rfc3339(&approved.expires_at)
            .map_err(|_| "HQ approval has an invalid expiry".to_owned())?;
        let request = EnrollmentRequest {
            node_id: NodeId::parse(&approved.node_id)
                .map_err(|_| "The enrollment node id is not a canonical UUID v4".to_owned())?,
            key_id: KeyId::new(approved.key_id.clone())
                .map_err(|_| "The enrollment key id is invalid".to_owned())?,
            public_key: WireGuardKey::new(approved.public_key.clone())
                .map_err(|_| "The enrollment public key is invalid".to_owned())?,
            requested_at: UnixMillis(
                u64::try_from(requested_at.timestamp_millis())
                    .map_err(|_| "HQ approval request time is invalid".to_owned())?,
            ),
            expires_at: UnixMillis(
                u64::try_from(expires_at.timestamp_millis())
                    .map_err(|_| "HQ approval expiry is invalid".to_owned())?,
            ),
            approved_by_hq: true,
        };
        let active_peers = usize::try_from(approved.active_peers)
            .map_err(|_| "HQ mesh peer count is invalid".to_owned())?;
        let decision = evaluate_enrollment(
            &lifecycle_policy(),
            &request,
            UnixMillis(current_time_millis()?),
            active_peers,
        )
        .map_err(|error| format!("{error:?}"))?;
        if decision != EnrollmentDecision::Approve {
            return Err(format!("HQ enrollment approval was rejected: {decision:?}"));
        }

        let hub = crate::db::mesh::hub_peer_metadata(&pool, &approved.ipv4_pool)
            .await
            .map_err(|_| "Could not load the HQ Private Mesh endpoint".to_owned())?
            .ok_or_else(|| {
                "HQ must enrol its Private Mesh key and publish a reachable endpoint before devices can connect"
                    .to_owned()
            })?;
        let hub_port = u16::try_from(hub.endpoint_port)
            .map_err(|_| "The published HQ UDP port is invalid".to_owned())?;
        let hub_endpoint = Endpoint::parse_public(&hub.endpoint_host, hub_port)
            .map_err(endpoint_validation_message)?;
        let device_nat_class =
            crate::db::mesh::latest_nat_class(&pool, &approved.node_id, &activated_at.to_rfc3339())
                .await
                .map_err(|_| "Could not load device reachability metadata".to_owned())?
                .as_deref()
                .map(parse_nat_class)
                .unwrap_or(NatClass::Unknown);
        let configuration = enrolled_device_tunnel_config(
            &approved.ipv4_pool,
            &format!("{}/{}", approved.ipv4_address, approved.prefix_length),
            &hub.public_key,
            &hub_endpoint,
            device_nat_class,
        )
        .map_err(|error| error.to_string())?;

        let inbox = mesh_data_dir()?.join("desired-tunnel.inbox.json");
        std::fs::write(
            inbox,
            serde_json::to_vec_pretty(&configuration)
                .map_err(|_| "invalid mesh configuration".to_owned())?,
        )
        .map_err(|_| "could not stage the public mesh configuration".to_owned())?;
        run_installed_helper("/apply")?;

        let rotate_at =
            activated_at + chrono::Duration::days(crate::mesh_windows::DEFAULT_ROTATION_DAYS);
        let consumed = crate::db::mesh::consume_approved_enrollment(
            &pool,
            &crate::db::mesh::ConsumeEnrollment {
                enrollment_id: &approval.enrollment_id,
                node_id: &approval.node_id,
                key_id: &current.key_id,
                public_key: &current.public_key,
                custody_ref: &current.custody_ref,
                consumed_at: &activated_at.to_rfc3339(),
                rotate_at: &rotate_at.to_rfc3339(),
            },
        )
        .await
        .map_err(|_| "Could not persist consumed mesh approval".to_owned())?;
        pool.close().await;
        if !consumed {
            run_installed_helper("/revoke")?;
            return Err(
                "HQ approval changed while the tunnel was starting; the tunnel was revoked"
                    .to_owned(),
            );
        }
        private_mesh_status(app.clone()).await
    }
}

#[tauri::command]
pub async fn rotate_private_mesh_key(app: tauri::AppHandle) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Private Mesh key rotation is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let status = private_mesh_status(app.clone()).await?;
        let key = status
            .current_key
            .as_ref()
            .ok_or_else(|| "No enrolled mesh key exists".to_owned())?;
        let policy = lifecycle_policy();
        let key_id = KeyId::new(key.key_id.clone())
            .map_err(|_| "Invalid current mesh key metadata".to_owned())?;
        let lifecycle = PeerLifecycle::Active {
            key_id,
            activated_at: UnixMillis(0),
            rotate_at: UnixMillis(0),
        };
        let rotation = lifecycle
            .rotation_status(&policy, UnixMillis(1))
            .map_err(|error| format!("{error:?}"))?;
        if !matches!(rotation, RotationStatus::Due | RotationStatus::Blocked) {
            return Err("The current mesh key is not eligible for rotation".to_owned());
        }
        run_installed_helper("/rotate")?;
        private_mesh_status(app.clone()).await
    }
}

#[tauri::command]
pub async fn promote_private_mesh_key(app: tauri::AppHandle) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Private Mesh key promotion is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let status = private_mesh_status(app.clone()).await?;
        let current = status
            .current_key
            .as_ref()
            .ok_or_else(|| "No current mesh key exists".to_owned())?;
        let next = status
            .next_key
            .as_ref()
            .ok_or_else(|| "No rotated mesh key is waiting".to_owned())?;
        let lifecycle = PeerLifecycle::RotationPending {
            current_key_id: KeyId::new(current.key_id.clone())
                .map_err(|_| "Invalid current key metadata".to_owned())?,
            next_key_id: KeyId::new(next.key_id.clone())
                .map_err(|_| "Invalid next key metadata".to_owned())?,
            deadline: UnixMillis(u64::MAX),
        };
        lifecycle
            .authorize_handshake(
                &lifecycle_policy(),
                &KeyId::new(next.key_id.clone())
                    .map_err(|_| "Invalid next key metadata".to_owned())?,
                UnixMillis(1),
            )
            .map_err(|error| format!("{error:?}"))?;
        run_installed_helper("/promote-next-key")?;
        private_mesh_status(app.clone()).await
    }
}

#[tauri::command]
pub async fn revoke_private_mesh(
    app: tauri::AppHandle,
    reason: MeshRevocationReason,
) -> Result<PrivateMeshStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = reason;
        Err("Private Mesh revocation is available only on Windows".to_owned())
    }
    #[cfg(windows)]
    {
        let status = private_mesh_status(app.clone()).await?;
        let key = status
            .current_key
            .as_ref()
            .ok_or_else(|| "No current mesh credential exists".to_owned())?;
        let lifecycle = PeerLifecycle::Active {
            key_id: KeyId::new(key.key_id.clone())
                .map_err(|_| "Invalid current key metadata".to_owned())?,
            activated_at: UnixMillis(0),
            rotate_at: UnixMillis(u64::MAX),
        };
        lifecycle
            .revoke(UnixMillis(current_time_millis()?), map_reason(&reason))
            .map_err(|error| format!("{error:?}"))?;
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&mesh_db_url(&app)?)
            .await
            .map_err(|_| "Could not open mesh metadata storage".to_owned())?;
        crate::db::mesh::record_windows_key_revocation(
            &pool,
            &crate::db::mesh::node_for_key(&pool, &key.key_id)
                .await
                .map_err(|_| "Could not resolve mesh node metadata".to_owned())?
                .ok_or_else(|| "No mesh node is registered for this key".to_owned())?,
            &key.key_id,
            reason_name(&reason),
            &chrono::Utc::now().to_rfc3339(),
            matches!(reason, MeshRevocationReason::Compromised),
        )
        .await
        .map_err(|_| "Could not persist terminal mesh revocation".to_owned())?;
        pool.close().await;
        run_installed_helper("/revoke")?;
        private_mesh_status(app.clone()).await
    }
}

fn lifecycle_policy() -> EnrollmentPolicy {
    EnrollmentPolicy {
        request_ttl_ms: 15 * 60 * 1_000,
        rotation_interval_ms: 90 * 24 * 60 * 60 * 1_000,
        rotation_grace_ms: 72 * 60 * 60 * 1_000,
        max_active_peers: 254 * 253,
    }
}

#[cfg(windows)]
fn map_reason(reason: &MeshRevocationReason) -> RevocationReason {
    match reason {
        MeshRevocationReason::DeviceLost => RevocationReason::DeviceLost,
        MeshRevocationReason::DeviceReplaced => RevocationReason::DeviceReplaced,
        MeshRevocationReason::Compromised => RevocationReason::Compromised,
        MeshRevocationReason::AuthorizationRemoved => RevocationReason::AuthorizationRemoved,
        MeshRevocationReason::Administrative => RevocationReason::Administrative,
    }
}

#[cfg(windows)]
fn reason_name(reason: &MeshRevocationReason) -> &'static str {
    match reason {
        MeshRevocationReason::DeviceLost => "device_lost",
        MeshRevocationReason::DeviceReplaced => "device_replaced",
        MeshRevocationReason::Compromised => "compromised",
        MeshRevocationReason::AuthorizationRemoved => "authorization_removed",
        MeshRevocationReason::Administrative => "administrative",
    }
}

fn mesh_db_url(app: &tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate app data".to_owned())?
        .join("omnix.db");
    Ok(format!("sqlite:{}", path.display()))
}

#[cfg(windows)]
fn staged_helper(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let helper = app
        .path()
        .resource_dir()
        .map_err(|_| "Could not locate bundled Private Mesh resources".to_owned())?
        .join("wireguard")
        .join(HELPER_FILE);
    helper.is_file().then_some(helper).ok_or_else(|| {
        "Private Mesh resources are absent; reinstall a signed Omnix Windows release".to_owned()
    })
}

#[cfg(windows)]
fn installed_helper() -> Result<PathBuf, String> {
    std::env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .map(|path| path.join("Omnix").join("Private Mesh").join(HELPER_FILE))
        .filter(|path| path.is_file())
        .ok_or_else(|| "Private Mesh is not installed".to_owned())
}

#[cfg(windows)]
fn mesh_data_dir() -> Result<PathBuf, String> {
    std::env::var_os("ProgramData")
        .map(PathBuf::from)
        .map(|path| path.join("Omnix").join("Private Mesh"))
        .ok_or_else(|| "ProgramData is unavailable".to_owned())
}

#[cfg(windows)]
fn read_public_state() -> Result<StoredMeshState, String> {
    let bytes = std::fs::read(mesh_data_dir()?.join("state.json"))
        .map_err(|_| "Private Mesh state is unavailable".to_owned())?;
    serde_json::from_slice(&bytes).map_err(|_| "Private Mesh state is invalid".to_owned())
}

#[cfg(windows)]
fn run_installed_helper(operation: &str) -> Result<(), String> {
    run_elevated(&installed_helper()?, operation)
}

#[cfg(windows)]
fn run_elevated(helper: &Path, operation: &str) -> Result<(), String> {
    if !matches!(
        operation,
        "/install" | "/apply" | "/rotate" | "/promote-next-key" | "/revoke" | "/uninstall"
    ) {
        return Err("unsupported elevated Private Mesh operation".to_owned());
    }
    let helper = helper.display().to_string().replace('\'', "''");
    let command = format!(
        "$p = Start-Process -FilePath '{}' -ArgumentList '{}' -Verb RunAs -Wait -PassThru; exit $p.ExitCode",
        helper, operation
    );
    let status = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &command,
        ])
        .status()
        .map_err(|_| "Could not request administrator approval".to_owned())?;
    status.success().then_some(()).ok_or_else(|| {
        "Administrator approval was cancelled or the Private Mesh operation failed".to_owned()
    })
}

#[cfg(windows)]
fn service_query() -> Result<(bool, bool), String> {
    let output = std::process::Command::new("sc.exe")
        .args(["query", SERVICE_NAME])
        .output()
        .map_err(|_| "Could not query the Private Mesh service".to_owned())?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok((
        output.status.success(),
        output.status.success() && text.contains("RUNNING"),
    ))
}

#[cfg(windows)]
async fn load_hub_endpoint_status(
    app: &tauri::AppHandle,
) -> Result<(bool, Option<HubEndpointStatus>), String> {
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&mesh_db_url(app)?)
        .await
        .map_err(|_| "Could not open mesh metadata storage".to_owned())?;
    let Some(node_id) = crate::db::mesh::local_hq_node_id(&pool)
        .await
        .map_err(|_| "Could not load the local HQ node".to_owned())?
    else {
        pool.close().await;
        return Ok((false, None));
    };
    let Some(published) = crate::db::mesh::published_hub_endpoint(&pool, &node_id)
        .await
        .map_err(|_| "Could not load the published hub endpoint".to_owned())?
    else {
        pool.close().await;
        return Ok((true, None));
    };
    let port = u16::try_from(published.port)
        .map_err(|_| "The published hub UDP port is invalid".to_owned())?;
    let endpoint =
        Endpoint::parse_public(&published.host, port).map_err(endpoint_validation_message)?;
    let observation = crate::db::mesh::latest_endpoint_observation(
        &pool,
        &published.node_id,
        &published.host,
        port,
        &chrono::Utc::now().to_rfc3339(),
    )
    .await
    .map_err(|_| "Could not load hub reachability evidence".to_owned())?;
    pool.close().await;

    let evidence = observation
        .as_ref()
        .map(|observation| ReachabilityObservation {
            observed_public_address: observation
                .observed_public_address
                .as_deref()
                .and_then(|address| address.parse().ok())
                .filter(|address| crate::mesh_contracts::is_public_ipv4(*address)),
            observed_port: u16::try_from(observation.endpoint_port).unwrap_or(0),
            nat_class: parse_nat_class(&observation.nat_class),
            endpoint_class: parse_endpoint_class(&observation.endpoint_class),
            verified: observation.verified,
        });
    let reachability = assess_hub_reachability(&endpoint, evidence.as_ref());
    Ok((
        true,
        Some(HubEndpointStatus {
            host: endpoint.host_text(),
            port: endpoint.port,
            published_at: published.published_at,
            observed_public_address: reachability
                .observed_public_address
                .map(|address| address.to_string()),
            udp_reachability: port_reachability_name(reachability.port_reachability),
            nat_class: nat_class_name(reachability.nat_class),
            warning: reachability.warning,
            observed_at: observation.map(|value| value.observed_at),
            observation_requirement: "Unknown until a trusted internet-side observer completes a WireGuard handshake against this exact host and UDP port; Omnix does not call a public IP or port-check service.",
        }),
    ))
}

#[cfg(windows)]
fn endpoint_validation_message(error: MeshError) -> String {
    match error {
        MeshError::InvalidPort => "UDP listen port must be between 1 and 65535".to_owned(),
        MeshError::NonPublicEndpoint => "Use a public IPv4 address. Private, loopback, link-local and carrier-grade NAT addresses cannot be published".to_owned(),
        MeshError::InvalidDnsName => "Enter a fully qualified DDNS hostname such as hq.example.co.ke, or a public IPv4 address".to_owned(),
        _ => "The hub endpoint is invalid".to_owned(),
    }
}

#[cfg(windows)]
fn parse_endpoint_class(value: &str) -> EndpointClass {
    match value {
        "direct_lan" => EndpointClass::DirectLan,
        "direct_public" => EndpointClass::DirectPublic,
        "nat_traversal" => EndpointClass::NatTraversal,
        "relay_required" => EndpointClass::RelayRequired,
        _ => EndpointClass::Unreachable,
    }
}

#[cfg(windows)]
fn parse_nat_class(value: &str) -> NatClass {
    match value {
        "open_internet" => NatClass::OpenInternet,
        "full_cone" => NatClass::FullCone,
        "address_restricted" => NatClass::AddressRestricted,
        "port_restricted" => NatClass::PortRestricted,
        "symmetric" => NatClass::Symmetric,
        "carrier_grade" => NatClass::CarrierGrade,
        _ => NatClass::Unknown,
    }
}

#[cfg(windows)]
fn port_reachability_name(value: PortReachability) -> &'static str {
    match value {
        PortReachability::Reachable => "reachable",
        PortReachability::Unreachable => "unreachable",
        PortReachability::Unknown => "unknown",
    }
}

#[cfg(windows)]
fn nat_class_name(value: NatClass) -> &'static str {
    match value {
        NatClass::OpenInternet => "open_internet",
        NatClass::FullCone => "full_cone",
        NatClass::AddressRestricted => "address_restricted",
        NatClass::PortRestricted => "port_restricted",
        NatClass::Symmetric => "symmetric",
        NatClass::CarrierGrade => "carrier_grade",
        NatClass::Unknown => "unknown",
    }
}

fn current_time_millis() -> Result<u64, String> {
    u64::try_from(chrono::Utc::now().timestamp_millis())
        .map_err(|_| "System clock is invalid".to_owned())
}
