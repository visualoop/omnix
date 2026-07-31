#[path = "../src/command_api/mod.rs"]
mod command_api;

use std::collections::BTreeSet;

use chrono::{Duration, Utc};
use command_api::authorization::{
    AuthenticatedPrincipal, AuthenticationLevel, PermissionEffect, PermissionGrant, RoleGrant,
    SessionAccess, SessionContext,
};
use command_api::contracts::{
    BranchScope, CommandEnvelope, PageRequest, ProjectionPage, ReadProjectionRequest,
};
use command_api::domain_commands::{
    handle_complete_sale, handle_create_purchase_order, handle_record_stock_movement,
    handle_upsert_branch_customer, handle_upsert_branch_item, CompleteSaleResultV1, CompleteSaleV1,
    CreatePurchaseOrderResultV1, CreatePurchaseOrderV1, PurchaseOrderLineV1,
    RecordStockMovementResultV1, RecordStockMovementV1, SaleLineV1, SalePaymentV1,
    StockMovementKindV1, UpsertBranchCustomerResultV1, UpsertBranchCustomerV1,
    UpsertBranchItemResultV1, UpsertBranchItemV1, COMPLETE_SALE_COMMAND,
    CREATE_PURCHASE_ORDER_COMMAND, RECORD_STOCK_MOVEMENT_COMMAND, UPSERT_BRANCH_CUSTOMER_COMMAND,
    UPSERT_BRANCH_ITEM_COMMAND,
};
use command_api::error::CommandApiError;
use command_api::idempotency::{
    receipt_v1, AtomicCommitContext, IdempotencyOutcome, IdempotentMutation,
};
use command_api::local_auth::{
    authenticate_branch_local, BranchLocalAuthenticationStore, BranchLocalLoginV1,
    IssuedLocalSession, LocalAccessV1, LocalCredentialRecord, LocalPasswordVerifier,
    LOCAL_LOGIN_SCHEMA,
};
use command_api::projections::{
    handle_android_inventory_read, handle_till_recent_sales_read, AndroidInventoryFilterV1,
    AndroidInventoryQuery, AndroidInventoryRowV1, TillRecentSaleRowV1, TillRecentSalesFilterV1,
    TillRecentSalesQuery, ANDROID_INVENTORY_PROJECTION, TILL_RECENT_SALES_PROJECTION,
};
use command_api::query;
use uuid::Uuid;

#[derive(Clone)]
struct TestIds {
    user: String,
    node: String,
    branch: String,
    other_branch: String,
    resource: String,
}

fn ids() -> TestIds {
    TestIds {
        user: Uuid::new_v4().to_string(),
        node: Uuid::new_v4().to_string(),
        branch: Uuid::new_v4().to_string(),
        other_branch: Uuid::new_v4().to_string(),
        resource: Uuid::new_v4().to_string(),
    }
}

fn principal(ids: &TestIds) -> AuthenticatedPrincipal {
    let permissions = [
        "pos.use",
        "sales.view",
        "inventory.view",
        "inventory.edit",
        "customers.edit",
        "purchase_orders.create",
        "purchase_orders.view",
        "cash_register.use",
    ]
    .into_iter()
    .map(|permission| PermissionGrant {
        permission: permission.to_string(),
        effect: PermissionEffect::Allow,
        branch_id: None,
        module_id: Some("core".to_string()),
    })
    .collect();

    AuthenticatedPrincipal {
        user_id: ids.user.clone(),
        assigned_branches: BTreeSet::from([ids.branch.clone()]),
        enabled_modules: BTreeSet::from(["core".to_string()]),
        roles: vec![RoleGrant {
            role_id: "role_manager".to_string(),
            branch_id: None,
            module_id: Some("core".to_string()),
        }],
        permissions,
        licence_valid: true,
    }
}

fn session(ids: &TestIds, level: AuthenticationLevel) -> SessionContext {
    SessionContext {
        session_id: Uuid::new_v4().to_string(),
        node_id: ids.node.clone(),
        access: SessionAccess::Android,
        authentication_level: level,
        branch_local: true,
        issued_at: Utc::now() - Duration::minutes(1),
        expires_at: Utc::now() + Duration::hours(1),
        revoked: false,
        principal: principal(ids),
    }
}

fn envelope<P>(ids: &TestIds, command_type: &str, payload: P) -> CommandEnvelope<P> {
    CommandEnvelope {
        schema_version: 1,
        command_id: Uuid::new_v4().to_string(),
        command_type: command_type.to_string(),
        node_id: ids.node.clone(),
        user_id: ids.user.clone(),
        branch_id: ids.branch.clone(),
        expected_revision: Some(0),
        issued_at: Utc::now(),
        payload,
    }
}

