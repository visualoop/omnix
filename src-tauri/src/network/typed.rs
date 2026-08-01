use std::future::Future;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::de::DeserializeOwned;
use serde::Serialize;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::command_api::authorization::{SessionAccess, SessionContext};
use crate::command_api::contracts::{
    CommandEnvelope, ProjectionPage, ReadProjectionRequest, ValidatedPage,
};
use crate::command_api::domain_commands::{
    handle_complete_sale, handle_create_purchase_order, handle_record_stock_movement,
    handle_upsert_branch_customer, handle_upsert_branch_item, CompleteSaleResultV1, CompleteSaleV1,
    CreatePurchaseOrderResultV1, CreatePurchaseOrderV1, RecordStockMovementResultV1,
    RecordStockMovementV1, UpsertBranchCustomerResultV1, UpsertBranchCustomerV1,
    UpsertBranchItemResultV1, UpsertBranchItemV1,
};
use crate::command_api::error::CommandApiError;
use crate::command_api::idempotency::{
    AtomicCommitContext, IdempotencyOutcome, IdempotentMutation,
};
use crate::command_api::local_auth::{
    authenticate_branch_local, BranchLocalAuthenticationStore, BranchLocalLoginV1,
    IssuedLocalSession, LocalCredentialRecord, LocalPasswordVerifier, MAX_LOCAL_SESSION_TTL,
};
use crate::command_api::pilot_inventory::{
    handle_inventory_alerts_read, handle_set_reorder_level, InventoryAlertRow,
    InventoryAlertsFilter, InventoryAlertsQuery, SetReorderLevel, SetReorderLevelResult,
};
use crate::command_api::projections::{
    handle_android_inventory_read, handle_android_open_purchases_read,
    handle_till_current_shift_read, handle_till_recent_sales_read, AndroidInventoryFilterV1,
    AndroidInventoryQuery, AndroidInventoryRowV1, AndroidOpenPurchaseRowV1,
    AndroidOpenPurchasesFilterV1, AndroidOpenPurchasesQuery, TillCurrentShiftFilterV1,
    TillCurrentShiftQuery, TillRecentSaleRowV1, TillRecentSalesFilterV1, TillRecentSalesQuery,
    TillShiftRowV1,
};
use crate::db::command_api as db;
use crate::network::ServerState;

#[derive(Debug)]
pub struct TypedApiError(CommandApiError);

impl From<CommandApiError> for TypedApiError {
    fn from(value: CommandApiError) -> Self {
        Self(value)
    }
}

impl IntoResponse for TypedApiError {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.0.http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self.0)).into_response()
    }
}

fn decode<T: DeserializeOwned>(body: &[u8]) -> Result<T, TypedApiError> {
    serde_json::from_slice(body).map_err(|_| {
        TypedApiError(CommandApiError::InvalidEnvelope {
            reason: "JSON body does not match the allowlisted schema".to_string(),
        })
    })
}

fn bearer(headers: &HeaderMap) -> Result<&str, TypedApiError> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or_else(|| TypedApiError(CommandApiError::AuthenticationRequired))
}

async fn session(
    state: &ServerState,
    headers: &HeaderMap,
) -> Result<SessionContext, TypedApiError> {
    db::resolve_session(&state.pool, bearer(headers)?, Utc::now())
        .await
        .map_err(Into::into)
}

fn wait<F: Future>(future: F) -> F::Output {
    tokio::task::block_in_place(|| tokio::runtime::Handle::current().block_on(future))
}

struct Repository {
    pool: sqlx::SqlitePool,
}
macro_rules! mutation_port {
    ($payload:ty, $result:ty, $function:ident) => {
        impl IdempotentMutation<$payload, $result> for Repository {
            fn execute_once(
                &mut self,
                envelope: &CommandEnvelope<$payload>,
                context: &AtomicCommitContext,
            ) -> Result<IdempotencyOutcome<$result>, CommandApiError> {
                wait(db::$function(&self.pool, envelope, context))
            }
        }
    };
}
mutation_port!(CompleteSaleV1, CompleteSaleResultV1, complete_sale);
mutation_port!(
    UpsertBranchItemV1,
    UpsertBranchItemResultV1,
    upsert_branch_item
);
mutation_port!(
    UpsertBranchCustomerV1,
    UpsertBranchCustomerResultV1,
    upsert_branch_customer
);
mutation_port!(
    CreatePurchaseOrderV1,
    CreatePurchaseOrderResultV1,
    create_purchase_order
);
mutation_port!(
    RecordStockMovementV1,
    RecordStockMovementResultV1,
    record_stock_movement
);
mutation_port!(SetReorderLevel, SetReorderLevelResult, set_reorder_level);

