use std::collections::BTreeSet;

use chrono::{DateTime, Utc};
use rand::RngCore;
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::command_api::authorization::{
    AuthenticatedPrincipal, AuthenticationLevel, PermissionEffect, PermissionGrant, RoleGrant,
    SessionAccess, SessionContext,
};
use crate::command_api::contracts::{CommandEnvelope, ProjectionPage, ValidatedPage};
use crate::command_api::domain_commands::{
    CompleteSaleResultV1, CompleteSaleV1, CreatePurchaseOrderResultV1, CreatePurchaseOrderV1,
    RecordStockMovementResultV1, RecordStockMovementV1, StockMovementKindV1,
    UpsertBranchCustomerResultV1, UpsertBranchCustomerV1, UpsertBranchItemResultV1,
    UpsertBranchItemV1,
};
use crate::command_api::error::CommandApiError;
use crate::command_api::idempotency::{
    receipt_v1, AtomicCommitContext, CommandReceipt, IdempotencyOutcome,
};
use crate::command_api::local_auth::{IssuedLocalSession, LocalCredentialRecord};
use crate::command_api::pilot_inventory::{
    InventoryAlertRow, InventoryAlertsFilter, SetReorderLevel, SetReorderLevelResult,
};
use crate::command_api::projections::{
    AndroidInventoryFilterV1, AndroidInventoryRowV1, AndroidOpenPurchaseRowV1,
    AndroidOpenPurchasesFilterV1, TillCurrentShiftFilterV1, TillRecentSaleRowV1,
    TillRecentSalesFilterV1, TillShiftRowV1,
};
use crate::command_api::query::{
    atomic, auth, customers, inventory, purchasing, sales, stock_movements, till,
};

const COMMAND_PERMISSIONS: &[&str] = &[
    "pos.use",
    "inventory.edit",
    "inventory.view",
    "customers.edit",
    "purchase_orders.create",
    "purchase_orders.view",
    "sales.view",
    "cash_register.use",
];

fn storage(_: impl std::fmt::Display) -> CommandApiError {
    CommandApiError::StorageUnavailable
}

fn parse_time(value: &str) -> Result<DateTime<Utc>, CommandApiError> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(storage)
}

fn as_i64(value: u64) -> Result<i64, CommandApiError> {
    i64::try_from(value).map_err(storage)
}

fn access(value: &str) -> Result<SessionAccess, CommandApiError> {
    match value {
        "desktop" => Ok(SessionAccess::Desktop),
        "android" => Ok(SessionAccess::Android),
        "browser_read_only" => Ok(SessionAccess::BrowserReadOnly),
        _ => Err(CommandApiError::InvalidSession),
    }
}

fn auth_level(value: &str) -> Result<AuthenticationLevel, CommandApiError> {
    match value {
        "device_paired" => Ok(AuthenticationLevel::DevicePaired),
        "user" => Ok(AuthenticationLevel::User),
        "elevated" => Ok(AuthenticationLevel::Elevated),
        _ => Err(CommandApiError::InvalidSession),
    }
}

fn auth_level_name(value: AuthenticationLevel) -> &'static str {
    match value {
        AuthenticationLevel::DevicePaired => "device_paired",
        AuthenticationLevel::User => "user",
        AuthenticationLevel::Elevated => "elevated",
    }
}

fn access_name(value: SessionAccess) -> &'static str {
    match value {
        SessionAccess::Desktop => "desktop",
        SessionAccess::Android => "android",
        SessionAccess::BrowserReadOnly => "browser_read_only",
    }
}

#[derive(FromRow)]
struct SessionRow {
    id: String,
    user_id: String,
    node_id: String,
    access_mode: String,
    authentication_level: String,
    branch_local: i64,
    issued_at: String,
    expires_at: String,
    revoked_at: Option<String>,
}

#[derive(FromRow)]
struct RoleRow {
    role_id: String,
    branch_id: Option<String>,
    module_id: Option<String>,
}

#[derive(FromRow)]
struct PermissionRow {
    permission_key: String,
    effect: String,
    branch_id: Option<String>,
    module_id: Option<String>,
}

#[derive(FromRow)]
struct LicenceRow {
    variant: String,
    modules: Option<String>,
}

pub async fn resolve_session(
    pool: &SqlitePool,
    clear_token: &str,
    now: DateTime<Utc>,
) -> Result<SessionContext, CommandApiError> {
    if clear_token.len() < 32
        || clear_token.len() > 512
        || clear_token.chars().any(char::is_whitespace)
    {
        return Err(CommandApiError::AuthenticationRequired);
    }
    let token_hash = Sha256::digest(clear_token.as_bytes()).to_vec();
    let row = sqlx::query_as::<_, SessionRow>(auth::RESOLVE_SESSION)
        .bind(token_hash)
        .bind(now.to_rfc3339())
        .fetch_optional(pool)
        .await
        .map_err(storage)?
        .ok_or(CommandApiError::AuthenticationRequired)?;
    let principal = resolve_principal(pool, &row.user_id, now).await?;
    Ok(SessionContext {
        session_id: row.id,
        node_id: row.node_id,
        access: access(&row.access_mode)?,
        authentication_level: auth_level(&row.authentication_level)?,
        branch_local: row.branch_local == 1,
        issued_at: parse_time(&row.issued_at)?,
        expires_at: parse_time(&row.expires_at)?,
        revoked: row.revoked_at.is_some(),
        principal,
    })
}