struct CaptureRepository<R> {
    calls: usize,
    response: R,
    context: Option<AtomicCommitContext>,
}

impl<P, R: Clone> IdempotentMutation<P, R> for CaptureRepository<R> {
    fn execute_once(
        &mut self,
        envelope: &CommandEnvelope<P>,
        context: &AtomicCommitContext,
    ) -> Result<IdempotencyOutcome<R>, CommandApiError> {
        self.calls += 1;
        self.context = Some(context.clone());
        Ok(IdempotencyOutcome::Applied(receipt_v1(
            envelope.command_id.clone(),
            Utc::now(),
            envelope.expected_revision.unwrap_or_default() + 1,
            self.response.clone(),
        )))
    }
}

#[test]
fn all_domain_commands_emit_atomic_audit_and_outbox_contexts() {
    let ids = ids();
    let user_session = session(&ids, AuthenticationLevel::User);
    let elevated_session = session(&ids, AuthenticationLevel::Elevated);

    let sale_id = Uuid::new_v4().to_string();
    let sale = envelope(
        &ids,
        COMPLETE_SALE_COMMAND,
        CompleteSaleV1 {
            sale_id: sale_id.clone(),
            customer_id: None,
            lines: vec![SaleLineV1 {
                line_id: Uuid::new_v4().to_string(),
                product_id: ids.resource.clone(),
                batch_id: None,
                quantity_milli: 1_000,
                unit_price_minor: 25_000,
                discount_minor: 0,
                tax_basis_points: 1_600,
            }],
            payments: vec![SalePaymentV1 {
                payment_id: Uuid::new_v4().to_string(),
                method_id: "cash".to_string(),
                amount_minor: 25_000,
                reference: None,
            }],
            notes: None,
        },
    );
    let mut sale_repo = CaptureRepository {
        calls: 0,
        response: CompleteSaleResultV1 {
            sale_id,
            sale_number: 1,
            total_minor: 25_000,
            payment_status: "paid".to_string(),
        },
        context: None,
    };
    handle_complete_sale(&user_session, &sale, &mut sale_repo, Utc::now()).unwrap();
    assert_context(&sale_repo.context.unwrap(), "pos.use", "sales.completed.v1");

    let item = envelope(
        &ids,
        UPSERT_BRANCH_ITEM_COMMAND,
        UpsertBranchItemV1 {
            product_id: ids.resource.clone(),
            name: "Aspirin".to_string(),
            sku: "ASP-100".to_string(),
            barcode: None,
            unit: "tablet".to_string(),
            buying_price_minor: 100,
            selling_price_minor: 150,
            reorder_level_milli: 10_000,
            active: true,
        },
    );
    let mut item_repo = CaptureRepository {
        calls: 0,
        response: UpsertBranchItemResultV1 {
            product_id: ids.resource.clone(),
            branch_id: ids.branch.clone(),
            active: true,
        },
        context: None,
    };
    handle_upsert_branch_item(&user_session, &item, &mut item_repo, Utc::now()).unwrap();
    assert_context(
        &item_repo.context.unwrap(),
        "inventory.edit",
        "inventory.branch_item.upserted.v1",
    );

    let customer_id = Uuid::new_v4().to_string();
    let customer = envelope(
        &ids,
        UPSERT_BRANCH_CUSTOMER_COMMAND,
        UpsertBranchCustomerV1 {
            customer_id: customer_id.clone(),
            name: "Test Customer".to_string(),
            phone: Some("+254700000000".to_string()),
            email: None,
            credit_limit_minor: 100_000,
            active: true,
        },
    );
    let mut customer_repo = CaptureRepository {
        calls: 0,
        response: UpsertBranchCustomerResultV1 {
            customer_id,
            branch_id: ids.branch.clone(),
            active: true,
        },
        context: None,
    };
    handle_upsert_branch_customer(&user_session, &customer, &mut customer_repo, Utc::now())
        .unwrap();
    assert_context(
        &customer_repo.context.unwrap(),
        "customers.edit",
        "customers.branch_record.upserted.v1",
    );

    let po_id = Uuid::new_v4().to_string();
    let purchase = envelope(
        &ids,
        CREATE_PURCHASE_ORDER_COMMAND,
        CreatePurchaseOrderV1 {
            purchase_order_id: po_id.clone(),
            supplier_id: Uuid::new_v4().to_string(),
            expected_date: Some("2026-08-05".to_string()),
            currency: "KES".to_string(),
            lines: vec![PurchaseOrderLineV1 {
                line_id: Uuid::new_v4().to_string(),
                product_id: ids.resource.clone(),
                quantity_milli: 5_000,
                unit_cost_minor: 1_000,
                tax_basis_points: 1_600,
            }],
            notes: None,
        },
    );
    let mut purchase_repo = CaptureRepository {
        calls: 0,
        response: CreatePurchaseOrderResultV1 {
            purchase_order_id: po_id,
            branch_id: ids.branch.clone(),
            po_number: "PO-1".to_string(),
            total_minor: 5_800,
            status: "draft".to_string(),
        },
        context: None,
    };
    handle_create_purchase_order(&user_session, &purchase, &mut purchase_repo, Utc::now()).unwrap();
    assert_context(
        &purchase_repo.context.unwrap(),
        "purchase_orders.create",
        "purchasing.purchase_order.created.v1",
    );

    let movement_id = Uuid::new_v4().to_string();
    let movement = envelope(
        &ids,
        RECORD_STOCK_MOVEMENT_COMMAND,
        RecordStockMovementV1 {
            movement_id: movement_id.clone(),
            product_id: ids.resource.clone(),
            batch_id: None,
            kind: StockMovementKindV1::Adjustment,
            quantity_delta_milli: -1_000,
            reason_code: "cycle-count".to_string(),
            notes: None,
        },
    );
    let mut movement_repo = CaptureRepository {
        calls: 0,
        response: RecordStockMovementResultV1 {
            movement_id,
            product_id: ids.resource.clone(),
            branch_id: ids.branch.clone(),
            quantity_after_milli: 9_000,
        },
        context: None,
    };
    handle_record_stock_movement(&elevated_session, &movement, &mut movement_repo, Utc::now())
        .unwrap();
    assert_context(
        &movement_repo.context.unwrap(),
        "inventory.edit",
        "inventory.stock_movement.recorded.v1",
    );
}