impl AndroidInventoryQuery for Repository {
    fn fetch_android_inventory(
        &mut self,
        branches: &[String],
        filter: &AndroidInventoryFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<AndroidInventoryRowV1>, CommandApiError> {
        wait(db::android_inventory(&self.pool, branches, filter, page))
    }
}
impl AndroidOpenPurchasesQuery for Repository {
    fn fetch_android_open_purchases(
        &mut self,
        branches: &[String],
        filter: &AndroidOpenPurchasesFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<AndroidOpenPurchaseRowV1>, CommandApiError> {
        wait(db::android_open_purchases(
            &self.pool, branches, filter, page,
        ))
    }
}
impl TillRecentSalesQuery for Repository {
    fn fetch_till_recent_sales(
        &mut self,
        branches: &[String],
        filter: &TillRecentSalesFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<TillRecentSaleRowV1>, CommandApiError> {
        wait(db::recent_sales(&self.pool, branches, filter, page))
    }
}
impl TillCurrentShiftQuery for Repository {
    fn fetch_till_current_shift(
        &mut self,
        branches: &[String],
        filter: &TillCurrentShiftFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<TillShiftRowV1>, CommandApiError> {
        wait(db::current_shift(&self.pool, branches, filter, page))
    }
}
impl InventoryAlertsQuery for Repository {
    fn fetch_inventory_alerts(
        &mut self,
        branches: &[String],
        filter: &InventoryAlertsFilter,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<InventoryAlertRow>, CommandApiError> {
        wait(db::reorder_alerts(&self.pool, branches, filter, page))
    }
}

struct LocalStore {
    pool: sqlx::SqlitePool,
}
impl BranchLocalAuthenticationStore for LocalStore {
    fn find_local_credential(
        &mut self,
        node_id: &str,
        branch_id: &str,
        username: &str,
    ) -> Result<Option<LocalCredentialRecord>, CommandApiError> {
        wait(db::find_local_credential(
            &self.pool,
            node_id,
            branch_id,
            username,
            Utc::now(),
        ))
    }
    fn record_failed_attempt(
        &mut self,
        request_id: &str,
        node_id: &str,
        branch_id: &str,
        now: chrono::DateTime<Utc>,
    ) -> Result<(), CommandApiError> {
        wait(db::record_failed_login(
            &self.pool, request_id, node_id, branch_id, now,
        ))
    }
    fn issue_local_session(
        &mut self,
        credential: &LocalCredentialRecord,
        access: SessionAccess,
        now: chrono::DateTime<Utc>,
        expires_at: chrono::DateTime<Utc>,
    ) -> Result<IssuedLocalSession, CommandApiError> {
        wait(db::issue_local_session(
            &self.pool, credential, access, now, expires_at,
        ))
    }
}

static DUMMY_HASH: Lazy<String> = Lazy::new(|| {
    let salt = SaltString::encode_b64(b"omnix-command-api-dummy-salt").expect("valid static salt");
    Argon2::default()
        .hash_password(b"not-a-user-password", &salt)
        .expect("dummy hash")
        .to_string()
});
struct ArgonVerifier;
impl LocalPasswordVerifier for ArgonVerifier {
    fn verify_or_dummy(&self, password: &str, password_hash: Option<&str>) -> bool {
        let hash = password_hash.unwrap_or(&DUMMY_HASH);
        PasswordHash::new(hash).is_ok_and(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        }) && password_hash.is_some()
    }
}

async fn branch_local_login(
    State(state): State<ServerState>,
    body: Bytes,
) -> Result<Json<impl Serialize>, TypedApiError> {
    let request: BranchLocalLoginV1 = decode(&body)?;
    let mut store = LocalStore { pool: state.pool };
    let result = wait(async move {
        authenticate_branch_local(
            &request,
            &mut store,
            &ArgonVerifier,
            Utc::now(),
            MAX_LOCAL_SESSION_TTL,
        )
    });
    result.map(Json).map_err(Into::into)
}

macro_rules! command_handler {
    ($name:ident,$payload:ty,$handler:ident) => {
        async fn $name(
            State(state): State<ServerState>,
            headers: HeaderMap,
            body: Bytes,
        ) -> Result<Json<IdempotencyOutcome<impl Serialize>>, TypedApiError> {
            let resolved = session(&state, &headers).await?;
            let envelope: CommandEnvelope<$payload> = decode(&body)?;
            let mut repository = Repository { pool: state.pool };
            $handler(&resolved, &envelope, &mut repository, Utc::now())
                .map(Json)
                .map_err(Into::into)
        }
    };
}
command_handler!(complete_sale, CompleteSaleV1, handle_complete_sale);
command_handler!(upsert_item, UpsertBranchItemV1, handle_upsert_branch_item);
command_handler!(
    upsert_customer,
    UpsertBranchCustomerV1,
    handle_upsert_branch_customer
);
command_handler!(
    create_purchase_order,
    CreatePurchaseOrderV1,
    handle_create_purchase_order
);
command_handler!(
    record_stock_movement,
    RecordStockMovementV1,
    handle_record_stock_movement
);
command_handler!(set_reorder_level, SetReorderLevel, handle_set_reorder_level);

macro_rules! read_handler {
    ($name:ident,$filter:ty,$handler:ident) => {
        async fn $name(
            State(state): State<ServerState>,
            headers: HeaderMap,
            body: Bytes,
        ) -> Result<Json<impl Serialize>, TypedApiError> {
            let resolved = session(&state, &headers).await?;
            let request: ReadProjectionRequest<$filter> = decode(&body)?;
            let mut repository = Repository { pool: state.pool };
            $handler(&resolved, &request, &mut repository, Utc::now())
                .map(Json)
                .map_err(Into::into)
        }
    };
}
read_handler!(
    android_inventory,
    AndroidInventoryFilterV1,
    handle_android_inventory_read
);
read_handler!(
    android_open_purchases,
    AndroidOpenPurchasesFilterV1,
    handle_android_open_purchases_read
);
read_handler!(
    till_recent_sales,
    TillRecentSalesFilterV1,
    handle_till_recent_sales_read
);
read_handler!(
    till_current_shift,
    TillCurrentShiftFilterV1,
    handle_till_current_shift_read
);
read_handler!(
    inventory_reorder_alerts,
    InventoryAlertsFilter,
    handle_inventory_alerts_read
);

fn limited(
    route: axum::routing::MethodRouter<ServerState>,
    bytes: usize,
) -> axum::routing::MethodRouter<ServerState> {
    route.layer(DefaultBodyLimit::max(bytes))
}

pub fn desktop_and_android_router() -> Router<ServerState> {
    Router::new()
        .route(
            "/api/v1/auth/branch-local-login",
            limited(post(branch_local_login), 4 * 1024),
        )
        .route(
            "/api/v1/commands/sales/complete",
            limited(post(complete_sale), 256 * 1024),
        )
        .route(
            "/api/v1/commands/inventory/branch-item",
            limited(post(upsert_item), 16 * 1024),
        )
        .route(
            "/api/v1/commands/customers/branch-customer",
            limited(post(upsert_customer), 16 * 1024),
        )
        .route(
            "/api/v1/commands/purchasing/purchase-order",
            limited(post(create_purchase_order), 256 * 1024),
        )
        .route(
            "/api/v1/commands/inventory/stock-movement",
            limited(post(record_stock_movement), 16 * 1024),
        )
        .route(
            "/api/v1/commands/inventory/reorder-level",
            limited(post(set_reorder_level), 8 * 1024),
        )
}

pub fn browser_read_router() -> Router<ServerState> {
    Router::new()
        .route(
            "/api/v1/reads/android/inventory",
            limited(post(android_inventory), 8 * 1024),
        )
        .route(
            "/api/v1/reads/android/open-purchases",
            limited(post(android_open_purchases), 8 * 1024),
        )
        .route(
            "/api/v1/reads/till/recent-sales",
            limited(post(till_recent_sales), 8 * 1024),
        )
        .route(
            "/api/v1/reads/till/current-shift",
            limited(post(till_current_shift), 8 * 1024),
        )
        .route(
            "/api/v1/reads/inventory/reorder-alerts",
            limited(post(inventory_reorder_alerts), 8 * 1024),
        )
        .layer(configured_browser_cors())
}

pub fn configured_browser_cors() -> CorsLayer {
    let configured = std::env::var("OMNIX_BROWSER_ORIGINS")
        .unwrap_or_else(|_| "http://127.0.0.1:39420,http://localhost:39420".to_string());
    let origins: Vec<HeaderValue> = configured
        .split(',')
        .filter_map(|value| value.trim().parse().ok())
        .collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::POST])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
        .max_age(std::time::Duration::from_secs(600))
}

#[cfg(test)]
mod tests {
    #[test]
    fn typed_routes_match_reviewed_manifest() {
        let mut mounted = vec![
            "/api/v1/auth/branch-local-login",
            "/api/v1/commands/sales/complete",
            "/api/v1/commands/inventory/branch-item",
            "/api/v1/commands/customers/branch-customer",
            "/api/v1/commands/purchasing/purchase-order",
            "/api/v1/commands/inventory/stock-movement",
            "/api/v1/commands/inventory/reorder-level",
            "/api/v1/reads/android/inventory",
            "/api/v1/reads/android/open-purchases",
            "/api/v1/reads/till/recent-sales",
            "/api/v1/reads/till/current-shift",
            "/api/v1/reads/inventory/reorder-alerts",
        ];
        mounted.sort_unstable();
        let mut manifest = crate::command_api::route_manifest::TYPED_ROUTE_ALLOWLIST
            .iter()
            .map(|route| route.path)
            .collect::<Vec<_>>();
        manifest.sort_unstable();
        assert_eq!(mounted, manifest);
    }
}