async fn resolve_principal(
    pool: &SqlitePool,
    user_id: &str,
    now: DateTime<Utc>,
) -> Result<AuthenticatedPrincipal, CommandApiError> {
    let branches: Vec<String> = sqlx::query_scalar(auth::LOAD_ASSIGNED_BRANCHES)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let mut roles: Vec<RoleGrant> = sqlx::query_as::<_, RoleRow>(auth::LOAD_ROLE_GRANTS)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(storage)?
        .into_iter()
        .map(|row| RoleGrant {
            role_id: row.role_id,
            branch_id: row.branch_id,
            module_id: row.module_id,
        })
        .collect();
    if roles.is_empty() {
        let legacy: Option<String> = sqlx::query_scalar(auth::LOAD_LEGACY_ROLE)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(storage)?;
        if let Some(role) = legacy {
            roles.push(RoleGrant {
                role_id: format!("role_{role}"),
                branch_id: None,
                module_id: None,
            });
        }
    }
    let mut permissions: Vec<PermissionGrant> =
        sqlx::query_as::<_, PermissionRow>(auth::LOAD_PERMISSION_GRANTS)
            .bind(user_id)
            .fetch_all(pool)
            .await
            .map_err(storage)?
            .into_iter()
            .filter_map(|row| {
                let effect = match row.effect.as_str() {
                    "allow" => PermissionEffect::Allow,
                    "deny" => PermissionEffect::Deny,
                    _ => return None,
                };
                Some(PermissionGrant {
                    permission: row.permission_key,
                    effect,
                    branch_id: row.branch_id,
                    module_id: row.module_id,
                })
            })
            .collect();
    if roles.iter().any(|role| role.role_id == "role_owner") {
        for permission in COMMAND_PERMISSIONS {
            if !permissions.iter().any(|grant| {
                grant.permission == *permission && grant.effect == PermissionEffect::Deny
            }) {
                permissions.push(PermissionGrant {
                    permission: (*permission).to_string(),
                    effect: PermissionEffect::Allow,
                    branch_id: None,
                    module_id: Some("core".to_string()),
                });
            }
        }
    }
    let licence_rows = sqlx::query_as::<_, LicenceRow>(auth::LOAD_LICENCE_FACTS)
        .bind(now.to_rfc3339())
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let legacy_count: i64 = sqlx::query_scalar(auth::LOAD_LEGACY_LICENCE_COUNT)
        .fetch_one(pool)
        .await
        .map_err(storage)?;
    let mut modules = BTreeSet::from(["core".to_string()]);
    for row in &licence_rows {
        modules.insert(row.variant.clone());
        if let Some(raw) = &row.modules {
            if let Ok(values) = serde_json::from_str::<Vec<String>>(raw) {
                modules.extend(values);
            }
        }
    }
    Ok(AuthenticatedPrincipal {
        user_id: user_id.to_string(),
        assigned_branches: branches.into_iter().collect(),
        enabled_modules: modules,
        roles,
        permissions,
        licence_valid: !licence_rows.is_empty() || legacy_count > 0,
    })
}

#[derive(FromRow)]
struct CredentialRow {
    id: String,
    username: String,
    full_name: String,
    role: String,
    password_hash: String,
    branch_id: String,
    node_id: String,
    user_active: i64,
    node_approved: i64,
}

pub async fn find_local_credential(
    pool: &SqlitePool,
    node_id: &str,
    branch_id: &str,
    username: &str,
    now: DateTime<Utc>,
) -> Result<Option<LocalCredentialRecord>, CommandApiError> {
    let row = sqlx::query_as::<_, CredentialRow>(auth::FIND_LOCAL_CREDENTIAL)
        .bind(node_id)
        .bind(branch_id)
        .bind(username)
        .fetch_optional(pool)
        .await
        .map_err(storage)?;
    let Some(row) = row else {
        return Ok(None);
    };
    let principal = resolve_principal(pool, &row.id, now).await?;
    Ok(Some(LocalCredentialRecord {
        user_id: row.id,
        username: row.username,
        full_name: row.full_name,
        role: row.role,
        password_hash: row.password_hash,
        branch_id: row.branch_id,
        node_id: row.node_id,
        user_active: row.user_active == 1,
        node_approved: row.node_approved == 1,
        allow_desktop: true,
        allow_android: true,
        principal,
    }))
}

pub async fn record_failed_login(
    pool: &SqlitePool,
    request_id: &str,
    node_id: &str,
    branch_id: &str,
    now: DateTime<Utc>,
) -> Result<(), CommandApiError> {
    let metadata = serde_json::json!({"requestId": request_id, "nodeId": node_id}).to_string();
    sqlx::query(auth::RECORD_LOCAL_LOGIN_FAILURE)
        .bind(Uuid::new_v4().to_string())
        .bind(branch_id)
        .bind(metadata)
        .bind(now.to_rfc3339())
        .execute(pool)
        .await
        .map_err(storage)?;
    Ok(())
}

