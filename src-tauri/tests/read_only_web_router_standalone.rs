#[path = "../src/network/read_only_policy.rs"]
pub mod read_only_policy;

pub mod network {
    pub use crate::read_only_policy;
}

#[path = "../src/network/read_only_web.rs"]
mod read_only_web;

use axum::http::{HeaderMap, HeaderValue, Method, Uri};
use read_only_web::{
    build_read_only_web_router, dispatch_read_request, session_cookie_header, session_token_hash,
    ReadOnlyWebState, MAX_SESSION_SECONDS,
};
use serde_json::Value;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

const ORIGIN: &str = "http://127.0.0.1:39420";
const TOKEN: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async fn fixture() -> (SqlitePool, ReadOnlyWebState) {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(
        "CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, active INTEGER NOT NULL);\
         CREATE TABLE branches (id TEXT PRIMARY KEY, code TEXT, name TEXT, address TEXT, active INTEGER, is_default INTEGER);\
         CREATE TABLE user_branches (user_id TEXT, branch_id TEXT, is_primary INTEGER);\
         CREATE TABLE web_read_sessions (id TEXT, token_hash TEXT, user_id TEXT, role TEXT, read_only INTEGER, assigned_branch_ids_json TEXT, permissions_json TEXT, device_label TEXT, issued_at_unix_seconds INTEGER, expires_at_unix_seconds INTEGER, revoked_at TEXT);\
         CREATE TABLE sales (id TEXT, sale_number INTEGER, total REAL, tax_amount REAL, payment_status TEXT, status TEXT, created_at TEXT, branch_id TEXT);\
         CREATE TABLE products (id TEXT, name TEXT, sku TEXT, active INTEGER, reorder_level INTEGER, updated_at TEXT);\
         CREATE TABLE batches (id TEXT, product_id TEXT, branch_id TEXT, quantity REAL);\
         CREATE TABLE notifications (id TEXT, severity TEXT, title TEXT, body TEXT, metadata TEXT, read_at TEXT, snoozed_until TEXT, created_at TEXT);\
         CREATE TABLE offline_queue (id TEXT, succeeded_at TEXT, failed_permanently_at TEXT);\
         CREATE TABLE audit_log (id TEXT, action TEXT, outcome TEXT, permission_key TEXT, branch_id TEXT, created_at TEXT);\
         CREATE TABLE payroll_runs (id TEXT, period_year INTEGER, period_month INTEGER, status TEXT, gross_total REAL, deductions_total REAL, net_total REAL, employee_count INTEGER, branch_id TEXT, created_at TEXT);",
    )
    .execute(&pool)
    .await
    .unwrap();
    let now = chrono::Utc::now().timestamp();
    sqlx::query("INSERT INTO users VALUES ('user-1', 'Amina Manager', 1)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO branches VALUES ('branch-main', 'MAIN', 'Main Branch', 'Nairobi', 1, 1), ('branch-secret', 'SEC', 'Secret Branch', 'Mombasa', 1, 0)")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO user_branches VALUES ('user-1', 'branch-main', 1)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO web_read_sessions VALUES ('session-1', ?1, 'user-1', 'manager', 1, '[\"branch-main\"]', '[\"reports.view\"]', 'Safari on tablet', ?2, ?3, NULL)")
        .bind(session_token_hash(TOKEN)).bind(now - 60).bind(now + 3600)
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO sales VALUES ('sale-1', 1, 1200, 165.52, 'paid', 'completed', datetime('now'), 'branch-main')")
        .execute(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO products VALUES ('product-1', 'Soap', 'SOAP-1', 1, 10, datetime('now'))",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO batches VALUES ('batch-1', 'product-1', 'branch-main', 4)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO notifications VALUES ('alert-1', 'warning', 'Low stock', 'Soap is below reorder level', '{\"branchId\":\"branch-main\"}', NULL, NULL, datetime('now'))")
        .execute(&pool).await.unwrap();
    let state = ReadOnlyWebState::new(pool.clone(), ORIGIN.to_string(), "Main Hub".to_string());
    (pool, state)
}

fn headers(origin: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        "cookie",
        HeaderValue::from_str(&format!("omnix_web_session={TOKEN}")).unwrap(),
    );
    headers.insert("origin", HeaderValue::from_str(origin).unwrap());
    headers.insert("sec-fetch-site", HeaderValue::from_static("same-origin"));
    headers
}

