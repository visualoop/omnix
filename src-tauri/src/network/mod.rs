// LAN HTTP server for master device.
//
// Exposes:
//   GET  /api/health          → { ok: true, version, business_name }
//   POST /api/auth/pair       → exchange pairing_code for bearer token
//   POST /api/db/query        → run SELECT, return rows (auth required)
//   POST /api/db/execute      → run INSERT/UPDATE/DELETE (auth required)
//
// All authenticated routes require `Authorization: Bearer <token>` header.

use axum::{
    extract::State,
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum::extract::Request;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

const SERVICE_TYPE: &str = "_sokoos._tcp.local.";

#[derive(Clone)]
pub struct ServerState {
    pub pool: SqlitePool,
    pub business_name: Arc<RwLock<String>>,
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
    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any);

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/pair", post(pair_device))
        .route(
            "/api/db/query",
            post(db_query).layer(middleware::from_fn_with_state(state.clone(), require_auth)),
        )
        .route(
            "/api/db/execute",
            post(db_execute).layer(middleware::from_fn_with_state(state.clone(), require_auth)),
        )
        .with_state(state)
        .layer(cors)
}

async fn health(State(state): State<ServerState>) -> Json<JsonValue> {
    Json(serde_json::json!({
        "ok": true,
        "service": "sokoos",
        "version": env!("CARGO_PKG_VERSION"),
        "business": *state.business_name.read(),
    }))
}

async fn pair_device(
    State(state): State<ServerState>,
    Json(req): Json<PairRequest>,
) -> Result<Json<PairResponse>, ApiError> {
    // Validate code is 6 digits and exists, not used, not expired
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT code FROM pairing_codes
         WHERE code = ?1 AND used_at IS NULL
           AND datetime(expires_at) > datetime('now')",
    )
    .bind(&req.code)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| ApiError { error: e.to_string() })?;

    if row.is_none() {
        return Err(ApiError {
            error: "Invalid or expired pairing code".to_string(),
        });
    }

    // Generate token
    let token = random_token();

    // Insert token + mark code used (transactional)
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| ApiError { error: e.to_string() })?;

    sqlx::query(
        "INSERT INTO api_tokens (token, device_name, device_fingerprint, last_seen_at)
         VALUES (?1, ?2, ?3, datetime('now'))",
    )
    .bind(&token)
    .bind(&req.device_name)
    .bind(&req.device_fingerprint)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError { error: e.to_string() })?;

    sqlx::query(
        "UPDATE pairing_codes SET used_at = datetime('now'), issued_token = ?1 WHERE code = ?2",
    )
    .bind(&token)
    .bind(&req.code)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError { error: e.to_string() })?;

    tx.commit()
        .await
        .map_err(|e| ApiError { error: e.to_string() })?;

    Ok(Json(PairResponse {
        token,
        business_name: state.business_name.read().clone(),
    }))
}

async fn require_auth(
    State(state): State<ServerState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok());

    let token = match auth_header.and_then(|h| h.strip_prefix("Bearer ")) {
        Some(t) => t.to_string(),
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let valid: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM api_tokens WHERE token = ?1 AND revoked = 0",
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if valid.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Update last_seen
    let _ = sqlx::query("UPDATE api_tokens SET last_seen_at = datetime('now') WHERE token = ?1")
        .bind(&token)
        .execute(&state.pool)
        .await;

    Ok(next.run(request).await)
}

async fn db_query(
    State(state): State<ServerState>,
    Json(q): Json<DbQuery>,
) -> Result<Json<DbResult>, ApiError> {
    use sqlx::Row;
    use sqlx::Column;

    let mut sqlx_q = sqlx::query(&q.sql);
    for param in &q.params {
        sqlx_q = bind_json(sqlx_q, param);
    }

    let rows = sqlx_q
        .fetch_all(&state.pool)
        .await
        .map_err(|e| ApiError { error: e.to_string() })?;

    let mut result = Vec::with_capacity(rows.len());
    for row in rows {
        let mut obj = HashMap::new();
        for (i, col) in row.columns().iter().enumerate() {
            let val: JsonValue = if let Ok(s) = row.try_get::<String, _>(i) {
                JsonValue::String(s)
            } else if let Ok(n) = row.try_get::<i64, _>(i) {
                JsonValue::Number(n.into())
            } else if let Ok(f) = row.try_get::<f64, _>(i) {
                serde_json::Number::from_f64(f).map(JsonValue::Number).unwrap_or(JsonValue::Null)
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

    let res = sqlx_q
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError { error: e.to_string() })?;

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

pub async fn start_server(
    state: ServerState,
    port: u16,
) -> Result<ServerHandle, String> {
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().map_err(|e: std::net::AddrParseError| e.to_string())?;
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;
    let actual_addr = listener.local_addr().map_err(|e| e.to_string())?;

    let app = build_router(state);

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();

    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
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
    let host_name = format!("sokoos-{}.local.", host_ip.replace('.', "-"));
    let service = ServiceInfo::new(
        SERVICE_TYPE,
        "SokoOS",
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
    let receiver = daemon
        .browse(SERVICE_TYPE)
        .map_err(|e| e.to_string())?;

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
