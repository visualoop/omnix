use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::authorization::{
    authorize_read, AuthenticationLevel, AuthorizationRequirement, ReadAuthorizationRequirement,
    SessionContext,
};
use super::contracts::{
    validate_projection_page, validate_read_request, validate_search, ProjectionPage,
    ReadProjectionRequest, ReadProjectionResponse, ValidatedPage, API_SCHEMA_V1,
};
use super::error::CommandApiError;

pub const ANDROID_INVENTORY_PROJECTION: &str = "android.inventory.v1";
pub const ANDROID_OPEN_PURCHASES_PROJECTION: &str = "android.openPurchases.v1";
pub const TILL_RECENT_SALES_PROJECTION: &str = "till.recentSales.v1";
pub const TILL_CURRENT_SHIFT_PROJECTION: &str = "till.currentShift.v1";

const CORE_MODULE: &str = "core";
const READ_ROLES: &[&str] = &["role_owner", "role_manager", "role_cashier", "role_viewer"];
const TILL_ROLES: &[&str] = &["role_owner", "role_manager", "role_cashier"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidInventoryFilterV1 {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub changed_after_revision: Option<u64>,
    #[serde(default)]
    pub include_inactive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidInventoryRowV1 {
    pub branch_id: String,
    pub product_id: String,
    pub sku: String,
    pub name: String,
    pub quantity_milli: i64,
    pub selling_price_minor: u64,
    pub active: bool,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidOpenPurchasesFilterV1 {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub supplier_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidOpenPurchaseRowV1 {
    pub branch_id: String,
    pub purchase_order_id: String,
    pub po_number: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub status: String,
    pub total_minor: u64,
    pub expected_date: Option<String>,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TillRecentSalesFilterV1 {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub opened_after: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TillRecentSaleRowV1 {
    pub branch_id: String,
    pub sale_id: String,
    pub sale_number: u64,
    pub customer_name: Option<String>,
    pub total_minor: u64,
    pub payment_status: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TillCurrentShiftFilterV1 {
    #[serde(default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TillShiftRowV1 {
    pub branch_id: String,
    pub shift_id: String,
    pub user_id: String,
    pub opened_at: DateTime<Utc>,
    pub opening_balance_minor: u64,
    pub expected_closing_minor: Option<u64>,
    pub cash_in_minor: u64,
    pub cash_out_minor: u64,
    pub status: String,
    pub revision: u64,
}

/// DB implementations must use the matching fixed SQL leaf under `query/`, bind the serialized
/// server-authorized branch list as parameter 1, and never construct predicates from client text.
pub trait AndroidInventoryQuery {
    fn fetch_android_inventory(
        &mut self,
        authorized_branches: &[String],
        filter: &AndroidInventoryFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<AndroidInventoryRowV1>, CommandApiError>;
}

pub trait AndroidOpenPurchasesQuery {
    fn fetch_android_open_purchases(
        &mut self,
        authorized_branches: &[String],
        filter: &AndroidOpenPurchasesFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<AndroidOpenPurchaseRowV1>, CommandApiError>;
}

pub trait TillRecentSalesQuery {
    fn fetch_till_recent_sales(
        &mut self,
        authorized_branches: &[String],
        filter: &TillRecentSalesFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<TillRecentSaleRowV1>, CommandApiError>;
}

pub trait TillCurrentShiftQuery {
    fn fetch_till_current_shift(
        &mut self,
        authorized_branches: &[String],
        filter: &TillCurrentShiftFilterV1,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<TillShiftRowV1>, CommandApiError>;
}

pub fn handle_android_inventory_read<Q>(
    session: &SessionContext,
    request: &ReadProjectionRequest<AndroidInventoryFilterV1>,
    query: &mut Q,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<AndroidInventoryRowV1>, CommandApiError>
where
    Q: AndroidInventoryQuery,
{
    let page = validate_read_request(request, ANDROID_INVENTORY_PROJECTION)?;
    validate_search(request.filter.search.as_deref())?;
    let branches = authorize(session, request, READ_ROLES, "inventory.view", true, now)?;
    let result = query.fetch_android_inventory(&branches, &request.filter, &page)?;
    validate_rows(&result, &branches, page.limit, |row| &row.branch_id)?;
    response(request, page.limit, result, now)
}

pub fn handle_android_open_purchases_read<Q>(
    session: &SessionContext,
    request: &ReadProjectionRequest<AndroidOpenPurchasesFilterV1>,
    query: &mut Q,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<AndroidOpenPurchaseRowV1>, CommandApiError>
where
    Q: AndroidOpenPurchasesQuery,
{
    let page = validate_read_request(request, ANDROID_OPEN_PURCHASES_PROJECTION)?;
    validate_search(request.filter.search.as_deref())?;
    if let Some(supplier_id) = &request.filter.supplier_id {
        super::contracts::validate_read_resource_id(supplier_id, "supplierId")?;
    }
    let branches = authorize(
        session,
        request,
        READ_ROLES,
        "purchase_orders.view",
        true,
        now,
    )?;
    let result = query.fetch_android_open_purchases(&branches, &request.filter, &page)?;
    validate_rows(&result, &branches, page.limit, |row| &row.branch_id)?;
    response(request, page.limit, result, now)
}

pub fn handle_till_recent_sales_read<Q>(
    session: &SessionContext,
    request: &ReadProjectionRequest<TillRecentSalesFilterV1>,
    query: &mut Q,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<TillRecentSaleRowV1>, CommandApiError>
where
    Q: TillRecentSalesQuery,
{
    let page = validate_read_request(request, TILL_RECENT_SALES_PROJECTION)?;
    validate_search(request.filter.search.as_deref())?;
    let branches = authorize(session, request, TILL_ROLES, "sales.view", false, now)?;
    let result = query.fetch_till_recent_sales(&branches, &request.filter, &page)?;
    validate_rows(&result, &branches, page.limit, |row| &row.branch_id)?;
    response(request, page.limit, result, now)
}

pub fn handle_till_current_shift_read<Q>(
    session: &SessionContext,
    request: &ReadProjectionRequest<TillCurrentShiftFilterV1>,
    query: &mut Q,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<TillShiftRowV1>, CommandApiError>
where
    Q: TillCurrentShiftQuery,
{
    let page = validate_read_request(request, TILL_CURRENT_SHIFT_PROJECTION)?;
    if let Some(user_id) = &request.filter.user_id {
        super::contracts::validate_read_resource_id(user_id, "userId")?;
        if user_id != &session.principal.user_id
            && !session
                .principal
                .roles
                .iter()
                .any(|role| matches!(role.role_id.as_str(), "role_owner" | "role_manager"))
        {
            return Err(CommandApiError::RoleAccessDenied);
        }
    }
    let branches = authorize(
        session,
        request,
        TILL_ROLES,
        "cash_register.use",
        false,
        now,
    )?;
    let result = query.fetch_till_current_shift(&branches, &request.filter, &page)?;
    validate_rows(&result, &branches, page.limit, |row| &row.branch_id)?;
    response(request, page.limit, result, now)
}

fn authorize<F>(
    session: &SessionContext,
    request: &ReadProjectionRequest<F>,
    roles: &'static [&'static str],
    permission: &'static str,
    allow_all_assigned: bool,
    now: DateTime<Utc>,
) -> Result<Vec<String>, CommandApiError> {
    authorize_read(
        session,
        request,
        ReadAuthorizationRequirement {
            access: AuthorizationRequirement {
                allowed_roles: roles,
                permission,
                module_id: CORE_MODULE,
                minimum_authentication: AuthenticationLevel::User,
            },
            allow_all_assigned,
        },
        now,
    )
    .map(|branches| branches.0)
}

fn validate_rows<T, B>(
    result: &ProjectionPage<T>,
    authorized_branches: &[String],
    limit: u16,
    branch_of: B,
) -> Result<(), CommandApiError>
where
    T: Serialize,
    B: Fn(&T) -> &String,
{
    validate_projection_page(result, limit)?;
    if result
        .items
        .iter()
        .any(|row| !authorized_branches.contains(branch_of(row)))
    {
        return Err(CommandApiError::InvalidProjectionResult);
    }
    Ok(())
}

fn response<F, T>(
    request: &ReadProjectionRequest<F>,
    limit: u16,
    result: ProjectionPage<T>,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<T>, CommandApiError> {
    Ok(ReadProjectionResponse {
        schema_version: API_SCHEMA_V1,
        request_id: request.request_id.clone(),
        projection: request.projection.clone(),
        branch_scope: request.branch_scope.clone(),
        generated_at: now,
        limit,
        items: result.items,
        next_cursor: result.next_cursor,
    })
}