pub async fn issue_local_session(
    pool: &SqlitePool,
    credential: &LocalCredentialRecord,
    access_value: SessionAccess,
    now: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> Result<IssuedLocalSession, CommandApiError> {
    let mut token_bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let clear_token = hex::encode(token_bytes);
    let token_hash = Sha256::digest(clear_token.as_bytes()).to_vec();
    let session_id = Uuid::new_v4().to_string();
    let mut tx = pool.begin().await.map_err(storage)?;
    sqlx::query(auth::INSERT_LOCAL_SESSION)
        .bind(&session_id)
        .bind(token_hash)
        .bind(&credential.user_id)
        .bind(&credential.node_id)
        .bind(access_name(access_value))
        .bind(now.to_rfc3339())
        .bind(expires_at.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    let metadata =
        serde_json::json!({"branchLocal": true, "access": access_name(access_value)}).to_string();
    sqlx::query(auth::INSERT_LOCAL_LOGIN_AUDIT)
        .bind(Uuid::new_v4().to_string())
        .bind(&credential.user_id)
        .bind(&credential.branch_id)
        .bind(&session_id)
        .bind(metadata)
        .bind(now.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    tx.commit().await.map_err(storage)?;
    Ok(IssuedLocalSession {
        access_token: clear_token,
        session: SessionContext {
            session_id,
            node_id: credential.node_id.clone(),
            access: access_value,
            authentication_level: AuthenticationLevel::User,
            branch_local: true,
            issued_at: now,
            expires_at,
            revoked: false,
            principal: credential.principal.clone(),
        },
    })
}

#[derive(FromRow)]
struct ClaimRow {
    fingerprint: String,
    state: String,
    response_json: Option<String>,
    resulting_revision: Option<i64>,
    user_id: String,
    node_id: String,
    branch_id: String,
    session_id: String,
}

enum Claim {
    Proceed,
    Replay(String),
}

async fn claim<P>(
    tx: &mut Transaction<'_, Sqlite>,
    envelope: &CommandEnvelope<P>,
    context: &AtomicCommitContext,
    now: DateTime<Utc>,
) -> Result<Claim, CommandApiError> {
    let expected = envelope
        .expected_revision
        .ok_or_else(|| CommandApiError::InvalidEnvelope {
            reason: "expectedRevision is required".to_string(),
        })?;
    let session_valid: Option<i64> = sqlx::query_scalar(atomic::VERIFY_SESSION_IDENTITY)
        .bind(&context.session_id)
        .bind(&envelope.user_id)
        .bind(&envelope.node_id)
        .bind(now.to_rfc3339())
        .fetch_optional(&mut **tx)
        .await
        .map_err(storage)?;
    if session_valid.is_none() {
        return Err(CommandApiError::InvalidSession);
    }
    let inserted = sqlx::query(atomic::CLAIM_COMMAND)
        .bind(&envelope.command_id)
        .bind(&context.fingerprint.0)
        .bind(&envelope.user_id)
        .bind(&envelope.node_id)
        .bind(&context.session_id)
        .bind(&envelope.branch_id)
        .bind(&envelope.command_type)
        .bind(as_i64(expected)?)
        .bind(auth_level_name(context.authentication_level))
        .bind(now.to_rfc3339())
        .execute(&mut **tx)
        .await
        .map_err(storage)?;
    if inserted.rows_affected() == 1 {
        return Ok(Claim::Proceed);
    }
    let row = sqlx::query_as::<_, ClaimRow>(atomic::LOAD_COMMAND_CLAIM)
        .bind(&envelope.command_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(storage)?;
    if row.fingerprint != context.fingerprint.0
        || row.user_id != envelope.user_id
        || row.node_id != envelope.node_id
        || row.branch_id != envelope.branch_id
        || row.session_id != context.session_id
    {
        return Err(CommandApiError::IdempotencyConflict);
    }
    if row.state == "completed" {
        let _ = row.resulting_revision;
        return row
            .response_json
            .map(Claim::Replay)
            .ok_or(CommandApiError::StorageUnavailable);
    }
    Err(CommandApiError::CommandInProgress)
}

fn replay<R: DeserializeOwned>(json: &str) -> Result<IdempotencyOutcome<R>, CommandApiError> {
    let receipt = serde_json::from_str::<CommandReceipt<R>>(json).map_err(storage)?;
    Ok(IdempotencyOutcome::Replayed(receipt))
}

async fn finish<R: Serialize>(
    tx: &mut Transaction<'_, Sqlite>,
    envelope_command_id: &str,
    user_id: &str,
    node_id: &str,
    branch_id: &str,
    context: &AtomicCommitContext,
    revision: u64,
    response: R,
    now: DateTime<Utc>,
) -> Result<IdempotencyOutcome<R>, CommandApiError> {
    let receipt = receipt_v1(envelope_command_id.to_string(), now, revision, response);
    let receipt_json = serde_json::to_string(&receipt).map_err(storage)?;
    let payload_json = serde_json::to_string(&serde_json::json!({
        "commandId": envelope_command_id, "resultingRevision": revision, "response": &receipt.response,
    })).map_err(storage)?;
    let metadata =
        serde_json::json!({"commandId": envelope_command_id, "moduleId": context.module_id})
            .to_string();
    sqlx::query(atomic::INSERT_AUDIT)
        .bind(Uuid::new_v4().to_string())
        .bind(user_id)
        .bind(context.permission)
        .bind(context.audit.action)
        .bind("normal")
        .bind(branch_id)
        .bind(context.audit.entity_type)
        .bind(&context.audit.entity_id)
        .bind(metadata)
        .bind(now.to_rfc3339())
        .execute(&mut **tx)
        .await
        .map_err(storage)?;
    sqlx::query(atomic::INSERT_OUTBOX)
        .bind(Uuid::new_v4().to_string())
        .bind(envelope_command_id)
        .bind(branch_id)
        .bind(context.outbox.event_type)
        .bind(context.outbox.aggregate_type)
        .bind(&context.outbox.aggregate_id)
        .bind(i64::from(context.outbox.schema_version))
        .bind(as_i64(revision)?)
        .bind(payload_json)
        .bind(now.to_rfc3339())
        .execute(&mut **tx)
        .await
        .map_err(storage)?;
    let completed = sqlx::query(atomic::COMPLETE_COMMAND)
        .bind(envelope_command_id)
        .bind(receipt_json)
        .bind(as_i64(revision)?)
        .bind(now.to_rfc3339())
        .bind(user_id)
        .bind(node_id)
        .bind(branch_id)
        .execute(&mut **tx)
        .await
        .map_err(storage)?;
    if completed.rows_affected() != 1 {
        return Err(CommandApiError::StorageUnavailable);
    }
    Ok(IdempotencyOutcome::Applied(receipt))
}

async fn current_revision(
    tx: &mut Transaction<'_, Sqlite>,
    sql: &str,
    branch_id: &str,
    entity_id: &str,
) -> Result<u64, CommandApiError> {
    let branches = serde_json::to_string(&[branch_id]).map_err(storage)?;
    let value: Option<i64> = sqlx::query_scalar(sql)
        .bind(branches)
        .bind(branch_id)
        .bind(entity_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(storage)?;
    value
        .map(|value| u64::try_from(value).map_err(storage))
        .transpose()
        .map(|value| value.unwrap_or(0))
}

fn require_revision<P>(envelope: &CommandEnvelope<P>, actual: u64) -> Result<u64, CommandApiError> {
    let expected = envelope
        .expected_revision
        .ok_or_else(|| CommandApiError::InvalidEnvelope {
            reason: "expectedRevision is required".to_string(),
        })?;
    if expected != actual {
        return Err(CommandApiError::RevisionConflict);
    }
    Ok(actual + 1)
}

pub async fn upsert_branch_item(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<UpsertBranchItemV1>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<UpsertBranchItemResultV1>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let actual = current_revision(
        &mut tx,
        inventory::LOAD_BRANCH_ITEM_REVISION,
        &envelope.branch_id,
        &envelope.payload.product_id,
    )
    .await?;
    let next = require_revision(envelope, actual)?;
    let payload = &envelope.payload;
    sqlx::query(inventory::UPSERT_PRODUCT_CATALOG)
        .bind(&payload.product_id)
        .bind(&payload.name)
        .bind(&payload.sku)
        .bind(&payload.barcode)
        .bind(&payload.unit)
        .bind(as_i64(payload.reorder_level_milli)?)
        .bind(i64::from(payload.active))
        .bind(now.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    let changed = sqlx::query(inventory::UPSERT_BRANCH_ITEM)
        .bind(&envelope.branch_id)
        .bind(&payload.product_id)
        .bind(&payload.name)
        .bind(&payload.sku)
        .bind(&payload.barcode)
        .bind(&payload.unit)
        .bind(as_i64(payload.buying_price_minor)?)
        .bind(as_i64(payload.selling_price_minor)?)
        .bind(as_i64(payload.reorder_level_milli)?)
        .bind(i64::from(payload.active))
        .bind(as_i64(next)?)
        .bind(now.to_rfc3339())
        .bind(as_i64(actual)?)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if changed.rows_affected() != 1 {
        return Err(CommandApiError::RevisionConflict);
    }
    sqlx::query(inventory::ENSURE_BRANCH_STOCK)
        .bind(&envelope.branch_id)
        .bind(&payload.product_id)
        .bind(now.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        UpsertBranchItemResultV1 {
            product_id: payload.product_id.clone(),
            branch_id: envelope.branch_id.clone(),
            active: payload.active,
        },
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

pub async fn set_reorder_level(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<SetReorderLevel>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<SetReorderLevelResult>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let actual = current_revision(
        &mut tx,
        inventory::LOAD_BRANCH_ITEM_REVISION,
        &envelope.branch_id,
        &envelope.payload.product_id,
    )
    .await?;
    if actual == 0 {
        return Err(CommandApiError::NotFound);
    }
    let next = require_revision(envelope, actual)?;
    let previous_milli: i64 = sqlx::query_scalar(inventory::LOAD_REORDER_LEVEL)
        .bind(&envelope.branch_id)
        .bind(&envelope.payload.product_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
    let changed = sqlx::query(inventory::SET_REORDER_LEVEL)
        .bind(&envelope.branch_id)
        .bind(&envelope.payload.product_id)
        .bind(i64::from(envelope.payload.reorder_level) * 1000)
        .bind(now.to_rfc3339())
        .bind(as_i64(actual)?)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if changed.rows_affected() != 1 {
        return Err(CommandApiError::RevisionConflict);
    }
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        SetReorderLevelResult {
            product_id: envelope.payload.product_id.clone(),
            branch_id: envelope.branch_id.clone(),
            previous_reorder_level: u32::try_from(previous_milli / 1000).map_err(storage)?,
            reorder_level: envelope.payload.reorder_level,
        },
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

pub async fn upsert_branch_customer(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<UpsertBranchCustomerV1>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<UpsertBranchCustomerResultV1>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let actual = current_revision(
        &mut tx,
        customers::LOAD_BRANCH_CUSTOMER_REVISION,
        &envelope.branch_id,
        &envelope.payload.customer_id,
    )
    .await?;
    let next = require_revision(envelope, actual)?;
    let p = &envelope.payload;
    sqlx::query(customers::UPSERT_CUSTOMER_CATALOG)
        .bind(&p.customer_id)
        .bind(&p.name)
        .bind(&p.phone)
        .bind(&p.email)
        .bind(as_i64(p.credit_limit_minor)?)
        .bind(i64::from(p.active))
        .bind(now.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    let changed = sqlx::query(customers::UPSERT_BRANCH_CUSTOMER)
        .bind(&envelope.branch_id)
        .bind(&p.customer_id)
        .bind(&p.name)
        .bind(&p.phone)
        .bind(&p.email)
        .bind(as_i64(p.credit_limit_minor)?)
        .bind(i64::from(p.active))
        .bind(as_i64(next)?)
        .bind(now.to_rfc3339())
        .bind(as_i64(actual)?)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if changed.rows_affected() != 1 {
        return Err(CommandApiError::RevisionConflict);
    }
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        UpsertBranchCustomerResultV1 {
            customer_id: p.customer_id.clone(),
            branch_id: envelope.branch_id.clone(),
            active: p.active,
        },
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

pub async fn complete_sale(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<CompleteSaleV1>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<CompleteSaleResultV1>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let actual = current_revision(
        &mut tx,
        sales::LOAD_SALE_REVISION,
        &envelope.branch_id,
        &envelope.payload.sale_id,
    )
    .await?;
    let next = require_revision(envelope, actual)?;
    if actual != 0 {
        return Err(CommandApiError::RevisionConflict);
    }
    let mut subtotal: u64 = 0;
    let mut discounts: u64 = 0;
    let mut tax: u64 = 0;
    for line in &envelope.payload.lines {
        let gross = u64::try_from(
            (u128::from(line.quantity_milli) * u128::from(line.unit_price_minor)) / 1000,
        )
        .map_err(storage)?;
        subtotal = subtotal
            .checked_add(gross)
            .ok_or(CommandApiError::StorageUnavailable)?;
        discounts = discounts
            .checked_add(line.discount_minor)
            .ok_or(CommandApiError::StorageUnavailable)?;
        let taxable = gross.saturating_sub(line.discount_minor);
        tax = tax
            .checked_add(
                u64::try_from((u128::from(taxable) * u128::from(line.tax_basis_points)) / 10_000)
                    .map_err(storage)?,
            )
            .ok_or(CommandApiError::StorageUnavailable)?;
    }
    let total = subtotal
        .saturating_sub(discounts)
        .checked_add(tax)
        .ok_or(CommandApiError::StorageUnavailable)?;
    let paid = envelope
        .payload
        .payments
        .iter()
        .try_fold(0_u64, |sum, payment| {
            sum.checked_add(payment.amount_minor)
                .ok_or(CommandApiError::StorageUnavailable)
        })?;
    let payment_status = if paid >= total {
        "paid"
    } else if paid > 0 {
        "partial"
    } else {
        "unpaid"
    };
    let sale_number: i64 = sqlx::query_scalar(sales::NEXT_SALE_NUMBER)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
    let branch_json = serde_json::to_string(&[&envelope.branch_id]).map_err(storage)?;
    let inserted = sqlx::query(sales::INSERT_SALE)
        .bind(&envelope.payload.sale_id)
        .bind(sale_number)
        .bind(&envelope.payload.customer_id)
        .bind(&envelope.user_id)
        .bind(subtotal as f64 / 100.0)
        .bind(discounts as f64 / 100.0)
        .bind(tax as f64 / 100.0)
        .bind(total as f64 / 100.0)
        .bind(payment_status)
        .bind(&envelope.payload.notes)
        .bind(&branch_json)
        .bind(now.to_rfc3339())
        .bind(&envelope.branch_id)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if inserted.rows_affected() != 1 {
        return Err(CommandApiError::BranchAccessDenied);
    }
    for line in &envelope.payload.lines {
        let line_total = u64::try_from(
            (u128::from(line.quantity_milli) * u128::from(line.unit_price_minor)) / 1000,
        )
        .map_err(storage)?
        .saturating_sub(line.discount_minor);
        let item = sqlx::query(sales::INSERT_SALE_ITEM)
            .bind(&line.line_id)
            .bind(&envelope.payload.sale_id)
            .bind(&line.product_id)
            .bind(&line.batch_id)
            .bind(as_i64(line.quantity_milli)?)
            .bind(as_i64(line.unit_price_minor)?)
            .bind(as_i64(line.discount_minor)?)
            .bind(i64::from(line.tax_basis_points))
            .bind(as_i64(line_total)?)
            .bind(&envelope.branch_id)
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        if item.rows_affected() != 1 {
            return Err(CommandApiError::NotFound);
        }
        let stock: Option<(i64, i64)> = sqlx::query_as(sales::DECREMENT_BRANCH_STOCK)
            .bind(&envelope.branch_id)
            .bind(&line.product_id)
            .bind(as_i64(line.quantity_milli)?)
            .bind(now.to_rfc3339())
            .fetch_optional(&mut *tx)
            .await
            .map_err(storage)?;
        let Some((quantity, revision)) = stock else {
            return Err(CommandApiError::RevisionConflict);
        };
        sqlx::query(inventory::SYNC_BRANCH_ITEM_QUANTITY)
            .bind(&envelope.branch_id)
            .bind(&line.product_id)
            .bind(quantity)
            .bind(revision)
            .bind(now.to_rfc3339())
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
    }
    for payment in &envelope.payload.payments {
        let row = sqlx::query(sales::INSERT_PAYMENT)
            .bind(&payment.payment_id)
            .bind(&envelope.payload.sale_id)
            .bind(&payment.method_id)
            .bind(as_i64(payment.amount_minor)?)
            .bind(&payment.reference)
            .bind(now.to_rfc3339())
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        if row.rows_affected() != 1 {
            return Err(CommandApiError::NotFound);
        }
    }
    let result = CompleteSaleResultV1 {
        sale_id: envelope.payload.sale_id.clone(),
        sale_number: u64::try_from(sale_number).map_err(storage)?,
        total_minor: total,
        payment_status: payment_status.to_string(),
    };
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        result,
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

pub async fn create_purchase_order(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<CreatePurchaseOrderV1>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<CreatePurchaseOrderResultV1>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let actual = current_revision(
        &mut tx,
        purchasing::LOAD_PURCHASE_ORDER_REVISION,
        &envelope.branch_id,
        &envelope.payload.purchase_order_id,
    )
    .await?;
    let next = require_revision(envelope, actual)?;
    if actual != 0 {
        return Err(CommandApiError::RevisionConflict);
    }
    let mut subtotal = 0_u64;
    let mut tax = 0_u64;
    for line in &envelope.payload.lines {
        let line_total = u64::try_from(
            (u128::from(line.quantity_milli) * u128::from(line.unit_cost_minor)) / 1000,
        )
        .map_err(storage)?;
        subtotal = subtotal
            .checked_add(line_total)
            .ok_or(CommandApiError::StorageUnavailable)?;
        tax = tax
            .checked_add(
                u64::try_from(
                    (u128::from(line_total) * u128::from(line.tax_basis_points)) / 10_000,
                )
                .map_err(storage)?,
            )
            .ok_or(CommandApiError::StorageUnavailable)?;
    }
    let total = subtotal
        .checked_add(tax)
        .ok_or(CommandApiError::StorageUnavailable)?;
    let po_number: String = sqlx::query_scalar(purchasing::NEXT_PO_NUMBER)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
    let branch_json = serde_json::to_string(&[&envelope.branch_id]).map_err(storage)?;
    let inserted = sqlx::query(purchasing::INSERT_PURCHASE_ORDER)
        .bind(&envelope.payload.purchase_order_id)
        .bind(&po_number)
        .bind(&envelope.payload.supplier_id)
        .bind(&envelope.user_id)
        .bind(now.date_naive().to_string())
        .bind(&envelope.payload.expected_date)
        .bind(subtotal as f64 / 100.0)
        .bind(tax as f64 / 100.0)
        .bind(total as f64 / 100.0)
        .bind(&envelope.payload.notes)
        .bind(&branch_json)
        .bind(&envelope.payload.currency)
        .bind(now.to_rfc3339())
        .bind(&envelope.branch_id)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if inserted.rows_affected() != 1 {
        return Err(CommandApiError::BranchAccessDenied);
    }
    for (index, line) in envelope.payload.lines.iter().enumerate() {
        let line_total = u64::try_from(
            (u128::from(line.quantity_milli) * u128::from(line.unit_cost_minor)) / 1000,
        )
        .map_err(storage)?;
        let inserted = sqlx::query(purchasing::INSERT_PURCHASE_ORDER_ITEM)
            .bind(&line.line_id)
            .bind(&envelope.payload.purchase_order_id)
            .bind(&line.product_id)
            .bind(as_i64(line.quantity_milli)?)
            .bind(as_i64(line.unit_cost_minor)?)
            .bind(as_i64(line_total)?)
            .bind(i64::try_from(index).map_err(storage)?)
            .bind(&envelope.branch_id)
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        if inserted.rows_affected() != 1 {
            return Err(CommandApiError::NotFound);
        }
    }
    let result = CreatePurchaseOrderResultV1 {
        purchase_order_id: envelope.payload.purchase_order_id.clone(),
        branch_id: envelope.branch_id.clone(),
        po_number,
        total_minor: total,
        status: "draft".to_string(),
    };
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        result,
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

pub async fn record_stock_movement(
    pool: &SqlitePool,
    envelope: &CommandEnvelope<RecordStockMovementV1>,
    context: &AtomicCommitContext,
) -> Result<IdempotencyOutcome<RecordStockMovementResultV1>, CommandApiError> {
    let now = Utc::now();
    let mut tx = pool.begin().await.map_err(storage)?;
    match claim(&mut tx, envelope, context, now).await? {
        Claim::Replay(json) => {
            tx.rollback().await.map_err(storage)?;
            return replay(&json);
        }
        Claim::Proceed => {}
    }
    let branch_json = serde_json::to_string(&[&envelope.branch_id]).map_err(storage)?;
    let row: Option<(i64, i64)> = sqlx::query_as(stock_movements::LOAD_STOCK_REVISION)
        .bind(&branch_json)
        .bind(&envelope.branch_id)
        .bind(&envelope.payload.product_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
    let Some((actual_i64, quantity)) = row else {
        return Err(CommandApiError::NotFound);
    };
    let actual = u64::try_from(actual_i64).map_err(storage)?;
    let next = require_revision(envelope, actual)?;
    let changed = sqlx::query(stock_movements::UPDATE_BRANCH_STOCK)
        .bind(&envelope.branch_id)
        .bind(&envelope.payload.product_id)
        .bind(envelope.payload.quantity_delta_milli)
        .bind(now.to_rfc3339())
        .bind(actual_i64)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if changed.rows_affected() != 1 {
        return Err(CommandApiError::RevisionConflict);
    }
    let after = quantity
        .checked_add(envelope.payload.quantity_delta_milli)
        .ok_or(CommandApiError::StorageUnavailable)?;
    let kind = match envelope.payload.kind {
        StockMovementKindV1::Adjustment => "adjustment",
        StockMovementKindV1::Damage => "damage",
        StockMovementKindV1::Return => "return",
        StockMovementKindV1::TransferIn => "transfer_in",
        StockMovementKindV1::TransferOut => "transfer_out",
    };
    let inserted = sqlx::query(stock_movements::INSERT_STOCK_MOVEMENT)
        .bind(&envelope.payload.movement_id)
        .bind(&branch_json)
        .bind(&envelope.payload.product_id)
        .bind(&envelope.payload.batch_id)
        .bind(kind)
        .bind(envelope.payload.quantity_delta_milli)
        .bind(&envelope.payload.reason_code)
        .bind(&envelope.payload.notes)
        .bind(&envelope.user_id)
        .bind(as_i64(next)?)
        .bind(now.to_rfc3339())
        .bind(&envelope.branch_id)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    if inserted.rows_affected() != 1 {
        return Err(CommandApiError::BranchAccessDenied);
    }
    sqlx::query(inventory::SYNC_BRANCH_ITEM_QUANTITY)
        .bind(&envelope.branch_id)
        .bind(&envelope.payload.product_id)
        .bind(after)
        .bind(as_i64(next)?)
        .bind(now.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
    let result = RecordStockMovementResultV1 {
        movement_id: envelope.payload.movement_id.clone(),
        product_id: envelope.payload.product_id.clone(),
        branch_id: envelope.branch_id.clone(),
        quantity_after_milli: after,
    };
    let outcome = finish(
        &mut tx,
        &envelope.command_id,
        &envelope.user_id,
        &envelope.node_id,
        &envelope.branch_id,
        context,
        next,
        result,
        now,
    )
    .await?;
    tx.commit().await.map_err(storage)?;
    Ok(outcome)
}

fn branch_json(branches: &[String]) -> Result<String, CommandApiError> {
    serde_json::to_string(branches).map_err(storage)
}
fn search_pattern(value: Option<&str>) -> String {
    value
        .map(|value| {
            format!(
                "%{}%",
                value
                    .replace('\\', "\\\\")
                    .replace('%', "\\%")
                    .replace('_', "\\_")
            )
        })
        .unwrap_or_default()
}
fn revision_cursor(cursor: Option<&str>, changed_after: Option<u64>) -> (i64, String) {
    cursor
        .and_then(|value| value.split_once(':'))
        .and_then(|(revision, id)| {
            revision
                .parse::<i64>()
                .ok()
                .map(|revision| (revision, id.to_string()))
        })
        .unwrap_or((
            changed_after.unwrap_or(0).try_into().unwrap_or(i64::MAX),
            String::new(),
        ))
}
fn date_cursor(cursor: Option<&str>) -> (String, String) {
    cursor
        .and_then(|value| value.split_once('|'))
        .map(|(date, id)| (date.to_string(), id.to_string()))
        .unwrap_or(("9999-12-31T23:59:59Z".to_string(), "~".to_string()))
}

#[derive(FromRow)]
struct InventoryProjectionRow {
    branch_id: String,
    product_id: String,
    sku: String,
    name: String,
    quantity_milli: i64,
    selling_price_minor: i64,
    active: i64,
    revision: i64,
}
pub async fn android_inventory(
    pool: &SqlitePool,
    branches: &[String],
    filter: &AndroidInventoryFilterV1,
    page: &ValidatedPage,
) -> Result<ProjectionPage<AndroidInventoryRowV1>, CommandApiError> {
    let (revision, id) = revision_cursor(page.cursor.as_deref(), filter.changed_after_revision);
    let limit = i64::from(page.limit) + 1;
    let rows = sqlx::query_as::<_, InventoryProjectionRow>(inventory::ANDROID_INVENTORY)
        .bind(branch_json(branches)?)
        .bind(revision)
        .bind(id)
        .bind(search_pattern(filter.search.as_deref()))
        .bind(i64::from(filter.include_inactive))
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let has_more = rows.len() > usize::from(page.limit);
    let mut items = Vec::new();
    for row in rows.into_iter().take(usize::from(page.limit)) {
        items.push(AndroidInventoryRowV1 {
            branch_id: row.branch_id,
            product_id: row.product_id,
            sku: row.sku,
            name: row.name,
            quantity_milli: row.quantity_milli,
            selling_price_minor: u64::try_from(row.selling_price_minor).map_err(storage)?,
            active: row.active == 1,
            revision: u64::try_from(row.revision).map_err(storage)?,
        });
    }
    let next_cursor = if has_more {
        items
            .last()
            .map(|row| format!("{}:{}", row.revision, row.product_id))
    } else {
        None
    };
    Ok(ProjectionPage { items, next_cursor })
}

#[derive(FromRow)]
struct PurchaseProjectionRow {
    branch_id: String,
    id: String,
    po_number: String,
    supplier_id: String,
    name: String,
    status: String,
    total_minor: i64,
    expected_date: Option<String>,
    revision: i64,
    updated_at: String,
}
pub async fn android_open_purchases(
    pool: &SqlitePool,
    branches: &[String],
    filter: &AndroidOpenPurchasesFilterV1,
    page: &ValidatedPage,
) -> Result<ProjectionPage<AndroidOpenPurchaseRowV1>, CommandApiError> {
    let (date, id) = date_cursor(page.cursor.as_deref());
    let rows = sqlx::query_as::<_, PurchaseProjectionRow>(purchasing::ANDROID_OPEN_PURCHASES)
        .bind(branch_json(branches)?)
        .bind(search_pattern(filter.search.as_deref()))
        .bind(&filter.supplier_id)
        .bind(date)
        .bind(id)
        .bind(i64::from(page.limit) + 1)
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let has_more = rows.len() > usize::from(page.limit);
    let mut cursor = None;
    let mut items = Vec::new();
    for row in rows.into_iter().take(usize::from(page.limit)) {
        cursor = Some(format!("{}|{}", row.updated_at, row.id));
        items.push(AndroidOpenPurchaseRowV1 {
            branch_id: row.branch_id,
            purchase_order_id: row.id,
            po_number: row.po_number,
            supplier_id: row.supplier_id,
            supplier_name: row.name,
            status: row.status,
            total_minor: u64::try_from(row.total_minor).map_err(storage)?,
            expected_date: row.expected_date,
            revision: u64::try_from(row.revision).map_err(storage)?,
        });
    }
    Ok(ProjectionPage {
        items,
        next_cursor: if has_more { cursor } else { None },
    })
}

#[derive(FromRow)]
struct SaleProjectionRow {
    branch_id: String,
    id: String,
    sale_number: i64,
    customer_name: Option<String>,
    total_minor: i64,
    payment_status: String,
    status: String,
    created_at: String,
    revision: i64,
}
pub async fn recent_sales(
    pool: &SqlitePool,
    branches: &[String],
    filter: &TillRecentSalesFilterV1,
    page: &ValidatedPage,
) -> Result<ProjectionPage<TillRecentSaleRowV1>, CommandApiError> {
    let (date, id) = date_cursor(page.cursor.as_deref());
    let rows = sqlx::query_as::<_, SaleProjectionRow>(sales::RECENT_TILL_SALES)
        .bind(branch_json(branches)?)
        .bind(search_pattern(filter.search.as_deref()))
        .bind(filter.opened_after.map(|v| v.to_rfc3339()))
        .bind(date)
        .bind(id)
        .bind(i64::from(page.limit) + 1)
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let has_more = rows.len() > usize::from(page.limit);
    let mut items = Vec::new();
    for row in rows.into_iter().take(usize::from(page.limit)) {
        items.push(TillRecentSaleRowV1 {
            branch_id: row.branch_id,
            sale_id: row.id,
            sale_number: u64::try_from(row.sale_number).map_err(storage)?,
            customer_name: row.customer_name,
            total_minor: u64::try_from(row.total_minor).map_err(storage)?,
            payment_status: row.payment_status,
            status: row.status,
            created_at: parse_time(&row.created_at)?,
            revision: u64::try_from(row.revision).map_err(storage)?,
        });
    }
    let next_cursor = if has_more {
        items
            .last()
            .map(|row| format!("{}|{}", row.created_at.to_rfc3339(), row.sale_id))
    } else {
        None
    };
    Ok(ProjectionPage { items, next_cursor })
}

#[derive(FromRow)]
struct ShiftProjectionRow {
    branch_id: String,
    id: String,
    user_id: String,
    opened_at: String,
    opening_balance_minor: i64,
    expected_closing_minor: Option<i64>,
    cash_in_minor: i64,
    cash_out_minor: i64,
    status: String,
    revision: i64,
}
pub async fn current_shift(
    pool: &SqlitePool,
    branches: &[String],
    filter: &TillCurrentShiftFilterV1,
    page: &ValidatedPage,
) -> Result<ProjectionPage<TillShiftRowV1>, CommandApiError> {
    let rows = sqlx::query_as::<_, ShiftProjectionRow>(till::CURRENT_SHIFT)
        .bind(branch_json(branches)?)
        .bind(&filter.user_id)
        .bind(i64::from(page.limit))
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let mut items = Vec::new();
    for row in rows {
        items.push(TillShiftRowV1 {
            branch_id: row.branch_id,
            shift_id: row.id,
            user_id: row.user_id,
            opened_at: parse_time(&row.opened_at)?,
            opening_balance_minor: u64::try_from(row.opening_balance_minor).map_err(storage)?,
            expected_closing_minor: row
                .expected_closing_minor
                .map(|v| u64::try_from(v).map_err(storage))
                .transpose()?,
            cash_in_minor: u64::try_from(row.cash_in_minor).map_err(storage)?,
            cash_out_minor: u64::try_from(row.cash_out_minor).map_err(storage)?,
            status: row.status,
            revision: u64::try_from(row.revision).map_err(storage)?,
        });
    }
    Ok(ProjectionPage {
        items,
        next_cursor: None,
    })
}

#[derive(FromRow)]
struct AlertProjectionRow {
    product_id: String,
    sku: String,
    name: String,
    branch_id: String,
    quantity_on_hand: f64,
    reorder_level: i64,
    revision: i64,
}
pub async fn reorder_alerts(
    pool: &SqlitePool,
    branches: &[String],
    filter: &InventoryAlertsFilter,
    page: &ValidatedPage,
) -> Result<ProjectionPage<InventoryAlertRow>, CommandApiError> {
    let (revision, id) = revision_cursor(page.cursor.as_deref(), None);
    let rows = sqlx::query_as::<_, AlertProjectionRow>(inventory::REORDER_ALERTS)
        .bind(branch_json(branches)?)
        .bind(i64::from(filter.include_out_of_stock))
        .bind(search_pattern(filter.search.as_deref()))
        .bind(revision)
        .bind(id)
        .bind(i64::from(page.limit) + 1)
        .fetch_all(pool)
        .await
        .map_err(storage)?;
    let has_more = rows.len() > usize::from(page.limit);
    let mut items = Vec::new();
    for row in rows.into_iter().take(usize::from(page.limit)) {
        items.push(InventoryAlertRow {
            product_id: row.product_id,
            sku: row.sku,
            name: row.name,
            branch_id: row.branch_id,
            quantity_on_hand: row.quantity_on_hand,
            reorder_level: u32::try_from(row.reorder_level).map_err(storage)?,
            revision: u64::try_from(row.revision).map_err(storage)?,
        });
    }
    let next_cursor = if has_more {
        items
            .last()
            .map(|row| format!("{}:{}", row.revision, row.product_id))
    } else {
        None
    };
    Ok(ProjectionPage { items, next_cursor })
}
