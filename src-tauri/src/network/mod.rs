// LAN HTTP server for master device.
//
// Exposes:
//   GET  /api/health          → { ok: true, version, business_name }
//   POST /api/auth/pair       → exchange pairing_code for bearer token
//   POST /api/db/query        → legacy paired-till SELECT compatibility (explicit opt-in)
//   POST /api/db/execute      → legacy paired-till mutation compatibility (explicit opt-in)
//
// Production clients use authenticated /api/v1/commands/* and bounded /api/v1/reads/* routes.
// Legacy routes require the documented trusted-LAN flag and hashed legacy token scope.

pub mod read_only_policy;
pub mod read_only_web;
mod typed;

use axum::extract::Request;
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, State},
    http::{header, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

const SERVICE_TYPE: &str = "_omnix._tcp.local.";

#[derive(Clone)]
pub struct ServerState {
    pub pool: SqlitePool,
    pub business_name: Arc<RwLock<String>>,
    pub sync: Option<Arc<crate::sync_activation::SyncCoordinator>>,
}

#[derive(Debug, Deserialize)]
pub struct PairRequest {
    pub code: String,
    pub device_name: String,
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PairResponse {
    pub token: String,
    pub node_id: String,
    pub business_name: String,
}

#[derive(Debug, Deserialize)]
pub struct DbQuery {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct DbResult {
    pub rows: Vec<HashMap<String, JsonValue>>,
}

#[derive(Debug, Serialize)]
pub struct ExecResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

pub fn build_router(state: ServerState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route(
            "/api/auth/pair",
            post(pair_device).layer(DefaultBodyLimit::max(4 * 1024)),
        )
        .merge(typed::desktop_and_android_router())
        .merge(typed::browser_read_router())
        .route(
            crate::sync_activation::SYNC_HTTP_PATH,
            post(receive_sync_event).layer(DefaultBodyLimit::max(
                crate::sync_contracts::MAX_PAYLOAD_BYTES as usize + 64 * 1024,
            )),
        )
        .route(
            "/api/db/query",
            post(db_query)
                .layer(DefaultBodyLimit::max(64 * 1024))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    legacy_trusted_lan_guard,
                )),
        )
        .route(
            "/api/db/execute",
            post(db_execute)
                .layer(DefaultBodyLimit::max(256 * 1024))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    legacy_trusted_lan_guard,
                )),
        )
        .with_state(state)
}

#[derive(Debug, Serialize)]
struct SyncApiError {
    code: &'static str,
}

impl IntoResponse for SyncApiError {
    fn into_response(self) -> Response {
        let status = match self.code {
            "sync_not_configured" => StatusCode::SERVICE_UNAVAILABLE,
            "epoch_fenced" => StatusCode::CONFLICT,
            "invalid_envelope" | "signature_invalid" => StatusCode::UNPROCESSABLE_ENTITY,
            "authorization_denied" => StatusCode::FORBIDDEN,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(self)).into_response()
    }
}

async fn receive_sync_event(
    State(state): State<ServerState>,
    Json(envelope): Json<crate::sync_activation::WireEnvelope>,
) -> Result<Json<crate::sync_activation::WireReceipt>, SyncApiError> {
    let coordinator = state.sync.as_ref().ok_or(SyncApiError {
        code: "sync_not_configured",
    })?;
    coordinator
        .receive(&envelope)
        .await
        .map(Json)
        .map_err(|error| {
            use crate::sync_activation::SyncActivationError;
            let code = match error {
                SyncActivationError::EpochFenced => "epoch_fenced",
                SyncActivationError::AuthorizationDenied | SyncActivationError::KeyInactive => {
                    "authorization_denied"
                }
                SyncActivationError::SignatureInvalid => "signature_invalid",
                SyncActivationError::InvalidEnvelope(_) | SyncActivationError::Json(_) => {
                    "invalid_envelope"
                }
                _ => "sync_apply_failed",
            };
            SyncApiError { code }
        })
}

async fn health(State(state): State<ServerState>) -> Json<JsonValue> {
    Json(serde_json::json!({
        "ok": true,
        "service": "omnix",
        "version": env!("CARGO_PKG_VERSION"),
        "business": *state.business_name.read(),
    }))
}

async fn pair_device(
    State(state): State<ServerState>,
    Json(req): Json<PairRequest>,
) -> Result<Json<PairResponse>, ApiError> {
    if req.code.len() != 6
        || !req.code.bytes().all(|byte| byte.is_ascii_digit())
        || req.device_name.trim().is_empty()
        || req.device_name.len() > 120
        || req
            .device_fingerprint
            .as_deref()
            .is_some_and(|value| value.is_empty() || value.len() > 256)
    {
        return Err(ApiError {
            error: "Invalid pairing request".to_string(),
        });
    }
    let token = random_token();
    let proposed_node_id = uuid::Uuid::new_v4().to_string();
    let fingerprint = req
        .device_fingerprint
        .unwrap_or_else(|| format!("paired-{proposed_node_id}"));
    let node_id = crate::db::network::claim_pairing_and_issue(
        &state.pool,
        &req.code,
        &token,
        req.device_name.trim(),
        &fingerprint,
        &proposed_node_id,
    )
    .await
    .map_err(|error| ApiError {
        error: match error {
            crate::db::network::NetworkDbError::InvalidPairingCode => {
                "Invalid or expired pairing code".to_string()
            }
            crate::db::network::NetworkDbError::Storage(_) => {
                "Pairing is temporarily unavailable".to_string()
            }
        },
    })?;

    Ok(Json(PairResponse {
        token,
        node_id,
        business_name: state.business_name.read().clone(),
    }))
}

