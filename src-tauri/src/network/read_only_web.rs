//! Dedicated Axum surface for the LAN browser reporting companion.
//!
//! This module is intentionally not registered from `network/mod.rs`. It must
//! run on a separate listener from the legacy paired-device/raw-SQL router.
//! Every endpoint is an exact GET route, resolves an HttpOnly session, passes
//! through `read_only_policy`, executes one fixed projection, and serializes a
//! bounded typed response.

use crate::db::read_only_web::{self as web_db, StoredSession};
pub use crate::network::read_only_policy::MAX_SESSION_SECONDS;
use crate::network::read_only_policy::{
    assert_output_within_caps, assert_same_origin, authorize, PolicyError, PolicyErrorKind,
    PolicyRequest, QueryParam, RequestOrigin, SessionClaims,
};
use axum::{
    body::Body,
    extract::{OriginalUri, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde_json::json;
use sqlx::sqlite::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub const SESSION_COOKIE_NAME: &str = "omnix_web_session";

#[derive(Clone)]
pub struct ReadOnlyWebState {
    pool: SqlitePool,
    expected_origin: Arc<str>,
    hub_name: Arc<str>,
    asset_root: Arc<PathBuf>,
}

impl ReadOnlyWebState {
    pub fn new(pool: SqlitePool, expected_origin: String, hub_name: String) -> Self {
        Self {
            pool,
            expected_origin: Arc::from(expected_origin),
            hub_name: Arc::from(hub_name),
            asset_root: Arc::new(discover_asset_root()),
        }
    }

    pub fn with_asset_root(mut self, asset_root: PathBuf) -> Self {
        self.asset_root = Arc::new(asset_root);
        self
    }
}

fn discover_asset_root() -> PathBuf {
    let mut candidates = Vec::new();
    if let Some(configured) = std::env::var_os("OMNIX_WEB_ASSET_ROOT") {
        candidates.push(PathBuf::from(configured));
    }
    if let Ok(executable) = std::env::current_exe() {
        if let Some(directory) = executable.parent() {
            candidates.push(directory.join("web-dist"));
            candidates.push(directory.join("resources").join("web-dist"));
        }
    }
    if let Ok(current) = std::env::current_dir() {
        candidates.push(current.join("dist"));
        candidates.push(current.join("..").join("dist"));
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.join("web.html").is_file())
        .unwrap_or_else(|| PathBuf::from("dist"))
}

pub fn build_read_only_web_router(state: ReadOnlyWebState) -> Router {
    Router::new()
        .route("/api/web/v1/session", get(redeem_browser_authorization))
        .route("/api/web/v1/home", get(read_projection))
        .route("/api/web/v1/branches", get(read_projection))
        .route("/api/web/v1/reports", get(read_projection))
        .route("/api/web/v1/reports/rows", get(read_projection))
        .route("/api/web/v1/alerts", get(read_projection))
        .route("/api/web/v1/sync-health", get(read_projection))
        .route("/api/web/v1/drill-down", get(read_projection))
        .route("/api/web/v1/profile", get(read_projection))
        .route("/web", get(web_document))
        .route("/web/", get(web_document))
        .route("/web/*path", get(web_document))
        .route("/assets/*path", get(static_asset))
        .route("/manifest.webmanifest", get(static_asset))
        .route("/web-service-worker.js", get(static_asset))
        .route("/web-icon-192.png", get(static_asset))
        .route("/web-icon-512.png", get(static_asset))
        .fallback(not_found)
        .with_state(state)
}

async fn web_document(State(state): State<ReadOnlyWebState>) -> Result<Response, WebHttpError> {
    serve_asset_file(&state, "web.html", "text/html; charset=utf-8", true).await
}

async fn static_asset(
    State(state): State<ReadOnlyWebState>,
    OriginalUri(uri): OriginalUri,
) -> Result<Response, WebHttpError> {
    let relative = uri.path().trim_start_matches('/');
    let allowed = relative.starts_with("assets/")
        || matches!(
            relative,
            "manifest.webmanifest"
                | "web-service-worker.js"
                | "web-icon-192.png"
                | "web-icon-512.png"
        );
    if !allowed || !safe_relative_path(relative) {
        return Err(WebHttpError::not_found(
            "The requested web asset is not available.",
        ));
    }
    serve_asset_file(&state, relative, content_type(relative), false).await
}

async fn serve_asset_file(
    state: &ReadOnlyWebState,
    relative: &str,
    content_type: &'static str,
    document: bool,
) -> Result<Response, WebHttpError> {
    const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;
    let path = state.asset_root.join(relative);
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| WebHttpError::not_found("The requested web asset is not available."))?;
    if !metadata.is_file() || metadata.len() > MAX_ASSET_BYTES {
        return Err(WebHttpError::not_found(
            "The requested web asset is not available.",
        ));
    }
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| WebHttpError::not_found("The requested web asset is not available."))?;
    let mut response = Response::new(Body::from(bytes));
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(if document { "no-store" } else { "no-cache" }),
    );
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response.headers_mut().insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    if document {
        response.headers_mut().insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"),
        );
    }
    Ok(response)
}