fn assert_context(context: &AtomicCommitContext, permission: &str, event_type: &str) {
    assert_eq!(context.permission, permission);
    assert_eq!(context.audit.permission, permission);
    assert_eq!(context.outbox.event_type, event_type);
    assert_eq!(context.outbox.schema_version, 1);
    assert_eq!(context.fingerprint.0.len(), 64);
}

#[test]
fn auth_level_and_revision_are_rejected_before_domain_repository_access() {
    let ids = ids();
    let movement = envelope(
        &ids,
        RECORD_STOCK_MOVEMENT_COMMAND,
        RecordStockMovementV1 {
            movement_id: Uuid::new_v4().to_string(),
            product_id: ids.resource.clone(),
            batch_id: None,
            kind: StockMovementKindV1::Damage,
            quantity_delta_milli: -1_000,
            reason_code: "damaged".to_string(),
            notes: None,
        },
    );
    let mut repository = CaptureRepository {
        calls: 0,
        response: RecordStockMovementResultV1 {
            movement_id: movement.payload.movement_id.clone(),
            product_id: ids.resource.clone(),
            branch_id: ids.branch.clone(),
            quantity_after_milli: 0,
        },
        context: None,
    };
    assert_eq!(
        handle_record_stock_movement(
            &session(&ids, AuthenticationLevel::User),
            &movement,
            &mut repository,
            Utc::now(),
        ),
        Err(CommandApiError::AuthenticationLevelInsufficient)
    );
    assert_eq!(repository.calls, 0);

    let mut missing_revision = movement;
    missing_revision.expected_revision = None;
    assert!(matches!(
        handle_record_stock_movement(
            &session(&ids, AuthenticationLevel::Elevated),
            &missing_revision,
            &mut repository,
            Utc::now(),
        ),
        Err(CommandApiError::InvalidEnvelope { .. })
    ));
    assert_eq!(repository.calls, 0);
}

