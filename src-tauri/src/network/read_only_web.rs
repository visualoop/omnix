//! Dedicated Axum surface for the LAN browser reporting companion.
//!
//! This router is intentionally mounted only on its dedicated listener. It is
//! never merged into the legacy paired-device/raw-SQL router.
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
    })
    .map_err(|error| {
        WebHttpError::redemption_policy(error, &state.expected_origin, origin_header, fetch_site)
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
                web_db::ReadOnlyWebDbError::Invalid(message) => {
                    WebHttpError::redemption_rejected(
                        StatusCode::BAD_REQUEST,
                        "CODE_FORMAT_INVALID",
                        message,
                    )
                }
                web_db::ReadOnlyWebDbError::AuthorizationCodeUnknown => {
                    WebHttpError::redemption_rejected(
                        StatusCode::UNAUTHORIZED,
                        "CODE_INVALID",
                        "This code is not recognized. Check every character or ask the administrator for a new code.",
                    )
                }
                web_db::ReadOnlyWebDbError::AuthorizationCodeExpired => {
                    WebHttpError::redemption_rejected(
                        StatusCode::UNAUTHORIZED,
                        "CODE_EXPIRED",
                        "This code expired before it was used. Ask the administrator to issue a new code.",
                    )
                }
                web_db::ReadOnlyWebDbError::AuthorizationCodeAlreadyUsed => {
                    WebHttpError::redemption_rejected(
                        StatusCode::CONFLICT,
                        "CODE_ALREADY_USED",
                        "This one-time code has already been used. Ask the administrator to issue a new code for this browser.",
                    )
                }
                web_db::ReadOnlyWebDbError::AuthorizationCodeRevoked => {
                    WebHttpError::redemption_rejected(
                        StatusCode::FORBIDDEN,
                        "CODE_REVOKED",
                        "This browser authorization was revoked. Ask the administrator to issue a new code.",
                    )
                }
                web_db::ReadOnlyWebDbError::AuthorizationUserInactive => {
                    WebHttpError::redemption_rejected(
                        StatusCode::FORBIDDEN,
                        "VIEWER_DISABLED",
                        "The assigned viewer account is inactive. Ask the administrator to activate it or choose another reporting user.",
                    )
                }
                web_db::ReadOnlyWebDbError::Forbidden(message) => {
                    WebHttpError::redemption_rejected(
                        StatusCode::FORBIDDEN,
                        "AUTHORIZATION_FORBIDDEN",
                        message,
                    )
                }
                web_db::ReadOnlyWebDbError::NotFound(message) => {
                    WebHttpError::redemption_rejected(
                        StatusCode::UNAUTHORIZED,
                        "CODE_INVALID",
                        message,
                    )
                }
                web_db::ReadOnlyWebDbError::Database(error) => {
                    WebHttpError::redemption_database(error)
                }
                web_db::ReadOnlyWebDbError::Corrupt => {
                    WebHttpError::with_support_reference(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "redeem_corrupt",
                        "AUTHORIZATION_STATE_INVALID",
                        "The stored browser authorization is invalid. Ask the administrator to issue a new code. If it happens again, contact Omnix support.",
                        None,
                    )
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
            web_db::ReadOnlyWebDbError::Database(error) => WebHttpError::with_support_reference(
                StatusCode::INTERNAL_SERVER_ERROR,
                "load_browser_session",
                "SESSION_LOAD_FAILED",
                "The hub could not load this browser session. Try again; if it continues, contact Omnix support.",
                Some(&error),
            ),
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
    message: String,
    support_reference: Option<String>,
}

impl WebHttpError {
    fn from_database(error: web_db::ReadOnlyWebDbError) -> Self {
        match error {
            web_db::ReadOnlyWebDbError::Invalid(message) => Self::bad_request(message),
            web_db::ReadOnlyWebDbError::Forbidden(message) => Self::forbidden(message),
            web_db::ReadOnlyWebDbError::NotFound(message) => Self::not_found(message),
            web_db::ReadOnlyWebDbError::Database(error) => Self::with_support_reference(
                StatusCode::INTERNAL_SERVER_ERROR,
                "read_projection",
                "REPORT_DATABASE_ERROR",
                "The report could not be loaded. Try again; if it continues, contact Omnix support.",
                Some(&error),
            ),
            web_db::ReadOnlyWebDbError::Corrupt => Self::with_support_reference(
                StatusCode::INTERNAL_SERVER_ERROR,
                "read_projection_corrupt",
                "SESSION_STATE_INVALID",
                "The stored browser session is invalid. Ask the administrator to issue a new code.",
                None,
            ),
            web_db::ReadOnlyWebDbError::AuthorizationCodeUnknown
            | web_db::ReadOnlyWebDbError::AuthorizationCodeExpired
            | web_db::ReadOnlyWebDbError::AuthorizationCodeAlreadyUsed
            | web_db::ReadOnlyWebDbError::AuthorizationCodeRevoked
            | web_db::ReadOnlyWebDbError::AuthorizationUserInactive => Self::with_support_reference(
                StatusCode::INTERNAL_SERVER_ERROR,
                "unexpected_authorization_state",
                "AUTHORIZATION_STATE_INVALID",
                "The report could not be loaded. Ask the administrator to issue a new code.",
                None,
            ),
        }
    }

    fn with_code(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            support_reference: None,
        }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self::with_code(StatusCode::BAD_REQUEST, "BAD_QUERY", message)
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self::with_code(StatusCode::UNAUTHORIZED, "SESSION_EXPIRED", message)
    }

    fn forbidden(message: impl Into<String>) -> Self {
        Self::with_code(StatusCode::FORBIDDEN, "FORBIDDEN", message)
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self::with_code(StatusCode::NOT_FOUND, "NOT_FOUND", message)
    }

    fn internal(message: impl Into<String>) -> Self {
        Self::with_code(StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL", message)
    }

    fn redemption_rejected(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        let support_reference = uuid::Uuid::new_v4().to_string();
        log::warn!(
            "browser support_reference={} operation=redeem_authorization outcome=rejected reason={}",
            support_reference,
            code
        );
        Self {
            status,
            code,
            message: message.into(),
            support_reference: Some(support_reference),
        }
    }

    fn redemption_policy(
        error: PolicyError,
        expected_origin: &str,
        request_origin: Option<&str>,
        sec_fetch_site: Option<&str>,
    ) -> Self {
        let code = if expected_origin.is_empty() {
            "HUB_ORIGIN_NOT_CONFIGURED"
        } else if sec_fetch_site != Some("same-origin") {
            "FETCH_SITE_REJECTED"
        } else {
            "ORIGIN_MISMATCH"
        };
        let response = Self::redemption_rejected(StatusCode::FORBIDDEN, code, error.message);
        if let Some(reference) = response.support_reference.as_deref() {
            log::warn!(
                "browser support_reference={} operation=redeem_authorization expected_origin={:?} request_origin={:?} sec_fetch_site={:?}",
                reference,
                expected_origin,
                request_origin,
                sec_fetch_site
            );
        }
        response
    }

    fn redemption_database(error: sqlx::Error) -> Self {
        let database_message = error
            .as_database_error()
            .map(|value| value.message().to_ascii_lowercase())
            .unwrap_or_default();
        if database_message.contains("no such table") || database_message.contains("no such column")
        {
            return Self::with_support_reference(
                StatusCode::SERVICE_UNAVAILABLE,
                "redeem_authorization",
                "HUB_DATABASE_UPDATE_REQUIRED",
                "The hub database is not ready for browser access. Update and restart Omnix, then ask for a new code.",
                Some(&error),
            );
        }
        if database_message.contains("database is locked")
            || database_message.contains("database is busy")
            || matches!(&error, sqlx::Error::PoolTimedOut)
        {
            return Self::with_support_reference(
                StatusCode::SERVICE_UNAVAILABLE,
                "redeem_authorization",
                "HUB_DATABASE_BUSY",
                "The hub database is busy. Wait a moment and try this code again.",
                Some(&error),
            );
        }
        Self::with_support_reference(
            StatusCode::INTERNAL_SERVER_ERROR,
            "redeem_authorization",
            "SESSION_STORE_FAILED",
            "The hub could not store this browser session. Restart Omnix and ask for a new code. If it continues, contact Omnix support.",
            Some(&error),
        )
    }

    fn with_support_reference(
        status: StatusCode,
        operation: &'static str,
        code: &'static str,
        message: impl Into<String>,
        error: Option<&sqlx::Error>,
    ) -> Self {
        let support_reference = uuid::Uuid::new_v4().to_string();
        if let Some(error) = error {
            if let Some(database_error) = error.as_database_error() {
                log::error!(
                    "browser support_reference={} operation={} reason={} sqlx_class=database code={:?} message={}",
                    support_reference,
                    operation,
                    code,
                    database_error.code(),
                    database_error.message()
                );
            } else {
                log::error!(
                    "browser support_reference={} operation={} reason={} sqlx_class={}",
                    support_reference,
                    operation,
                    code,
                    sqlx_error_class(error)
                );
            }
        } else {
            log::error!(
                "browser support_reference={} operation={} reason={} internal_state_error",
                support_reference,
                operation,
                code
            );
        }
        Self {
            status,
            code,
            message: message.into(),
            support_reference: Some(support_reference),
        }
    }

    fn database(error: sqlx::Error) -> Self {
        Self::with_support_reference(
            StatusCode::INTERNAL_SERVER_ERROR,
            "read_projection_query",
            "REPORT_DATABASE_ERROR",
            "The report could not be loaded. Try again; if it continues, contact Omnix support.",
            Some(&error),
        )
    }
}

fn sqlx_error_class(error: &sqlx::Error) -> &'static str {
    match error {
        sqlx::Error::Configuration(_) => "configuration",
        sqlx::Error::Database(_) => "database",
        sqlx::Error::Io(_) => "io",
        sqlx::Error::Tls(_) => "tls",
        sqlx::Error::Protocol(_) => "protocol",
        sqlx::Error::RowNotFound => "row_not_found",
        sqlx::Error::TypeNotFound { .. } => "type_not_found",
        sqlx::Error::ColumnIndexOutOfBounds { .. } => "column_index_out_of_bounds",
        sqlx::Error::ColumnNotFound(_) => "column_not_found",
        sqlx::Error::ColumnDecode { .. } => "column_decode",
        sqlx::Error::Decode(_) => "decode",
        sqlx::Error::PoolTimedOut => "pool_timed_out",
        sqlx::Error::PoolClosed => "pool_closed",
        sqlx::Error::WorkerCrashed => "worker_crashed",
        sqlx::Error::Migrate(_) => "migrate",
        _ => "other",
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
                message: error.message.to_string(),
                support_reference: None,
            },
        }
    }
}

impl IntoResponse for WebHttpError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": {
                "code": self.code,
                "message": self.message,
                "supportReference": self.support_reference,
            }
        });
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