fn safe_relative_path(value: &str) -> bool {
    !value.is_empty()
        && Path::new(value)
            .components()
            .all(|component| matches!(component, std::path::Component::Normal(_)))
}

fn content_type(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("webmanifest") => "application/manifest+json; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        _ => "application/octet-stream",
    }
}

pub fn session_token_hash(raw_token: &str) -> String {
    web_db::token_hash(raw_token)
}

pub fn session_cookie_header(
    raw_token: &str,
    max_age_seconds: i64,
    secure: bool,
) -> Result<HeaderValue, WebHttpError> {
    if raw_token.len() < 43
        || raw_token.len() > 256
        || !raw_token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        || !(1..=MAX_SESSION_SECONDS).contains(&max_age_seconds)
    {
        return Err(WebHttpError::bad_request(
            "Invalid session cookie contract.",
        ));
    }
    let secure_attribute = if secure { "; Secure" } else { "" };
    HeaderValue::from_str(&format!(
        "{SESSION_COOKIE_NAME}={raw_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age_seconds}{secure_attribute}"
    ))
    .map_err(|_| WebHttpError::bad_request("Invalid session cookie contract."))
}

async fn redeem_browser_authorization(
    State(state): State<ReadOnlyWebState>,
    method: Method,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Result<Response, WebHttpError> {
    if method != Method::GET {
        return Err(WebHttpError::forbidden(
            "The browser API accepts GET requests only.",
        ));
    }
    let origin_header = optional_header(&headers, header::ORIGIN)?;
    let fetch_site = optional_header_name(&headers, "sec-fetch-site")?;
    assert_same_origin(RequestOrigin {
        expected_origin: &state.expected_origin,
        origin_header,
        sec_fetch_site: fetch_site,
    })?;
    let query = parse_query(uri.query().unwrap_or_default())?;
    if query.len() != 1 || query[0].0 != "code" {
        return Err(WebHttpError::bad_request(
            "A single browser authorization code is required.",
        ));
    }
    let redeemed =
        web_db::redeem_authorization(&state.pool, &query[0].1, chrono::Utc::now().timestamp())
            .await
            .map_err(|error| match error {
                web_db::ReadOnlyWebDbError::Invalid(message) => WebHttpError::bad_request(message),
                web_db::ReadOnlyWebDbError::Forbidden(message) => WebHttpError::forbidden(message),
                web_db::ReadOnlyWebDbError::NotFound(message) => {
                    WebHttpError::unauthorized(message)
                }
                web_db::ReadOnlyWebDbError::Database(_) | web_db::ReadOnlyWebDbError::Corrupt => {
                    WebHttpError::internal("The browser session could not be authorized.")
                }
            })?;
    let cookie = session_cookie_header(
        &redeemed.raw_token,
        redeemed.max_age_seconds,
        state.expected_origin.starts_with("https://"),
    )?;
    let body = serde_json::to_vec(&json!({ "authorized": true }))
        .map_err(|_| WebHttpError::internal("The authorization response could not be encoded."))?;
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = StatusCode::OK;
    let response_headers = response.headers_mut();
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    response_headers.insert(header::SET_COOKIE, cookie);
    apply_security_headers(response_headers);
    Ok(response)
}
async fn not_found() -> WebHttpError {
    WebHttpError::not_found("The requested read projection is not available.")
}

async fn read_projection(
    State(state): State<ReadOnlyWebState>,
    method: Method,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Result<Response, WebHttpError> {
    dispatch_read_request(&state, &method, &uri, &headers).await
}

pub async fn dispatch_read_request(
    state: &ReadOnlyWebState,
    method: &Method,
    uri: &axum::http::Uri,
    headers: &HeaderMap,
) -> Result<Response, WebHttpError> {
    let raw_token = cookie_value(headers, SESSION_COOKIE_NAME)
        .ok_or_else(|| WebHttpError::unauthorized("A valid browser session is required."))?;
    let session = load_session(&state.pool, raw_token).await?;
    let owned_query = parse_query(uri.query().unwrap_or_default())?;
    let query_refs: Vec<QueryParam<'_>> = owned_query
        .iter()
        .map(|(name, value)| QueryParam { name, value })
        .collect();
    let origin_header = optional_header(headers, header::ORIGIN)?;
    let fetch_site = optional_header_name(headers, "sec-fetch-site")?;
    let branch_refs: Vec<&str> = session
        .assigned_branch_ids
        .iter()
        .map(String::as_str)
        .collect();
    let permission_refs: Vec<&str> = session.permissions.iter().map(String::as_str).collect();
    let claims = SessionClaims {
        session_id: &session.session_id,
        user_id: &session.user_id,
        role: session.role,
        read_only: session.read_only,
        assigned_branch_ids: &branch_refs,
        permissions: &permission_refs,
        issued_at_unix_seconds: session.issued_at_unix_seconds,
        expires_at_unix_seconds: session.expires_at_unix_seconds,
    };
    let request = PolicyRequest {
        method: method.as_str(),
        path: uri.path(),
        origin: RequestOrigin {
            expected_origin: &state.expected_origin,
            origin_header,
            sec_fetch_site: fetch_site,
        },
        query: &query_refs,
    };
    let authorized = authorize(claims, request, chrono::Utc::now().timestamp())?;
    let payload = web_db::execute_projection(&state.pool, &state.hub_name, &session, &authorized)
        .await
        .map_err(WebHttpError::from_database)?;
    let body = serde_json::to_vec(&payload)
        .map_err(|_| WebHttpError::internal("The read projection could not be encoded."))?;
    assert_output_within_caps(authorized.projection, payload.item_count(), body.len())?;

    let mut response = Response::new(Body::from(body));
    *response.status_mut() = StatusCode::OK;
    let response_headers = response.headers_mut();
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    );
    response_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, private"),
    );
    response_headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    response_headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response_headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response_headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
    );
    Ok(response)
}

