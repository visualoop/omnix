use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::authorization::{
    authorize_command, authorize_read, AuthenticationLevel, AuthorizationRequirement,
    ReadAuthorizationRequirement, SessionContext,
};
use super::contracts::{
    validate_command_envelope, validate_projection_page, validate_read_request,
    validate_resource_id, validate_search, CommandEnvelope, ProjectionPage, ReadProjectionRequest,
    ReadProjectionResponse, ValidatedPage,
};
use super::error::CommandApiError;
use super::idempotency::{
    fingerprint_command, AtomicCommitContext, AuditEventDraft, IdempotencyOutcome,
    IdempotentMutation, OutboxEventDraft,
};

pub const SET_REORDER_LEVEL_COMMAND: &str = "inventory.setReorderLevel.v1";
pub const INVENTORY_ALERTS_PROJECTION: &str = "inventory.reorderAlerts.v1";
const CORE_MODULE: &str = "core";
const INVENTORY_WRITE_PERMISSION: &str = "inventory.edit";
const INVENTORY_READ_PERMISSION: &str = "inventory.view";
const MUTATION_ROLES: &[&str] = &["role_owner", "role_manager"];
const READ_ROLES: &[&str] = &["role_owner", "role_manager", "role_viewer"];
const MAX_REORDER_LEVEL: u32 = 1_000_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetReorderLevel {
    pub product_id: String,
    pub reorder_level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetReorderLevelResult {
    pub product_id: String,
    pub branch_id: String,
    pub previous_reorder_level: u32,
    pub reorder_level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InventoryAlertsFilter {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub include_out_of_stock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InventoryAlertRow {
    pub product_id: String,
    pub sku: String,
    pub name: String,
    pub branch_id: String,
    pub quantity_on_hand: f64,
    pub reorder_level: u32,
    pub revision: u64,
}

/// Dedicated read/query port. Its DB implementation must use one allowlisted parameterized query
/// with a mandatory `branch_id IN authorized_branches` predicate. It returns active products whose
/// branch quantity is at or below the effective branch reorder level, excludes zero/negative stock
/// unless `include_out_of_stock` is true, applies `search` only to SKU/name, and uses a deterministic
/// opaque cursor order. Callers never supply SQL.
pub trait InventoryAlertsQuery {
    fn fetch_inventory_alerts(
        &mut self,
        authorized_branches: &[String],
        filter: &InventoryAlertsFilter,
        page: &ValidatedPage,
    ) -> Result<ProjectionPage<InventoryAlertRow>, CommandApiError>;
}

/// Pilot mutation boundary. The durable repository must treat `(branch_id, product_id)` as the
/// resource key; the historical global `products.reorder_level` column is not sufficient for this
/// branch-scoped contract and must not be updated as a substitute.
pub fn handle_set_reorder_level<R>(
    session: &SessionContext,
    envelope: &CommandEnvelope<SetReorderLevel>,
    repository: &mut R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<SetReorderLevelResult>, CommandApiError>
where
    R: IdempotentMutation<SetReorderLevel, SetReorderLevelResult>,
{
    validate_command_envelope(envelope, SET_REORDER_LEVEL_COMMAND, now)?;
    authorize_command(
        session,
        envelope,
        AuthorizationRequirement {
            allowed_roles: MUTATION_ROLES,
            permission: INVENTORY_WRITE_PERMISSION,
            module_id: CORE_MODULE,
            minimum_authentication: AuthenticationLevel::User,
        },
        now,
    )?;
    validate_resource_id(&envelope.payload.product_id, "productId")?;
    if envelope.payload.reorder_level > MAX_REORDER_LEVEL {
        return Err(CommandApiError::InvalidEnvelope {
            reason: "reorderLevel exceeds the supported maximum".to_string(),
        });
    }

    let fingerprint = fingerprint_command(envelope)?;
    let context = AtomicCommitContext::new(
        fingerprint,
        &session.session_id,
        session.authentication_level,
        INVENTORY_WRITE_PERMISSION,
        CORE_MODULE,
        AuditEventDraft {
            action: "inventory.reorder_level.set",
            permission: INVENTORY_WRITE_PERMISSION,
            entity_type: "product_stock_policy",
            entity_id: envelope.payload.product_id.clone(),
        },
        OutboxEventDraft {
            event_type: "inventory.reorder_level.changed.v1",
            aggregate_type: "product_stock_policy",
            aggregate_id: envelope.payload.product_id.clone(),
            schema_version: 1,
        },
    );
    repository.execute_once(envelope, &context)
}

pub fn handle_inventory_alerts_read<Q>(
    session: &SessionContext,
    request: &ReadProjectionRequest<InventoryAlertsFilter>,
    query: &mut Q,
    now: DateTime<Utc>,
) -> Result<ReadProjectionResponse<InventoryAlertRow>, CommandApiError>
where
    Q: InventoryAlertsQuery,
{
    let page = validate_read_request(request, INVENTORY_ALERTS_PROJECTION)?;
    validate_search(request.filter.search.as_deref())?;
    let branches = authorize_read(
        session,
        request,
        ReadAuthorizationRequirement {
            access: AuthorizationRequirement {
                allowed_roles: READ_ROLES,
                permission: INVENTORY_READ_PERMISSION,
                module_id: CORE_MODULE,
                minimum_authentication: AuthenticationLevel::User,
            },
            allow_all_assigned: true,
        },
        now,
    )?;

    let result = query.fetch_inventory_alerts(&branches.0, &request.filter, &page)?;
    validate_projection_page(&result, page.limit)?;
    if result.items.iter().any(|row| {
        !branches.0.contains(&row.branch_id)
            || !row.quantity_on_hand.is_finite()
            || row.reorder_level > MAX_REORDER_LEVEL
    }) {
        return Err(CommandApiError::InvalidProjectionResult);
    }

    Ok(ReadProjectionResponse {
        schema_version: super::contracts::API_SCHEMA_V1,
        request_id: request.request_id.clone(),
        projection: request.projection.clone(),
        branch_scope: request.branch_scope.clone(),
        generated_at: now,
        limit: page.limit,
        items: result.items,
        next_cursor: result.next_cursor,
    })
}
