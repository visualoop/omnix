//! Dedicated Axum surface for the LAN browser reporting companion.
//!
//! This module is intentionally not registered from `network/mod.rs`. It must
//! run on a separate listener from the legacy paired-device/raw-SQL router.
//! Every endpoint is an exact GET route, resolves an HttpOnly session, passes
//! through `read_only_policy`, executes one fixed projection, and serializes a
//! bounded typed response.

pub use crate::network::read_only_policy::MAX_SESSION_SECONDS;
use crate::network::read_only_policy::{
    assert_output_within_caps, authorize, AuthorizedRead, BranchScope, PolicyError,
    PolicyErrorKind, PolicyRequest, Projection, QueryParam, Report, RequestOrigin, SessionClaims,
    SessionRole,
};
use axum::{
    body::Body,
    extract::{OriginalUri, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{sqlite::SqlitePool, Row};
use std::sync::Arc;

pub const SESSION_COOKIE_NAME: &str = "omnix_web_session";

#[derive(Clone)]
pub struct ReadOnlyWebState {
    pool: SqlitePool,
    expected_origin: Arc<str>,
    hub_name: Arc<str>,
}

impl ReadOnlyWebState {
    pub fn new(pool: SqlitePool, expected_origin: String, hub_name: String) -> Self {
        Self {
            pool,
            expected_origin: Arc::from(expected_origin),
            hub_name: Arc::from(hub_name),
        }
    }
}

pub fn build_read_only_web_router(state: ReadOnlyWebState) -> Router {
    Router::new()
        .route("/api/web/v1/home", get(read_projection))
        .route("/api/web/v1/branches", get(read_projection))
        .route("/api/web/v1/reports", get(read_projection))
        .route("/api/web/v1/reports/rows", get(read_projection))
        .route("/api/web/v1/alerts", get(read_projection))
        .route("/api/web/v1/sync-health", get(read_projection))
        .route("/api/web/v1/drill-down", get(read_projection))
        .route("/api/web/v1/profile", get(read_projection))
        .fallback(not_found)
        .with_state(state)
}

pub fn session_token_hash(raw_token: &str) -> String {
    hex::encode(Sha256::digest(raw_token.as_bytes()))
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
    let payload = execute_projection(state, &session, &authorized).await?;
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

#[derive(Clone, Debug)]
struct StoredSession {
    session_id: String,
    user_id: String,
    display_name: String,
    role: SessionRole,
    read_only: bool,
    assigned_branch_ids: Vec<String>,
    permissions: Vec<String>,
    device_label: String,
    issued_at_unix_seconds: i64,
    expires_at_unix_seconds: i64,
}

async fn load_session(pool: &SqlitePool, raw_token: &str) -> Result<StoredSession, WebHttpError> {
    if raw_token.len() < 43
        || raw_token.len() > 256
        || !raw_token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(WebHttpError::unauthorized(
            "A valid browser session is required.",
        ));
    }
    let row = sqlx::query(
        "SELECT ws.id, ws.user_id, u.full_name, ws.role, ws.read_only, \
                ws.assigned_branch_ids_json, ws.permissions_json, ws.device_label, \
                ws.issued_at_unix_seconds, ws.expires_at_unix_seconds \
         FROM web_read_sessions ws JOIN users u ON u.id = ws.user_id \
         WHERE ws.token_hash = ?1 AND ws.revoked_at IS NULL AND u.active = 1 \
         LIMIT 1",
    )
    .bind(session_token_hash(raw_token))
    .fetch_optional(pool)
    .await
    .map_err(WebHttpError::database)?
    .ok_or_else(|| WebHttpError::unauthorized("A valid browser session is required."))?;

    let role = match row
        .try_get::<String, _>("role")
        .map_err(WebHttpError::database)?
        .as_str()
    {
        "manager" => SessionRole::Manager,
        "viewer" => SessionRole::Viewer,
        _ => {
            return Err(WebHttpError::unauthorized(
                "A valid browser session is required.",
            ))
        }
    };
    let assigned_branch_ids = parse_string_array(
        row.try_get("assigned_branch_ids_json")
            .map_err(WebHttpError::database)?,
    )?;
    let permissions = parse_string_array(
        row.try_get("permissions_json")
            .map_err(WebHttpError::database)?,
    )?;
    Ok(StoredSession {
        session_id: row.try_get("id").map_err(WebHttpError::database)?,
        user_id: row.try_get("user_id").map_err(WebHttpError::database)?,
        display_name: row.try_get("full_name").map_err(WebHttpError::database)?,
        role,
        read_only: row
            .try_get::<i64, _>("read_only")
            .map_err(WebHttpError::database)?
            == 1,
        assigned_branch_ids,
        permissions,
        device_label: row
            .try_get("device_label")
            .map_err(WebHttpError::database)?,
        issued_at_unix_seconds: row
            .try_get("issued_at_unix_seconds")
            .map_err(WebHttpError::database)?,
        expires_at_unix_seconds: row
            .try_get("expires_at_unix_seconds")
            .map_err(WebHttpError::database)?,
    })
}

fn parse_string_array(value: String) -> Result<Vec<String>, WebHttpError> {
    let values: Vec<String> = serde_json::from_str(&value)
        .map_err(|_| WebHttpError::unauthorized("A valid browser session is required."))?;
    if values.is_empty() || values.len() > 128 {
        return Err(WebHttpError::unauthorized(
            "A valid browser session is required.",
        ));
    }
    Ok(values)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorPage<T> {
    items: Vec<T>,
    next_cursor: Option<String>,
    has_more: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityProjection {
    id: String,
    occurred_at: String,
    branch_name: String,
    description: String,
    amount: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HomeProjection {
    generated_at: String,
    scope_label: String,
    sales_today: String,
    transaction_count: i64,
    low_stock_count: i64,
    open_alert_count: i64,
    recent_activity: Vec<ActivityProjection>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BranchProjection {
    id: String,
    code: String,
    name: String,
    town: Option<String>,
    last_seen_at: Option<String>,
    sync_state: &'static str,
    sales_today: String,
    transaction_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportDefinitionProjection {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    permission: &'static str,
    sensitive: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportRowProjection {
    id: String,
    label: String,
    secondary: String,
    value: String,
    occurred_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlertProjection {
    id: String,
    severity: String,
    title: String,
    detail: String,
    branch_name: String,
    raised_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncHealthProjection {
    branch_id: String,
    branch_name: String,
    state: &'static str,
    last_successful_sync_at: Option<String>,
    pending_records: i64,
    hub_reachable: bool,
}

#[derive(Serialize)]
struct FieldProjection {
    label: String,
    value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DrilldownProjection {
    id: String,
    title: String,
    subtitle: String,
    branch_name: String,
    fields: Vec<FieldProjection>,
    related: CursorPage<ReportRowProjection>,
}

#[derive(Serialize)]
struct AssignedBranchProjection {
    id: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfileProjection {
    session_id: String,
    user_id: String,
    role: &'static str,
    readonly: bool,
    display_name: String,
    role_label: &'static str,
    assigned_branches: Vec<AssignedBranchProjection>,
    permissions: Vec<String>,
    session_issued_at: String,
    session_expires_at: String,
    connected_hub_name: String,
    device_label: String,
}

#[derive(Serialize)]
#[serde(untagged)]
enum ProjectionPayload {
    Home(HomeProjection),
    Branches(CursorPage<BranchProjection>),
    Reports(Vec<ReportDefinitionProjection>),
    Rows(CursorPage<ReportRowProjection>),
    Alerts(CursorPage<AlertProjection>),
    Sync(SyncHealthProjection),
    Drilldown(DrilldownProjection),
    Profile(ProfileProjection),
}

impl ProjectionPayload {
    fn item_count(&self) -> usize {
        match self {
            Self::Home(value) => value.recent_activity.len(),
            Self::Branches(value) => value.items.len(),
            Self::Reports(value) => value.len(),
            Self::Rows(value) => value.items.len(),
            Self::Alerts(value) => value.items.len(),
            Self::Sync(_) | Self::Profile(_) => 1,
            Self::Drilldown(value) => value.related.items.len(),
        }
    }
}

async fn execute_projection(
    state: &ReadOnlyWebState,
    session: &StoredSession,
    authorized: &AuthorizedRead<'_>,
) -> Result<ProjectionPayload, WebHttpError> {
    match authorized.projection {
        Projection::HomeDashboard => Ok(ProjectionPayload::Home(
            home_projection(&state.pool, authorized).await?,
        )),
        Projection::BranchesList => Ok(ProjectionPayload::Branches(
            branch_projection(&state.pool, authorized).await?,
        )),
        Projection::ReportsCatalog => Ok(ProjectionPayload::Reports(report_catalog(session))),
        Projection::ReportsRows => Ok(ProjectionPayload::Rows(
            report_rows(&state.pool, authorized).await?,
        )),
        Projection::AlertsList => Ok(ProjectionPayload::Alerts(
            alert_projection(&state.pool, authorized).await?,
        )),
        Projection::SyncHealth => Ok(ProjectionPayload::Sync(
            sync_projection(&state.pool, authorized).await?,
        )),
        Projection::DrilldownReportRow => Ok(ProjectionPayload::Drilldown(
            drilldown_projection(&state.pool, authorized).await?,
        )),
        Projection::ProfileSession => Ok(ProjectionPayload::Profile(
            profile_projection(state, session).await?,
        )),
    }
}

fn branch_filter<'a>(authorized: &AuthorizedRead<'a>) -> Option<&'a str> {
    match authorized.scope {
        Some(BranchScope::Branch(branch_id)) => Some(branch_id),
        Some(BranchScope::All) | None => None,
    }
}

async fn home_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<HomeProjection, WebHttpError> {
    let branch_id = branch_filter(authorized);
    let summary = sqlx::query(
        "SELECT COALESCE(SUM(s.total), 0.0) AS total, COUNT(*) AS sale_count \
         FROM sales s WHERE s.status = 'completed' AND date(s.created_at) = date('now') \
           AND s.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) \
           AND (?2 IS NULL OR s.branch_id = ?2)",
    )
    .bind(authorized.user_id)
    .bind(branch_id)
    .fetch_one(pool)
    .await
    .map_err(WebHttpError::database)?;
    let low_stock: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM products p WHERE p.active = 1 AND COALESCE(( \
           SELECT SUM(b.quantity) FROM batches b \
           WHERE b.product_id = p.id AND b.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) \
             AND (?2 IS NULL OR b.branch_id = ?2)), 0) <= p.reorder_level",
    )
    .bind(authorized.user_id)
    .bind(branch_id)
    .fetch_one(pool)
    .await
    .map_err(WebHttpError::database)?;
    let open_alert_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE read_at IS NULL \
           AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))",
    )
    .fetch_one(pool)
    .await
    .map_err(WebHttpError::database)?;
    let activity_rows = sqlx::query(
        "SELECT s.id, s.sale_number, s.total, s.created_at, b.name AS branch_name \
         FROM sales s JOIN branches b ON b.id = s.branch_id \
         WHERE s.status = 'completed' \
           AND s.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) \
           AND (?2 IS NULL OR s.branch_id = ?2) \
         ORDER BY s.created_at DESC LIMIT 25",
    )
    .bind(authorized.user_id)
    .bind(branch_id)
    .fetch_all(pool)
    .await
    .map_err(WebHttpError::database)?;
    let recent_activity = activity_rows
        .into_iter()
        .map(|row| {
            Ok(ActivityProjection {
                id: row.try_get("id").map_err(WebHttpError::database)?,
                occurred_at: row.try_get("created_at").map_err(WebHttpError::database)?,
                branch_name: row.try_get("branch_name").map_err(WebHttpError::database)?,
                description: format!(
                    "Sale {} completed",
                    row.try_get::<i64, _>("sale_number")
                        .map_err(WebHttpError::database)?
                ),
                amount: Some(format_kes(
                    row.try_get("total").map_err(WebHttpError::database)?,
                )),
            })
        })
        .collect::<Result<Vec<_>, WebHttpError>>()?;
    let scope_label = match branch_id {
        Some(id) => {
            sqlx::query_scalar::<_, String>("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(WebHttpError::database)?
                .unwrap_or_else(|| "Assigned branch".to_string())
        }
        None => "All branches / analytics".to_string(),
    };
    Ok(HomeProjection {
        generated_at: chrono::Utc::now().to_rfc3339(),
        scope_label,
        sales_today: format_kes(summary.try_get("total").map_err(WebHttpError::database)?),
        transaction_count: summary
            .try_get("sale_count")
            .map_err(WebHttpError::database)?,
        low_stock_count: low_stock,
        open_alert_count,
        recent_activity,
    })
}

async fn branch_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<BranchProjection>, WebHttpError> {
    let offset = cursor_offset(authorized.query.cursor)?;
    let search = authorized.query.search.unwrap_or("");
    let rows = sqlx::query(
        "SELECT b.id, b.code, b.name, b.address, \
           COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed' AND date(s.created_at) = date('now')), 0.0) AS sales_today, \
           COALESCE((SELECT COUNT(*) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed' AND date(s.created_at) = date('now')), 0) AS transaction_count \
         FROM branches b JOIN user_branches ub ON ub.branch_id = b.id \
         WHERE ub.user_id = ?1 AND b.active = 1 \
           AND (?2 = '' OR b.name LIKE '%' || ?2 || '%' OR b.code LIKE '%' || ?2 || '%') \
         ORDER BY b.is_default DESC, b.name LIMIT ?3 OFFSET ?4",
    )
    .bind(authorized.user_id)
    .bind(search)
    .bind((authorized.query.limit + 1) as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await
    .map_err(WebHttpError::database)?;
    paged(rows, authorized.query.limit, offset, |row| {
        Ok(BranchProjection {
            id: row.try_get("id").map_err(WebHttpError::database)?,
            code: row.try_get("code").map_err(WebHttpError::database)?,
            name: row.try_get("name").map_err(WebHttpError::database)?,
            town: row.try_get("address").map_err(WebHttpError::database)?,
            last_seen_at: None,
            sync_state: "healthy",
            sales_today: format_kes(row.try_get("sales_today").map_err(WebHttpError::database)?),
            transaction_count: row
                .try_get("transaction_count")
                .map_err(WebHttpError::database)?,
        })
    })
}

fn report_catalog(session: &StoredSession) -> Vec<ReportDefinitionProjection> {
    Report::ALL
        .iter()
        .copied()
        .filter(|report| {
            session
                .permissions
                .iter()
                .any(|permission| permission == report.required_permission())
        })
        .map(report_definition)
        .collect()
}

fn report_definition(report: Report) -> ReportDefinitionProjection {
    let (title, description) = match report {
        Report::SalesSummary => (
            "Sales summary",
            "Revenue, transaction count, and payment mix.",
        ),
        Report::InventoryPosition => (
            "Inventory position",
            "Stock value, low-stock items, and ageing.",
        ),
        Report::ProfitAndLoss => (
            "Profit & loss",
            "Income, cost of sales, and operating result.",
        ),
        Report::ZReport => ("Z-report", "Till totals and reconciliation variance."),
        Report::TaxSummary => ("Tax summary", "VAT and eTIMS submission totals."),
        Report::PayrollSummary => (
            "Payroll summary",
            "Payroll totals without employee bank details.",
        ),
        Report::AuditSummary => ("Audit summary", "Security and business event overview."),
    };
    ReportDefinitionProjection {
        id: report.id(),
        title,
        description,
        permission: report.required_permission(),
        sensitive: report.sensitive(),
    }
}

async fn report_rows(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<ReportRowProjection>, WebHttpError> {
    let report = authorized
        .report
        .ok_or_else(|| WebHttpError::bad_request("A report is required."))?;
    let offset = cursor_offset(authorized.query.cursor)?;
    let limit = authorized.query.limit;
    let search = authorized.query.search.unwrap_or("");
    let branch_id = branch_filter(authorized);
    let rows = match report {
        Report::InventoryPosition => sqlx::query(
            "SELECT p.id, p.name AS label, COALESCE(p.sku, 'No SKU') AS secondary, \
                    COALESCE(SUM(b.quantity), 0.0) AS amount, MAX(p.updated_at) AS occurred_at \
             FROM products p LEFT JOIN batches b ON b.product_id = p.id \
               AND b.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) \
               AND (?2 IS NULL OR b.branch_id = ?2) \
             WHERE p.active = 1 AND (?3 = '' OR p.name LIKE '%' || ?3 || '%' OR p.sku LIKE '%' || ?3 || '%') \
             GROUP BY p.id, p.name, p.sku ORDER BY p.name LIMIT ?4 OFFSET ?5",
        )
        .bind(authorized.user_id).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(WebHttpError::database)?,
        Report::PayrollSummary => sqlx::query(
            "SELECT pr.id, printf('%04d-%02d', pr.period_year, pr.period_month) AS label, \
                    pr.status || ' / ' || pr.employee_count || ' employees' AS secondary, \
                    pr.net_total AS amount, pr.created_at AS occurred_at \
             FROM payroll_runs pr WHERE (pr.branch_id IS NULL OR pr.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1)) \
               AND (?2 IS NULL OR pr.branch_id IS NULL OR pr.branch_id = ?2) \
               AND (?3 = '' OR printf('%04d-%02d', pr.period_year, pr.period_month) LIKE '%' || ?3 || '%') \
             ORDER BY pr.period_year DESC, pr.period_month DESC LIMIT ?4 OFFSET ?5",
        )
        .bind(authorized.user_id).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(WebHttpError::database)?,
        Report::AuditSummary => sqlx::query(
            "SELECT a.id, a.action AS label, COALESCE(a.outcome, 'recorded') || ' / ' || COALESCE(a.permission_key, 'general') AS secondary, \
                    0.0 AS amount, a.created_at AS occurred_at \
             FROM audit_log a WHERE (a.branch_id IS NULL OR a.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1)) \
               AND (?2 IS NULL OR a.branch_id IS NULL OR a.branch_id = ?2) \
               AND (?3 = '' OR a.action LIKE '%' || ?3 || '%' OR a.permission_key LIKE '%' || ?3 || '%') \
             ORDER BY a.created_at DESC LIMIT ?4 OFFSET ?5",
        )
        .bind(authorized.user_id).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(WebHttpError::database)?,
        _ => sqlx::query(
            "SELECT s.id, 'Sale ' || s.sale_number AS label, \
                    s.payment_status || ' / ' || b.name AS secondary, \
                    CASE WHEN ?3 = 'tax-summary' THEN s.tax_amount ELSE s.total END AS amount, \
                    s.created_at AS occurred_at \
             FROM sales s JOIN branches b ON b.id = s.branch_id \
             WHERE s.status = 'completed' AND s.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) \
               AND (?2 IS NULL OR s.branch_id = ?2) \
               AND (?4 = '' OR CAST(s.sale_number AS TEXT) LIKE '%' || ?4 || '%' OR b.name LIKE '%' || ?4 || '%') \
             ORDER BY s.created_at DESC LIMIT ?5 OFFSET ?6",
        )
        .bind(authorized.user_id).bind(branch_id).bind(report.id()).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(WebHttpError::database)?,
    };
    paged(rows, limit, offset, |row| {
        let amount: f64 = row.try_get("amount").map_err(WebHttpError::database)?;
        Ok(ReportRowProjection {
            id: row.try_get("id").map_err(WebHttpError::database)?,
            label: row.try_get("label").map_err(WebHttpError::database)?,
            secondary: row.try_get("secondary").map_err(WebHttpError::database)?,
            value: if report == Report::InventoryPosition {
                format!("{amount:.2} units")
            } else if report == Report::AuditSummary {
                "Recorded".to_string()
            } else {
                format_kes(amount)
            },
            occurred_at: row.try_get("occurred_at").map_err(WebHttpError::database)?,
        })
    })
}

async fn alert_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<AlertProjection>, WebHttpError> {
    let branch_id = branch_filter(authorized)
        .ok_or_else(|| WebHttpError::bad_request("A branch is required."))?;
    let branch_name: String = sqlx::query_scalar("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
        .bind(branch_id)
        .fetch_one(pool)
        .await
        .map_err(WebHttpError::database)?;
    let offset = cursor_offset(authorized.query.cursor)?;
    let search = authorized.query.search.unwrap_or("");
    let rows = sqlx::query(
        "SELECT id, severity, title, COALESCE(body, '') AS detail, created_at \
         FROM notifications WHERE read_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < datetime('now')) \
           AND (COALESCE(json_extract(metadata, '$.branchId'), ?1) = ?1) \
           AND (?2 = '' OR title LIKE '%' || ?2 || '%' OR body LIKE '%' || ?2 || '%') \
         ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
    )
    .bind(branch_id).bind(search).bind((authorized.query.limit + 1) as i64).bind(offset as i64)
    .fetch_all(pool).await.map_err(WebHttpError::database)?;
    paged(rows, authorized.query.limit, offset, |row| {
        Ok(AlertProjection {
            id: row.try_get("id").map_err(WebHttpError::database)?,
            severity: row.try_get("severity").map_err(WebHttpError::database)?,
            title: row.try_get("title").map_err(WebHttpError::database)?,
            detail: row.try_get("detail").map_err(WebHttpError::database)?,
            branch_name: branch_name.clone(),
            raised_at: row.try_get("created_at").map_err(WebHttpError::database)?,
        })
    })
}

async fn sync_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<SyncHealthProjection, WebHttpError> {
    let branch_id = branch_filter(authorized)
        .ok_or_else(|| WebHttpError::bad_request("A branch is required."))?;
    let branch_name: String = sqlx::query_scalar("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
        .bind(branch_id)
        .fetch_one(pool)
        .await
        .map_err(WebHttpError::database)?;
    let pending_records: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM offline_queue WHERE succeeded_at IS NULL AND failed_permanently_at IS NULL",
    )
    .fetch_one(pool).await.map_err(WebHttpError::database)?;
    let last_successful_sync_at: Option<String> = sqlx::query_scalar(
        "SELECT MAX(succeeded_at) FROM offline_queue WHERE succeeded_at IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(WebHttpError::database)?;
    Ok(SyncHealthProjection {
        branch_id: branch_id.to_string(),
        branch_name,
        state: if pending_records > 0 {
            "delayed"
        } else {
            "healthy"
        },
        last_successful_sync_at,
        pending_records,
        hub_reachable: true,
    })
}

async fn drilldown_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<DrilldownProjection, WebHttpError> {
    let record_id = authorized
        .record_id
        .ok_or_else(|| WebHttpError::bad_request("A record is required."))?;
    let report = authorized
        .report
        .ok_or_else(|| WebHttpError::bad_request("A report is required."))?;
    let branch_id = branch_filter(authorized);
    let row = match report {
        Report::InventoryPosition => sqlx::query(
            "SELECT p.id, p.name AS label, COALESCE(p.sku, 'No SKU') AS secondary, COALESCE(SUM(b.quantity), 0.0) AS amount, NULL AS occurred_at, COALESCE(MAX(br.name), 'Assigned branches') AS branch_name \
             FROM products p LEFT JOIN batches b ON b.product_id = p.id LEFT JOIN branches br ON br.id = b.branch_id \
             WHERE p.id = ?3 AND b.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) AND (?2 IS NULL OR b.branch_id = ?2) GROUP BY p.id, p.name, p.sku",
        ).bind(authorized.user_id).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(WebHttpError::database)?,
        Report::PayrollSummary => sqlx::query(
            "SELECT pr.id, printf('%04d-%02d', pr.period_year, pr.period_month) AS label, \
                    pr.status || ' / ' || pr.employee_count || ' employees' AS secondary, \
                    pr.net_total AS amount, pr.created_at AS occurred_at, \
                    COALESCE(b.name, 'All assigned branches') AS branch_name \
             FROM payroll_runs pr LEFT JOIN branches b ON b.id = pr.branch_id \
             WHERE pr.id = ?3 \
               AND (pr.branch_id IS NULL OR pr.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1)) \
               AND (?2 IS NULL OR pr.branch_id IS NULL OR pr.branch_id = ?2) LIMIT 1",
        ).bind(authorized.user_id).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(WebHttpError::database)?,
        Report::AuditSummary => sqlx::query(
            "SELECT a.id, a.action AS label, \
                    COALESCE(a.outcome, 'recorded') || ' / ' || COALESCE(a.permission_key, 'general') AS secondary, \
                    0.0 AS amount, a.created_at AS occurred_at, \
                    COALESCE(b.name, 'All assigned branches') AS branch_name \
             FROM audit_log a LEFT JOIN branches b ON b.id = a.branch_id \
             WHERE a.id = ?3 \
               AND (a.branch_id IS NULL OR a.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1)) \
               AND (?2 IS NULL OR a.branch_id IS NULL OR a.branch_id = ?2) LIMIT 1",
        ).bind(authorized.user_id).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(WebHttpError::database)?,
        Report::SalesSummary | Report::ProfitAndLoss | Report::ZReport | Report::TaxSummary => sqlx::query(
            "SELECT s.id, 'Sale ' || s.sale_number AS label, s.payment_status AS secondary, s.total AS amount, s.created_at AS occurred_at, b.name AS branch_name \
             FROM sales s JOIN branches b ON b.id = s.branch_id WHERE s.id = ?3 AND s.status = 'completed' \
               AND s.branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = ?1) AND (?2 IS NULL OR s.branch_id = ?2) LIMIT 1",
        ).bind(authorized.user_id).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(WebHttpError::database)?,
    }.ok_or_else(|| WebHttpError::not_found("The requested report row was not found."))?;
    let label: String = row.try_get("label").map_err(WebHttpError::database)?;
    let secondary: String = row.try_get("secondary").map_err(WebHttpError::database)?;
    let amount: f64 = row.try_get("amount").map_err(WebHttpError::database)?;
    let occurred_at: Option<String> = row.try_get("occurred_at").map_err(WebHttpError::database)?;
    let branch_name: String = row.try_get("branch_name").map_err(WebHttpError::database)?;
    let related = CursorPage {
        items: vec![ReportRowProjection {
            id: record_id.to_string(),
            label: label.clone(),
            secondary: secondary.clone(),
            value: if report == Report::InventoryPosition {
                format!("{amount:.2} units")
            } else {
                format_kes(amount)
            },
            occurred_at: occurred_at.clone(),
        }],
        next_cursor: None,
        has_more: false,
    };
    Ok(DrilldownProjection {
        id: record_id.to_string(),
        title: label,
        subtitle: report_definition(report).title.to_string(),
        branch_name,
        fields: vec![
            FieldProjection {
                label: "Status".to_string(),
                value: secondary,
            },
            FieldProjection {
                label: "Value".to_string(),
                value: if report == Report::InventoryPosition {
                    format!("{amount:.2} units")
                } else {
                    format_kes(amount)
                },
            },
            FieldProjection {
                label: "Recorded".to_string(),
                value: occurred_at.unwrap_or_else(|| "Not recorded".to_string()),
            },
        ],
        related,
    })
}

async fn profile_projection(
    state: &ReadOnlyWebState,
    session: &StoredSession,
) -> Result<ProfileProjection, WebHttpError> {
    let rows = sqlx::query(
        "SELECT b.id, b.name FROM branches b JOIN user_branches ub ON ub.branch_id = b.id \
         WHERE ub.user_id = ?1 AND b.active = 1 ORDER BY ub.is_primary DESC, b.name",
    )
    .bind(&session.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(WebHttpError::database)?;
    let assigned = rows
        .into_iter()
        .filter_map(|row| {
            let id: String = row.try_get("id").ok()?;
            if !session.assigned_branch_ids.contains(&id) {
                return None;
            }
            Some(AssignedBranchProjection {
                id,
                name: row.try_get("name").ok()?,
            })
        })
        .collect();
    let (role, role_label) = match session.role {
        SessionRole::Manager => ("manager", "Manager"),
        SessionRole::Viewer => ("viewer", "Viewer"),
    };
    Ok(ProfileProjection {
        session_id: session.session_id.clone(),
        user_id: session.user_id.clone(),
        role,
        readonly: true,
        display_name: session.display_name.clone(),
        role_label,
        assigned_branches: assigned,
        permissions: session.permissions.clone(),
        session_issued_at: timestamp_iso(session.issued_at_unix_seconds)?,
        session_expires_at: timestamp_iso(session.expires_at_unix_seconds)?,
        connected_hub_name: state.hub_name.to_string(),
        device_label: session.device_label.clone(),
    })
}

fn paged<T, F>(
    rows: Vec<sqlx::sqlite::SqliteRow>,
    limit: usize,
    offset: usize,
    map: F,
) -> Result<CursorPage<T>, WebHttpError>
where
    F: Fn(sqlx::sqlite::SqliteRow) -> Result<T, WebHttpError>,
{
    let has_more = rows.len() > limit;
    let items = rows
        .into_iter()
        .take(limit)
        .map(map)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(CursorPage {
        items,
        next_cursor: has_more.then(|| format!("o_{}", offset + limit)),
        has_more,
    })
}

fn cursor_offset(cursor: Option<&str>) -> Result<usize, WebHttpError> {
    match cursor {
        None => Ok(0),
        Some(value) => value
            .strip_prefix("o_")
            .and_then(|raw| raw.parse::<usize>().ok())
            .filter(|offset| *offset <= 1_000_000)
            .ok_or_else(|| WebHttpError::bad_request("The cursor is invalid.")),
    }
}

fn format_kes(value: f64) -> String {
    format!("KES {value:.2}")
}

fn timestamp_iso(value: i64) -> Result<String, WebHttpError> {
    chrono::DateTime::from_timestamp(value, 0)
        .map(|date| date.to_rfc3339())
        .ok_or_else(|| WebHttpError::unauthorized("A valid browser session is required."))
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