async fn load_session(pool: &SqlitePool, raw_token: &str) -> Result<StoredSession, WebHttpError> {
    web_db::load_session(pool, raw_token, chrono::Utc::now().timestamp())
        .await
        .map_err(|error| match error {
            web_db::ReadOnlyWebDbError::Database(_) => {
                WebHttpError::internal("The browser session could not be loaded.")
            }
            _ => WebHttpError::unauthorized("A valid browser session is required."),
        })
}

fn cookie_value<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|part| part.trim().split_once('='))
        .find_map(|(key, value)| (key == name && !value.is_empty()).then_some(value))
}

fn optional_header<'a>(
    headers: &'a HeaderMap,
    name: header::HeaderName,
) -> Result<Option<&'a str>, WebHttpError> {
    match headers.get(name) {
        Some(value) => value
            .to_str()
            .map(Some)
            .map_err(|_| WebHttpError::forbidden("Cross-origin browser requests are not allowed.")),
        None => Ok(None),
    }
}

fn optional_header_name<'a>(
    headers: &'a HeaderMap,
    name: &str,
) -> Result<Option<&'a str>, WebHttpError> {
    match headers.get(name) {
        Some(value) => value
            .to_str()
            .map(Some)
            .map_err(|_| WebHttpError::forbidden("Cross-origin browser requests are not allowed.")),
        None => Ok(None),
    }
}