#[test]
fn cookie_contract_is_httponly_strict_bounded_and_hashes_tokens() {
    let value = session_cookie_header(TOKEN, MAX_SESSION_SECONDS, true).unwrap();
    let value = value.to_str().unwrap();
    assert!(value.contains("HttpOnly"));
    assert!(value.contains("SameSite=Strict"));
    assert!(value.contains("Path=/"));
    assert!(value.contains("Secure"));
    assert!(!session_token_hash(TOKEN).contains(TOKEN));
    assert!(session_cookie_header("short", 60, false).is_err());
    assert!(session_cookie_header(TOKEN, MAX_SESSION_SECONDS + 1, false).is_err());
}

#[tokio::test]
async fn dispatch_enforces_session_origin_branch_permission_and_security_headers() {
    let (_pool, state) = fixture().await;
    let profile = dispatch_read_request(
        &state,
        &Method::GET,
        &"/api/web/v1/profile".parse::<Uri>().unwrap(),
        &headers(ORIGIN),
    )
    .await
    .unwrap();
    assert_eq!(profile.status(), 200);
    assert_eq!(profile.headers()["cache-control"], "no-store, private");
    assert_eq!(profile.headers()["x-content-type-options"], "nosniff");
    let body = axum::body::to_bytes(profile.into_body(), 262_144)
        .await
        .unwrap();
    let profile: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(profile["readonly"], true);
    assert_eq!(profile["sessionId"], "session-1");
    assert_eq!(profile["assignedBranches"].as_array().unwrap().len(), 1);
    assert!(profile.get("passwordHash").is_none());

    let unassigned = dispatch_read_request(
        &state,
        &Method::GET,
        &"/api/web/v1/alerts?branchId=branch-secret".parse().unwrap(),
        &headers(ORIGIN),
    )
    .await
    .unwrap_err();
    assert_eq!(
        axum::response::IntoResponse::into_response(unassigned).status(),
        403
    );

    let sensitive = dispatch_read_request(
        &state,
        &Method::GET,
        &"/api/web/v1/reports/rows?scope=branch&branchId=branch-main&reportId=profit-and-loss"
            .parse()
            .unwrap(),
        &headers(ORIGIN),
    )
    .await
    .unwrap_err();
    assert_eq!(
        axum::response::IntoResponse::into_response(sensitive).status(),
        403
    );

    let sql = dispatch_read_request(
        &state,
        &Method::GET,
        &"/api/web/v1/branches?sql=SELECT%20*%20FROM%20users"
            .parse()
            .unwrap(),
        &headers(ORIGIN),
    )
    .await
    .unwrap_err();
    let sql_response = axum::response::IntoResponse::into_response(sql);
    assert_eq!(sql_response.status(), 400);
    assert_eq!(sql_response.headers()["cache-control"], "no-store, private");
    let sql_body = axum::body::to_bytes(sql_response.into_body(), 262_144)
        .await
        .unwrap();
    let sql_error: Value = serde_json::from_slice(&sql_body).unwrap();
    assert_eq!(sql_error["error"]["code"], "BAD_QUERY");

    let cross_origin = dispatch_read_request(
        &state,
        &Method::GET,
        &"/api/web/v1/profile".parse().unwrap(),
        &headers("https://evil.example"),
    )
    .await
    .unwrap_err();
    assert_eq!(
        axum::response::IntoResponse::into_response(cross_origin).status(),
        403
    );
}

#[tokio::test]
async fn dedicated_axum_listener_has_only_exact_get_projections() {
    let (_pool, state) = fixture().await;
    let app = build_read_only_web_router(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    let client = reqwest::Client::new();
    let request = |method: reqwest::Method, path: &str| {
        client
            .request(method, format!("http://{address}{path}"))
            .header("cookie", format!("omnix_web_session={TOKEN}"))
            .header("origin", ORIGIN)
            .header("sec-fetch-site", "same-origin")
    };

    let profile = request(reqwest::Method::GET, "/api/web/v1/profile")
        .send()
        .await
        .unwrap();
    assert_eq!(profile.status(), 200);
    let mutation = request(reqwest::Method::POST, "/api/web/v1/profile")
        .send()
        .await
        .unwrap();
    assert_eq!(mutation.status(), 405);
    for path in [
        "/api/db/query",
        "/api/db/execute",
        "/api/web/v1/sql",
        "/api/web/v1/settings",
        "/api/web/v1/pos",
    ] {
        let response = request(reqwest::Method::GET, path).send().await.unwrap();
        assert_eq!(response.status(), 404, "{path} must not be exposed");
    }
    task.abort();
}
