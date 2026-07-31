use std::collections::BTreeSet;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::authorization::{
    authorize_command, AuthenticationLevel, AuthorizationRequirement, SessionContext,
};
use super::contracts::{
    validate_command_envelope, validate_resource_id, CommandEnvelope, MAX_SEARCH_LENGTH,
};
use super::error::CommandApiError;
use super::idempotency::{
    fingerprint_command, AtomicCommitContext, AuditEventDraft, IdempotencyOutcome,
    IdempotentMutation, OutboxEventDraft,
};

pub const COMPLETE_SALE_COMMAND: &str = "sales.complete.v1";
pub const UPSERT_BRANCH_ITEM_COMMAND: &str = "inventory.upsertBranchItem.v1";
pub const UPSERT_BRANCH_CUSTOMER_COMMAND: &str = "customers.upsertBranchCustomer.v1";
pub const CREATE_PURCHASE_ORDER_COMMAND: &str = "purchasing.createPurchaseOrder.v1";
pub const RECORD_STOCK_MOVEMENT_COMMAND: &str = "inventory.recordStockMovement.v1";

const CORE_MODULE: &str = "core";
const MAX_LINES: usize = 200;
const MAX_PAYMENTS: usize = 16;
const MAX_TEXT: usize = 2_000;
const MAX_QUANTITY_MILLI: u64 = 1_000_000_000;
const MAX_MONEY_MINOR: u64 = 100_000_000_000;
const OWNER_MANAGER: &[&str] = &["role_owner", "role_manager"];
const OPERATIONS_ROLES: &[&str] = &["role_owner", "role_manager", "role_cashier"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaleLineV1 {
    pub line_id: String,
    pub product_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
    /// Quantity in thousandths, allowing weighed goods without floating-point ambiguity.
    pub quantity_milli: u64,
    pub unit_price_minor: u64,
    pub discount_minor: u64,
    pub tax_basis_points: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SalePaymentV1 {
    pub payment_id: String,
    pub method_id: String,
    pub amount_minor: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompleteSaleV1 {
    pub sale_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<String>,
    pub lines: Vec<SaleLineV1>,
    pub payments: Vec<SalePaymentV1>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompleteSaleResultV1 {
    pub sale_id: String,
    pub sale_number: u64,
    pub total_minor: u64,
    pub payment_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertBranchItemV1 {
    pub product_id: String,
    pub name: String,
    pub sku: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub barcode: Option<String>,
    pub unit: String,
    pub buying_price_minor: u64,
    pub selling_price_minor: u64,
    pub reorder_level_milli: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertBranchItemResultV1 {
    pub product_id: String,
    pub branch_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertBranchCustomerV1 {
    pub customer_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub credit_limit_minor: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertBranchCustomerResultV1 {
    pub customer_id: String,
    pub branch_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PurchaseOrderLineV1 {
    pub line_id: String,
    pub product_id: String,
    pub quantity_milli: u64,
    pub unit_cost_minor: u64,
    pub tax_basis_points: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreatePurchaseOrderV1 {
    pub purchase_order_id: String,
    pub supplier_id: String,
    pub expected_date: Option<String>,
    pub currency: String,
    pub lines: Vec<PurchaseOrderLineV1>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreatePurchaseOrderResultV1 {
    pub purchase_order_id: String,
    pub branch_id: String,
    pub po_number: String,
    pub total_minor: u64,
    pub status: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StockMovementKindV1 {
    Adjustment,
    Damage,
    Return,
    TransferIn,
    TransferOut,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecordStockMovementV1 {
    pub movement_id: String,
    pub product_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
    pub kind: StockMovementKindV1,
    /// Signed thousandths. Zero is rejected.
    pub quantity_delta_milli: i64,
    pub reason_code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecordStockMovementResultV1 {
    pub movement_id: String,
    pub product_id: String,
    pub branch_id: String,
    pub quantity_after_milli: i64,
}

pub fn handle_complete_sale<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<CompleteSaleV1>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<CompleteSaleResultV1>, CommandApiError>
where
    R: IdempotentMutation<CompleteSaleV1, CompleteSaleResultV1>,
{
    validate_command_envelope(envelope, COMPLETE_SALE_COMMAND, now)?;
    authorize(
        session,
        envelope,
        OPERATIONS_ROLES,
        "pos.use",
        AuthenticationLevel::User,
        now,
    )?;
    require_revision(envelope.expected_revision)?;
    validate_sale(&envelope.payload)?;
    execute(
        session,
        envelope,
        repository,
        "pos.use",
        "sale.completed",
        "sale",
        &envelope.payload.sale_id,
    )
}

pub fn handle_upsert_branch_item<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<UpsertBranchItemV1>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<UpsertBranchItemResultV1>, CommandApiError>
where
    R: IdempotentMutation<UpsertBranchItemV1, UpsertBranchItemResultV1>,
{
    validate_command_envelope(envelope, UPSERT_BRANCH_ITEM_COMMAND, now)?;
    authorize(
        session,
        envelope,
        OWNER_MANAGER,
        "inventory.edit",
        AuthenticationLevel::User,
        now,
    )?;
    require_revision(envelope.expected_revision)?;
    validate_branch_item(&envelope.payload)?;
    execute(
        session,
        envelope,
        repository,
        "inventory.edit",
        "inventory.branch_item.upserted",
        "branch_item",
        &envelope.payload.product_id,
    )
}

pub fn handle_upsert_branch_customer<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<UpsertBranchCustomerV1>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<UpsertBranchCustomerResultV1>, CommandApiError>
where
    R: IdempotentMutation<UpsertBranchCustomerV1, UpsertBranchCustomerResultV1>,
{
    validate_command_envelope(envelope, UPSERT_BRANCH_CUSTOMER_COMMAND, now)?;
    authorize(
        session,
        envelope,
        OPERATIONS_ROLES,
        "customers.edit",
        AuthenticationLevel::User,
        now,
    )?;
    require_revision(envelope.expected_revision)?;
    validate_customer(&envelope.payload)?;
    execute(
        session,
        envelope,
        repository,
        "customers.edit",
        "customer.branch_record.upserted",
        "branch_customer",
        &envelope.payload.customer_id,
    )
}

pub fn handle_create_purchase_order<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<CreatePurchaseOrderV1>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<CreatePurchaseOrderResultV1>, CommandApiError>
where
    R: IdempotentMutation<CreatePurchaseOrderV1, CreatePurchaseOrderResultV1>,
{
    validate_command_envelope(envelope, CREATE_PURCHASE_ORDER_COMMAND, now)?;
    authorize(
        session,
        envelope,
        OWNER_MANAGER,
        "purchase_orders.create",
        AuthenticationLevel::User,
        now,
    )?;
    require_revision(envelope.expected_revision)?;
    validate_purchase_order(&envelope.payload)?;
    execute(
        session,
        envelope,
        repository,
        "purchase_orders.create",
        "purchase_order.created",
        "purchase_order",
        &envelope.payload.purchase_order_id,
    )
}

pub fn handle_record_stock_movement<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<RecordStockMovementV1>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<RecordStockMovementResultV1>, CommandApiError>
where
    R: IdempotentMutation<RecordStockMovementV1, RecordStockMovementResultV1>,
{
    validate_command_envelope(envelope, RECORD_STOCK_MOVEMENT_COMMAND, now)?;
    authorize(
        session,
        envelope,
        OWNER_MANAGER,
        "inventory.edit",
        AuthenticationLevel::Elevated,
        now,
    )?;
    require_revision(envelope.expected_revision)?;
    validate_stock_movement(&envelope.payload)?;
    execute(
        session,
        envelope,
        repository,
        "inventory.edit",
        "inventory.stock_movement.recorded",
        "stock_movement",
        &envelope.payload.movement_id,
    )
}

fn authorize<T>(
    session: &SessionContext,
    envelope: &CommandEnvelope<T>,
    roles: &'static [&'static str],
    permission: &'static str,
    minimum_authentication: AuthenticationLevel,
    now: DateTime<Utc>,
) -> Result<(), CommandApiError> {
    authorize_command(
        session,
        envelope,
        AuthorizationRequirement {
            allowed_roles: roles,
            permission,
            module_id: CORE_MODULE,
            minimum_authentication,
        },
        now,
    )
}

fn execute<P, R, Repo>(
    session: &SessionContext,
    envelope: &CommandEnvelope<P>,
    repository: &mut Repo,
    permission: &'static str,
    event_stem: &'static str,
    entity_type: &'static str,
    entity_id: &str,
) -> Result<IdempotencyOutcome<R>, CommandApiError>
where
    P: Serialize,
    Repo: IdempotentMutation<P, R>,
{
    let context = AtomicCommitContext::new(
        fingerprint_command(envelope)?,
        &session.session_id,
        session.authentication_level,
        permission,
        CORE_MODULE,
        AuditEventDraft {
            action: event_stem,
            permission,
            entity_type,
            entity_id: entity_id.to_string(),
        },
        OutboxEventDraft {
            event_type: match event_stem {
                "sale.completed" => "sales.completed.v1",
                "inventory.branch_item.upserted" => "inventory.branch_item.upserted.v1",
                "customer.branch_record.upserted" => "customers.branch_record.upserted.v1",
                "purchase_order.created" => "purchasing.purchase_order.created.v1",
                "inventory.stock_movement.recorded" => "inventory.stock_movement.recorded.v1",
                _ => "command.unknown.v1",
            },
            aggregate_type: entity_type,
            aggregate_id: entity_id.to_string(),
            schema_version: 1,
        },
    );
    repository.execute_once(envelope, &context)
}

fn require_revision(revision: Option<u64>) -> Result<(), CommandApiError> {
    if revision.is_none() {
        return Err(CommandApiError::InvalidEnvelope {
            reason: "expectedRevision is required; use 0 when creating a new aggregate".to_string(),
        });
    }
    Ok(())
}

fn validate_sale(payload: &CompleteSaleV1) -> Result<(), CommandApiError> {
    validate_resource_id(&payload.sale_id, "saleId")?;
    if let Some(customer_id) = &payload.customer_id {
        validate_resource_id(customer_id, "customerId")?;
    }
    validate_collection_size(payload.lines.len(), 1, MAX_LINES, "sale lines")?;
    validate_collection_size(payload.payments.len(), 1, MAX_PAYMENTS, "payments")?;
    validate_optional_text(payload.notes.as_deref(), MAX_TEXT, "notes")?;
    let mut ids = BTreeSet::new();
    for line in &payload.lines {
        validate_resource_id(&line.line_id, "lineId")?;
        validate_resource_id(&line.product_id, "productId")?;
        if let Some(batch_id) = &line.batch_id {
            validate_resource_id(batch_id, "batchId")?;
        }
        if !ids.insert(&line.line_id)
            || line.quantity_milli == 0
            || line.quantity_milli > MAX_QUANTITY_MILLI
            || line.unit_price_minor > MAX_MONEY_MINOR
            || line.discount_minor > MAX_MONEY_MINOR
            || line.tax_basis_points > 10_000
        {
            return invalid("sale line is duplicated or outside supported bounds");
        }
    }
    ids.clear();
    for payment in &payload.payments {
        validate_resource_id(&payment.payment_id, "paymentId")?;
        validate_key(&payment.method_id, 64, "payment method")?;
        validate_optional_text(payment.reference.as_deref(), 256, "payment reference")?;
        if !ids.insert(&payment.payment_id)
            || payment.amount_minor == 0
            || payment.amount_minor > MAX_MONEY_MINOR
        {
            return invalid("payment is duplicated or outside supported bounds");
        }
    }
    Ok(())
}

fn validate_branch_item(payload: &UpsertBranchItemV1) -> Result<(), CommandApiError> {
    validate_resource_id(&payload.product_id, "productId")?;
    validate_text(&payload.name, 200, "name")?;
    validate_key(&payload.sku, 80, "sku")?;
    validate_optional_text(payload.barcode.as_deref(), 80, "barcode")?;
    validate_key(&payload.unit, 32, "unit")?;
    if payload.buying_price_minor > MAX_MONEY_MINOR
        || payload.selling_price_minor > MAX_MONEY_MINOR
        || payload.reorder_level_milli > MAX_QUANTITY_MILLI
    {
        return invalid("inventory values exceed supported bounds");
    }
    Ok(())
}

fn validate_customer(payload: &UpsertBranchCustomerV1) -> Result<(), CommandApiError> {
    validate_resource_id(&payload.customer_id, "customerId")?;
    validate_text(&payload.name, 200, "name")?;
    validate_optional_text(payload.phone.as_deref(), 32, "phone")?;
    validate_optional_text(payload.email.as_deref(), 254, "email")?;
    if payload.credit_limit_minor > MAX_MONEY_MINOR {
        return invalid("creditLimitMinor exceeds the supported maximum");
    }
    Ok(())
}

fn validate_purchase_order(payload: &CreatePurchaseOrderV1) -> Result<(), CommandApiError> {
    validate_resource_id(&payload.purchase_order_id, "purchaseOrderId")?;
    validate_resource_id(&payload.supplier_id, "supplierId")?;
    validate_key(&payload.currency, 3, "currency")?;
    validate_optional_text(payload.expected_date.as_deref(), 32, "expected date")?;
    validate_optional_text(payload.notes.as_deref(), MAX_TEXT, "notes")?;
    validate_collection_size(payload.lines.len(), 1, MAX_LINES, "purchase order lines")?;
    let mut ids = BTreeSet::new();
    for line in &payload.lines {
        validate_resource_id(&line.line_id, "lineId")?;
        validate_resource_id(&line.product_id, "productId")?;
        if !ids.insert(&line.line_id)
            || line.quantity_milli == 0
            || line.quantity_milli > MAX_QUANTITY_MILLI
            || line.unit_cost_minor > MAX_MONEY_MINOR
            || line.tax_basis_points > 10_000
        {
            return invalid("purchase order line is duplicated or outside supported bounds");
        }
    }
    Ok(())
}

fn validate_stock_movement(payload: &RecordStockMovementV1) -> Result<(), CommandApiError> {
    validate_resource_id(&payload.movement_id, "movementId")?;
    validate_resource_id(&payload.product_id, "productId")?;
    if let Some(batch_id) = &payload.batch_id {
        validate_resource_id(batch_id, "batchId")?;
    }
    validate_key(&payload.reason_code, 64, "reason code")?;
    validate_optional_text(payload.notes.as_deref(), MAX_TEXT, "notes")?;
    if payload.quantity_delta_milli == 0
        || payload.quantity_delta_milli.unsigned_abs() > MAX_QUANTITY_MILLI
    {
        return invalid("quantityDeltaMilli must be non-zero and within supported bounds");
    }
    Ok(())
}

fn validate_collection_size(
    actual: usize,
    minimum: usize,
    maximum: usize,
    field: &str,
) -> Result<(), CommandApiError> {
    if actual < minimum || actual > maximum {
        return invalid(format!(
            "{field} must contain between {minimum} and {maximum} entries"
        ));
    }
    Ok(())
}

fn validate_text(value: &str, maximum: usize, field: &str) -> Result<(), CommandApiError> {
    if value.trim().is_empty()
        || value.len() > maximum
        || value.chars().any(|character| character.is_control())
    {
        return invalid(format!("{field} has an invalid length or characters"));
    }
    Ok(())
}

fn validate_optional_text(
    value: Option<&str>,
    maximum: usize,
    field: &str,
) -> Result<(), CommandApiError> {
    if let Some(value) = value {
        validate_text(value, maximum, field)?;
    }
    Ok(())
}

fn validate_key(value: &str, maximum: usize, field: &str) -> Result<(), CommandApiError> {
    if value.is_empty()
        || value.len() > maximum.min(MAX_SEARCH_LENGTH)
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte))
    {
        return invalid(format!("{field} has an invalid format"));
    }
    Ok(())
}

fn invalid<T>(reason: impl Into<String>) -> Result<T, CommandApiError> {
    Err(CommandApiError::InvalidEnvelope {
        reason: reason.into(),
    })
}