fn parse_query(raw: &str) -> Result<Vec<(String, String)>, WebHttpError> {
    if raw.is_empty() {
        return Ok(Vec::new());
    }
    if raw.len() > 2048 {
        return Err(WebHttpError::bad_request("The query is too large."));
    }
    raw.split('&')
        .map(|pair| {
            let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
            Ok((percent_decode(name)?, percent_decode(value)?))
        })
        .collect()
}

fn apply_security_headers(headers: &mut HeaderMap) {
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, private"),
    );
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
    );
}

fn percent_decode(value: &str) -> Result<String, WebHttpError> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'+' => decoded.push(b' '),
            b'%' if index + 2 < bytes.len() => {
                let high = hex_digit(bytes[index + 1])?;
                let low = hex_digit(bytes[index + 2])?;
                decoded.push((high << 4) | low);
                index += 2;
            }
            b'%' => return Err(WebHttpError::bad_request("The query encoding is invalid.")),
            byte if byte.is_ascii() => decoded.push(byte),
            _ => return Err(WebHttpError::bad_request("The query encoding is invalid.")),
        }
        index += 1;
    }
    String::from_utf8(decoded)
        .map_err(|_| WebHttpError::bad_request("The query encoding is invalid."))
}

fn hex_digit(value: u8) -> Result<u8, WebHttpError> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err(WebHttpError::bad_request("The query encoding is invalid.")),
    }
}

#[derive(Debug)]
pub struct WebHttpError {
    status: StatusCode,
    code: &'static str,
    message: &'static str,
}

impl WebHttpError {
    fn from_database(error: web_db::ReadOnlyWebDbError) -> Self {
        match error {
            web_db::ReadOnlyWebDbError::Invalid(message) => Self::bad_request(message),
            web_db::ReadOnlyWebDbError::Forbidden(message) => Self::forbidden(message),
            web_db::ReadOnlyWebDbError::NotFound(message) => Self::not_found(message),
            web_db::ReadOnlyWebDbError::Database(_) | web_db::ReadOnlyWebDbError::Corrupt => {
                Self::internal("The read projection could not be loaded.")
            }
        }
    }

    fn bad_request(message: &'static str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "BAD_QUERY",
            message,
        }
    }
    fn unauthorized(message: &'static str) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "SESSION_EXPIRED",
            message,
        }
    }
    fn forbidden(message: &'static str) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            code: "FORBIDDEN",
            message,
        }
    }
    fn not_found(message: &'static str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            code: "NOT_FOUND",
            message,
        }
    }
    fn internal(message: &'static str) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            code: "INTERNAL",
            message,
        }
    }
    fn database(error: sqlx::Error) -> Self {
        let _ = error;
        Self::internal("The read projection could not be loaded.")
    }
}

impl From<PolicyError> for WebHttpError {
    fn from(error: PolicyError) -> Self {
        match error.kind {
            PolicyErrorKind::BadQuery => Self::bad_request(error.message),
            PolicyErrorKind::Forbidden => Self::forbidden(error.message),
            PolicyErrorKind::SessionExpired => Self::unauthorized(error.message),
            PolicyErrorKind::NotFound => Self::not_found(error.message),
            PolicyErrorKind::OutputTooLarge => Self {
                status: StatusCode::PAYLOAD_TOO_LARGE,
                code: "OUTPUT_TOO_LARGE",
                message: error.message,
            },
        }
    }
}

impl IntoResponse for WebHttpError {
    fn into_response(self) -> Response {
        let body = json!({ "error": { "code": self.code, "message": self.message } });
        let mut response = (self.status, axum::Json(body)).into_response();
        let headers = response.headers_mut();
        headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store, private"),
        );
        headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        );
        headers.insert(
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        );
        headers.insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
        );
        response
    }
}