#[test]
fn fixed_sql_leaves_have_parameterized_mandatory_branch_scopes() {
    let reads = [
        query::customers::LOAD_BRANCH_CUSTOMER_REVISION,
        query::customers::ANDROID_CUSTOMERS,
        query::inventory::ANDROID_INVENTORY,
        query::inventory::LOAD_BRANCH_ITEM_REVISION,
        query::purchasing::LOAD_PURCHASE_ORDER_REVISION,
        query::purchasing::ANDROID_OPEN_PURCHASES,
        query::sales::RECENT_TILL_SALES,
        query::sales::LOAD_SALE_REVISION,
        query::stock_movements::LOAD_STOCK_REVISION,
        query::stock_movements::STOCK_MOVEMENTS,
        query::till::CURRENT_SHIFT,
        query::till::LOAD_SHIFT_REVISION,
    ];
    for sql in reads {
        assert!(query::has_mandatory_branch_scope(sql), "unsafe SQL: {sql}");
        assert!(sql.contains('?'));
        assert!(!sql.contains("SELECT *"));
    }

    let writes = [
        query::customers::UPSERT_BRANCH_CUSTOMER,
        query::inventory::UPSERT_BRANCH_ITEM,
        query::purchasing::INSERT_PURCHASE_ORDER,
        query::sales::INSERT_SALE,
        query::stock_movements::UPDATE_BRANCH_STOCK,
        query::stock_movements::INSERT_STOCK_MOVEMENT,
    ];
    for sql in writes {
        assert!(sql.contains("branch_id"));
        assert!(sql.contains('?'));
        assert!(!sql.contains("format!("));
        assert!(!sql.contains("{branch"));
    }

    assert!(query::atomic::CLAIM_COMMAND.contains("command_ledger"));
    assert!(query::atomic::INSERT_AUDIT.contains("audit_log"));
    assert!(query::atomic::INSERT_OUTBOX.contains("command_outbox"));
    assert!(query::atomic::COMPLETE_COMMAND.contains("state = 'processing'"));
}

#[derive(Default)]
struct AndroidInventoryFake {
    calls: usize,
    rows: Vec<AndroidInventoryRowV1>,
}

impl AndroidInventoryQuery for AndroidInventoryFake {
    fn fetch_android_inventory(
        &mut self,
        _: &[String],
        _: &AndroidInventoryFilterV1,
        _: &command_api::contracts::ValidatedPage,
    ) -> Result<ProjectionPage<AndroidInventoryRowV1>, CommandApiError> {
        self.calls += 1;
        Ok(ProjectionPage {
            items: self.rows.clone(),
            next_cursor: None,
        })
    }
}

struct TillSalesFake;

impl TillRecentSalesQuery for TillSalesFake {
    fn fetch_till_recent_sales(
        &mut self,
        _: &[String],
        _: &TillRecentSalesFilterV1,
        _: &command_api::contracts::ValidatedPage,
    ) -> Result<ProjectionPage<TillRecentSaleRowV1>, CommandApiError> {
        Ok(ProjectionPage {
            items: Vec::new(),
            next_cursor: None,
        })
    }
}

#[test]
fn mobile_and_till_projections_enforce_branch_scope_and_bounded_routes() {
    let ids = ids();
    let request = ReadProjectionRequest {
        schema_version: 1,
        request_id: Uuid::new_v4().to_string(),
        projection: ANDROID_INVENTORY_PROJECTION.to_string(),
        node_id: ids.node.clone(),
        user_id: ids.user.clone(),
        branch_scope: BranchScope::Branch {
            branch_id: ids.branch.clone(),
        },
        page: PageRequest {
            cursor: None,
            limit: Some(1),
        },
        filter: AndroidInventoryFilterV1::default(),
    };
    let mut query = AndroidInventoryFake {
        rows: vec![AndroidInventoryRowV1 {
            branch_id: ids.other_branch.clone(),
            product_id: ids.resource.clone(),
            sku: "SKU".to_string(),
            name: "Item".to_string(),
            quantity_milli: 1_000,
            selling_price_minor: 100,
            active: true,
            revision: 1,
        }],
        ..AndroidInventoryFake::default()
    };
    assert_eq!(
        handle_android_inventory_read(
            &session(&ids, AuthenticationLevel::User),
            &request,
            &mut query,
            Utc::now(),
        ),
        Err(CommandApiError::InvalidProjectionResult)
    );

    let till_request = ReadProjectionRequest {
        schema_version: 1,
        request_id: Uuid::new_v4().to_string(),
        projection: TILL_RECENT_SALES_PROJECTION.to_string(),
        node_id: ids.node.clone(),
        user_id: ids.user.clone(),
        branch_scope: BranchScope::AllAssigned,
        page: PageRequest {
            cursor: None,
            limit: Some(10),
        },
        filter: TillRecentSalesFilterV1::default(),
    };
    assert_eq!(
        handle_till_recent_sales_read(
            &session(&ids, AuthenticationLevel::User),
            &till_request,
            &mut TillSalesFake,
            Utc::now(),
        ),
        Err(CommandApiError::BranchAccessDenied)
    );
}

struct LocalVerifier;

impl LocalPasswordVerifier for LocalVerifier {
    fn verify_or_dummy(&self, password: &str, hash: Option<&str>) -> bool {
        password == "correct horse" && hash == Some("argon2-hash")
    }
}

