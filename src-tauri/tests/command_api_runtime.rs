use std::sync::Arc;

use chrono::{Duration, Utc};
use omnix_lib::network::{build_router, ServerState};
use parking_lot::RwLock;
use sha2::{Digest, Sha256};
use sqlx::sqlite::SqlitePoolOptions;
use uuid::Uuid;

const SCHEMA: &str = r#"
CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT, role TEXT, active INTEGER);
CREATE TABLE devices(id TEXT PRIMARY KEY, approved INTEGER);
CREATE TABLE branches(id TEXT PRIMARY KEY, active INTEGER);
CREATE TABLE user_branches(user_id TEXT, branch_id TEXT);
CREATE TABLE roles(id TEXT PRIMARY KEY);
CREATE TABLE permissions(key TEXT PRIMARY KEY);
CREATE TABLE role_permissions(role_id TEXT, permission_key TEXT, effect TEXT);
CREATE TABLE groups(id TEXT PRIMARY KEY);
CREATE TABLE group_members(group_id TEXT, user_id TEXT);
CREATE TABLE user_roles(user_id TEXT, role_id TEXT, branch_id TEXT, module_id TEXT);
CREATE TABLE group_roles(group_id TEXT, role_id TEXT, branch_id TEXT, module_id TEXT);
CREATE TABLE permission_overrides(subject_type TEXT, subject_id TEXT, permission_key TEXT, effect TEXT, branch_id TEXT, module_id TEXT);
CREATE TABLE local_licenses(variant TEXT, modules TEXT, status TEXT, trial_ends_at TEXT, activated_at TEXT);
CREATE TABLE license(id TEXT PRIMARY KEY);
CREATE TABLE authenticated_sessions(
 id TEXT PRIMARY KEY, token_hash BLOB UNIQUE, user_id TEXT, node_id TEXT,
 access_mode TEXT, authentication_level TEXT, branch_local INTEGER,
 issued_at TEXT, expires_at TEXT, revoked_at TEXT
);
CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT, category TEXT);
CREATE TABLE api_tokens(
 token TEXT PRIMARY KEY, token_hash BLOB, token_scope TEXT, legacy_enabled INTEGER,
 device_name TEXT, device_fingerprint TEXT, revoked INTEGER, last_seen_at TEXT
);
CREATE TABLE protected_rows(id INTEGER PRIMARY KEY);
INSERT INTO protected_rows VALUES(1);
INSERT INTO settings VALUES('network.legacy_trusted_lan','0','network');
"#;

struct Fixture {
    address: std::net::SocketAddr,
    pool: sqlx::SqlitePool,
    token: String,
    user_id: String,
    node_id: String,
    allowed_branch: String,
    denied_branch: String,
    task: tokio::task::JoinHandle<()>,
}

async fn fixture(access: &str) -> Fixture {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(SCHEMA).execute(&pool).await.unwrap();
    let user_id = Uuid::new_v4().to_string();
    let node_id = Uuid::new_v4().to_string();
    let allowed_branch = Uuid::new_v4().to_string();
    let denied_branch = Uuid::new_v4().to_string();
    let session_id = Uuid::new_v4().to_string();
    let token = format!("typed-{}", Uuid::new_v4());
    let hash = Sha256::digest(token.as_bytes()).to_vec();
    let now = Utc::now();
    sqlx::query("INSERT INTO users VALUES(?1,'operator','manager',1)")
        .bind(&user_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO devices VALUES(?1,1)")
        .bind(&node_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO branches VALUES(?1,1), (?2,1)")
        .bind(&allowed_branch)
        .bind(&denied_branch)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO user_branches VALUES(?1,?2)")
        .bind(&user_id)
        .bind(&allowed_branch)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO roles VALUES('role_manager')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO user_roles VALUES(?1,'role_manager',NULL,NULL)")
        .bind(&user_id)
        .execute(&pool)
        .await
        .unwrap();
    for permission in ["inventory.view", "inventory.edit"] {
        sqlx::query("INSERT INTO permissions VALUES(?1)")
            .bind(permission)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO role_permissions VALUES('role_manager',?1,'allow')")
            .bind(permission)
            .execute(&pool)
            .await
            .unwrap();
    }
    sqlx::query("INSERT INTO local_licenses VALUES('core','[\"core\"]','active',NULL,?1)")
        .bind(now.to_rfc3339())
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO authenticated_sessions VALUES(?1,?2,?3,?4,?5,'user',0,?6,?7,NULL)")
        .bind(session_id)
        .bind(hash)
        .bind(&user_id)
        .bind(&node_id)
        .bind(access)
        .bind((now - Duration::minutes(1)).to_rfc3339())
        .bind((now + Duration::hours(1)).to_rfc3339())
        .execute(&pool)
        .await
        .unwrap();
    let app = build_router(ServerState {
        pool: pool.clone(),
        business_name: Arc::new(RwLock::new("Runtime test".to_string())),
        sync: None,
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .await
        .unwrap();
    });
    Fixture {
        address,
        pool,
        token,
        user_id,
        node_id,
        allowed_branch,
        denied_branch,
        task,
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn runtime_rejects_unauthorised_branch_projection() {
    let fixture = fixture("desktop").await;
    let response = reqwest::Client::new()
        .post(format!(
            "http://{}/api/v1/reads/android/inventory",
            fixture.address
        ))
        .bearer_auth(&fixture.token)
        .json(&serde_json::json!({
            "schemaVersion":1,"requestId":Uuid::new_v4(),"projection":"android.inventory.v1",
            "nodeId":fixture.node_id,"userId":fixture.user_id,
            "branchScope":{"kind":"branch","branchId":fixture.denied_branch},
            "page":{"limit":10},"filter":{}
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
    assert_eq!(
        response.json::<serde_json::Value>().await.unwrap()["code"],
        "branch_access_denied"
    );
    fixture.task.abort();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn runtime_rejects_mutation_from_read_only_principal() {
    let fixture = fixture("browser_read_only").await;
    let response = reqwest::Client::new().post(format!("http://{}/api/v1/commands/inventory/branch-item", fixture.address))
        .bearer_auth(&fixture.token).json(&serde_json::json!({
            "schemaVersion":1,"commandId":Uuid::new_v4(),"commandType":"inventory.upsertBranchItem.v1",
            "nodeId":fixture.node_id,"userId":fixture.user_id,"branchId":fixture.allowed_branch,
            "expectedRevision":0,"issuedAt":Utc::now(),"payload":{
                "productId":Uuid::new_v4(),"name":"Blocked item","sku":"BLOCK-1","unit":"pcs",
                "buyingPriceMinor":100,"sellingPriceMinor":200,"reorderLevelMilli":1000,"active":true
            }
        })).send().await.unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
    assert_eq!(
        response.json::<serde_json::Value>().await.unwrap()["code"],
        "mutation_not_allowed"
    );
    fixture.task.abort();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn runtime_rejects_arbitrary_sql_when_legacy_flag_is_off() {
    let fixture = fixture("desktop").await;
    let response = reqwest::Client::new()
        .post(format!("http://{}/api/db/execute", fixture.address))
        .bearer_auth("even-a-valid-looking-legacy-token")
        .json(&serde_json::json!({"sql":"DELETE FROM protected_rows","params":[]}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
    let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM protected_rows")
        .fetch_one(&fixture.pool)
        .await
        .unwrap();
    assert_eq!(remaining, 1);
    fixture.task.abort();
}