static LEGACY_RATE_LIMIT: once_cell::sync::Lazy<
    parking_lot::Mutex<HashMap<std::net::IpAddr, (std::time::Instant, u32)>>,
> = once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(HashMap::new()));

fn is_private_source(address: SocketAddr) -> bool {
    match address.ip() {
        std::net::IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local(),
        std::net::IpAddr::V6(ip) => {
            ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local()
        }
    }
}

fn within_legacy_rate_limit(address: SocketAddr) -> bool {
    const WINDOW: std::time::Duration = std::time::Duration::from_secs(60);
    const MAX_REQUESTS: u32 = 120;
    let now = std::time::Instant::now();
    let mut rates = LEGACY_RATE_LIMIT.lock();
    let entry = rates.entry(address.ip()).or_insert((now, 0));
    if now.duration_since(entry.0) >= WINDOW {
        *entry = (now, 0);
    }
    if entry.1 >= MAX_REQUESTS {
        return false;
    }
    entry.1 += 1;
    true
}

async fn legacy_trusted_lan_guard(
    State(state): State<ServerState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Browser traffic never reaches the arbitrary-SQL compatibility surface.
    if request.headers().contains_key(header::ORIGIN)
        || request.headers().contains_key("sec-fetch-site")
        || request.headers().contains_key("sec-fetch-mode")
        || request.headers().contains_key("sec-fetch-dest")
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let address = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|connect| connect.0)
        .ok_or(StatusCode::FORBIDDEN)?;
    if !is_private_source(address) || !within_legacy_rate_limit(address) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let valid = crate::db::network::authenticate_legacy_token(&state.pool, token)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !valid {
        return Err(StatusCode::FORBIDDEN);
    }
    let action = if request.uri().path().ends_with("/query") {
        "legacy.db.query"
    } else {
        "legacy.db.execute"
    };
    crate::db::network::audit_legacy_use(
        &state.pool,
        action,
        &address.ip().to_string(),
        &chrono::Utc::now().to_rfc3339(),
    )
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    tokio::time::timeout(std::time::Duration::from_secs(5), next.run(request))
        .await
        .map_err(|_| StatusCode::REQUEST_TIMEOUT)
}

async fn db_query(
    State(state): State<ServerState>,
    Json(q): Json<DbQuery>,
) -> Result<Json<DbResult>, ApiError> {
    use sqlx::Column;
    use sqlx::Row;

    let mut sqlx_q = sqlx::query(&q.sql);
    for param in &q.params {
        sqlx_q = bind_json(sqlx_q, param);
    }

    let rows = sqlx_q.fetch_all(&state.pool).await.map_err(|_| ApiError {
        error: "Legacy query failed".to_string(),
    })?;

    let mut result = Vec::with_capacity(rows.len());
    for row in rows {
        let mut obj = HashMap::new();
        for (i, col) in row.columns().iter().enumerate() {
            let val: JsonValue = if let Ok(s) = row.try_get::<String, _>(i) {
                JsonValue::String(s)
            } else if let Ok(n) = row.try_get::<i64, _>(i) {
                JsonValue::Number(n.into())
            } else if let Ok(f) = row.try_get::<f64, _>(i) {
                serde_json::Number::from_f64(f)
                    .map(JsonValue::Number)
                    .unwrap_or(JsonValue::Null)
            } else {
                JsonValue::Null
            };
            obj.insert(col.name().to_string(), val);
        }
        result.push(obj);
    }

    Ok(Json(DbResult { rows: result }))
}

async fn db_execute(
    State(state): State<ServerState>,
    Json(q): Json<DbQuery>,
) -> Result<Json<ExecResult>, ApiError> {
    let mut sqlx_q = sqlx::query(&q.sql);
    for param in &q.params {
        sqlx_q = bind_json(sqlx_q, param);
    }

    let res = sqlx_q.execute(&state.pool).await.map_err(|_| ApiError {
        error: "Legacy execution failed".to_string(),
    })?;

    Ok(Json(ExecResult {
        rows_affected: res.rows_affected(),
        last_insert_id: res.last_insert_rowid(),
    }))
}