struct LocalStore {
    credential: Option<LocalCredentialRecord>,
    failed_attempts: usize,
    issued: usize,
}

impl BranchLocalAuthenticationStore for LocalStore {
    fn find_local_credential(
        &mut self,
        _: &str,
        _: &str,
        _: &str,
    ) -> Result<Option<LocalCredentialRecord>, CommandApiError> {
        Ok(self.credential.clone())
    }

    fn record_failed_attempt(
        &mut self,
        _: &str,
        _: &str,
        _: &str,
        _: chrono::DateTime<Utc>,
    ) -> Result<(), CommandApiError> {
        self.failed_attempts += 1;
        Ok(())
    }

    fn issue_local_session(
        &mut self,
        credential: &LocalCredentialRecord,
        access: SessionAccess,
        now: chrono::DateTime<Utc>,
        expires_at: chrono::DateTime<Utc>,
    ) -> Result<IssuedLocalSession, CommandApiError> {
        self.issued += 1;
        Ok(IssuedLocalSession {
            session: SessionContext {
                session_id: Uuid::new_v4().to_string(),
                node_id: credential.node_id.clone(),
                access,
                authentication_level: AuthenticationLevel::User,
                branch_local: true,
                issued_at: now,
                expires_at,
                revoked: false,
                principal: credential.principal.clone(),
            },
            access_token: "a".repeat(64),
        })
    }
}

#[test]
fn local_credentials_issue_branch_bound_sessions_without_wan_dependency() {
    let ids = ids();
    let credential = LocalCredentialRecord {
        user_id: ids.user.clone(),
        username: "cashier".to_string(),
        password_hash: "argon2-hash".to_string(),
        branch_id: ids.branch.clone(),
        node_id: ids.node.clone(),
        user_active: true,
        node_approved: true,
        allow_desktop: true,
        allow_android: true,
        principal: principal(&ids),
    };
    let request = BranchLocalLoginV1 {
        schema_version: 1,
        request_id: Uuid::new_v4().to_string(),
        login_type: LOCAL_LOGIN_SCHEMA.to_string(),
        node_id: ids.node.clone(),
        branch_id: ids.branch.clone(),
        username: "Cashier".to_string(),
        password: "correct horse".to_string(),
        requested_access: LocalAccessV1::Android,
    };
    let mut store = LocalStore {
        credential: Some(credential),
        failed_attempts: 0,
        issued: 0,
    };
    let result = authenticate_branch_local(
        &request,
        &mut store,
        &LocalVerifier,
        Utc::now(),
        Duration::hours(8),
    )
    .unwrap();
    assert!(result.branch_local);
    assert_eq!(result.user_id, ids.user);
    assert_eq!(result.branch_id, ids.branch);
    assert_eq!(store.issued, 1);
    assert_eq!(store.failed_attempts, 0);

    let mut wrong = request;
    wrong.password = "wrong".to_string();
    assert_eq!(
        authenticate_branch_local(
            &wrong,
            &mut store,
            &LocalVerifier,
            Utc::now(),
            Duration::hours(8),
        ),
        Err(CommandApiError::AuthenticationFailed)
    );
    assert_eq!(store.failed_attempts, 1);
    assert_eq!(store.issued, 1);
}

#[test]
fn v1_dtos_reject_unknown_fields_and_wrong_schema_versions() {
    let ids = ids();
    let payload = UpsertBranchItemV1 {
        product_id: ids.resource.clone(),
        name: "Item".to_string(),
        sku: "SKU".to_string(),
        barcode: None,
        unit: "piece".to_string(),
        buying_price_minor: 1,
        selling_price_minor: 2,
        reorder_level_milli: 1_000,
        active: true,
    };
    let mut command = envelope(&ids, UPSERT_BRANCH_ITEM_COMMAND, payload);
    command.schema_version = 2;
    let mut repository = CaptureRepository {
        calls: 0,
        response: UpsertBranchItemResultV1 {
            product_id: Uuid::new_v4().to_string(),
            branch_id: ids.branch.clone(),
            active: true,
        },
        context: None,
    };
    assert!(matches!(
        handle_upsert_branch_item(
            &session(&ids, AuthenticationLevel::User),
            &command,
            &mut repository,
            Utc::now(),
        ),
        Err(CommandApiError::InvalidEnvelope { .. })
    ));
    assert_eq!(repository.calls, 0);

    let mut value = serde_json::to_value(&command).unwrap();
    value["payload"]["rawSql"] = serde_json::json!("DELETE FROM sales");
    assert!(serde_json::from_value::<CommandEnvelope<UpsertBranchItemV1>>(value).is_err());
}