fn bind_json<'q>(
    q: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    val: &'q JsonValue,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    match val {
        JsonValue::String(s) => q.bind(s.as_str()),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                q.bind(i)
            } else if let Some(f) = n.as_f64() {
                q.bind(f)
            } else {
                q.bind(Option::<i64>::None)
            }
        }
        JsonValue::Bool(b) => q.bind(if *b { 1i64 } else { 0i64 }),
        JsonValue::Null => q.bind(Option::<String>::None),
        _ => q.bind(val.to_string()),
    }
}

fn random_token() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    hex::encode(bytes)
}

pub fn random_pairing_code() -> String {
    use rand::Rng;
    let n: u32 = rand::thread_rng().gen_range(0..1_000_000);
    format!("{:06}", n)
}

// ============================================================
// Server lifecycle
// ============================================================

pub struct ServerHandle {
    pub addr: SocketAddr,
    pub mdns_handle: Option<ServiceDaemon>,
    pub shutdown_tx: tokio::sync::oneshot::Sender<()>,
}

pub struct ReadOnlyServerHandle {
    pub addr: SocketAddr,
    pub shutdown_tx: tokio::sync::oneshot::Sender<()>,
}

pub async fn start_read_only_server(
    state: read_only_web::ReadOnlyWebState,
    port: u16,
) -> Result<ReadOnlyServerHandle, String> {
    let addr: SocketAddr = format!("0.0.0.0:{port}")
        .parse()
        .map_err(|error: std::net::AddrParseError| error.to_string())?;
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|error| format!("Failed to bind read-only browser listener {addr}: {error}"))?;
    let actual_addr = listener.local_addr().map_err(|error| error.to_string())?;
    let app = read_only_web::build_read_only_web_router(state);
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    Ok(ReadOnlyServerHandle {
        addr: actual_addr,
        shutdown_tx,
    })
}

pub async fn start_server(state: ServerState, port: u16) -> Result<ServerHandle, String> {
    let addr: SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    let actual_addr = listener.local_addr().map_err(|e| e.to_string())?;

    crate::db::network::prepare_legacy_token_hashes(&state.pool)
        .await
        .map_err(|_| "Failed to prepare LAN authentication".to_string())?;
    let app = build_router(state);

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        let _ = axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async {
            let _ = rx.await;
        })
        .await;
    });

    // Start mDNS broadcast (best-effort; if it fails, server still works on direct IP)
    let mdns_handle = match start_mdns(actual_addr.port()) {
        Ok(d) => Some(d),
        Err(e) => {
            eprintln!("mDNS broadcast failed: {}", e);
            None
        }
    };

    Ok(ServerHandle {
        addr: actual_addr,
        mdns_handle,
        shutdown_tx: tx,
    })
}

fn start_mdns(port: u16) -> Result<ServiceDaemon, String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let host_ip = local_ip_address::local_ip()
        .map_err(|e| e.to_string())?
        .to_string();
    let host_name = format!("omnix-{}.local.", host_ip.replace('.', "-"));
    let service = ServiceInfo::new(
        SERVICE_TYPE,
        "Omnix",
        &host_name,
        host_ip.as_str(),
        port,
        None,
    )
    .map_err(|e| e.to_string())?;
    daemon.register(service).map_err(|e| e.to_string())?;
    Ok(daemon)
}

pub fn discover_servers(timeout_ms: u64) -> Result<Vec<DiscoveredServer>, String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;

    let mut found = Vec::new();
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

    while std::time::Instant::now() < deadline {
        if let Ok(event) = receiver.recv_timeout(std::time::Duration::from_millis(200)) {
            if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                let addrs: Vec<String> = info
                    .get_addresses()
                    .iter()
                    .map(|ip| ip.to_string())
                    .collect();
                if let Some(ip) = addrs.first() {
                    found.push(DiscoveredServer {
                        name: info.get_fullname().to_string(),
                        url: format!("http://{}:{}", ip, info.get_port()),
                    });
                }
            }
        }
    }

    let _ = daemon.shutdown();
    Ok(found)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredServer {
    pub name: String,
    pub url: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn browser_origin_cannot_reach_legacy_sql_routes() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(
            "CREATE TABLE api_tokens (token TEXT PRIMARY KEY, revoked INTEGER, last_seen_at TEXT);\
             CREATE TABLE protected_rows (id INTEGER PRIMARY KEY);\
             INSERT INTO api_tokens VALUES ('native-token', 0, NULL);\
             INSERT INTO protected_rows VALUES (1);",
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = build_router(ServerState {
            pool: pool.clone(),
            business_name: Arc::new(RwLock::new("Test business".to_string())),
            sync: None,
        });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        for path in ["/api/db/query", "/api/db/execute"] {
            let response = reqwest::Client::new()
                .post(format!("http://{address}{path}"))
                .bearer_auth("native-token")
                .header("origin", "http://127.0.0.1:39420")
                .header("sec-fetch-site", "cross-site")
                .json(&serde_json::json!({
                    "sql": "DELETE FROM protected_rows",
                    "params": []
                }))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
            assert!(response
                .headers()
                .get("access-control-allow-origin")
                .is_none());
        }

        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM protected_rows")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(remaining, 1);
        task.abort();
    }
}
