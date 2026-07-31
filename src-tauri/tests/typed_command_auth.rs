#[path = "../src/command_api/mod.rs"]
mod command_api;

use std::collections::{BTreeSet, HashMap};

use chrono::{Duration, Utc};
use command_api::authorization::{
    AuthenticatedPrincipal, AuthenticationLevel, PermissionEffect, PermissionGrant, RoleGrant,
    SessionAccess, SessionContext, MAX_READ_BRANCHES,
};
use command_api::contracts::{
    BranchScope, CommandEnvelope, PageRequest, ProjectionPage, ReadProjectionRequest,
    DEFAULT_READ_LIMIT, MAX_PROJECTION_PAGE_BYTES,
};
use command_api::error::CommandApiError;
use command_api::idempotency::{
    fingerprint_command, AtomicCommitContext, CommandFingerprint, CommandReceipt,
    IdempotencyOutcome, IdempotentMutation,
};
use command_api::pilot_inventory::{
    handle_inventory_alerts_read, handle_set_reorder_level, InventoryAlertRow,
    InventoryAlertsFilter, InventoryAlertsQuery, SetReorderLevel, SetReorderLevelResult,
    INVENTORY_ALERTS_PROJECTION, SET_REORDER_LEVEL_COMMAND,
};
use uuid::Uuid;

#[derive(Default)]
struct FakeMutationRepository {
    levels: HashMap<(String, String), (u32, u64)>,
    records: HashMap<String, (CommandFingerprint, CommandReceipt<SetReorderLevelResult>)>,
    mutation_count: usize,
}

impl IdempotentMutation<SetReorderLevel, SetReorderLevelResult> for FakeMutationRepository {
    fn execute_once(
        &mut self,
        envelope: &CommandEnvelope<SetReorderLevel>,
        context: &AtomicCommitContext,
    ) -> Result<IdempotencyOutcome<SetReorderLevelResult>, CommandApiError> {
        let fingerprint = &context.fingerprint;
        if let Some((stored_fingerprint, receipt)) = self.records.get(&envelope.command_id) {
            if stored_fingerprint != fingerprint {
                return Err(CommandApiError::IdempotencyConflict);
            }
            return Ok(IdempotencyOutcome::Replayed(receipt.clone()));
        }

        let key = (
            envelope.branch_id.clone(),
            envelope.payload.product_id.clone(),
        );
        let (previous, revision) = self.levels.get(&key).copied().unwrap_or((0, 0));
        if envelope
            .expected_revision
            .is_some_and(|expected| expected != revision)
        {
            return Err(CommandApiError::RevisionConflict);
        }
        let resulting_revision = revision + 1;
        self.levels
            .insert(key, (envelope.payload.reorder_level, resulting_revision));
        self.mutation_count += 1;

        let receipt = CommandReceipt {
            schema_version: 1,
            command_id: envelope.command_id.clone(),
            committed_at: Utc::now(),
            resulting_revision,
            response: SetReorderLevelResult {
                product_id: envelope.payload.product_id.clone(),
                branch_id: envelope.branch_id.clone(),
                previous_reorder_level: previous,
                reorder_level: envelope.payload.reorder_level,
            },
        };
        self.records.insert(
            envelope.command_id.clone(),
            (fingerprint.clone(), receipt.clone()),
        );
        Ok(IdempotencyOutcome::Applied(receipt))
    }
}

#[derive(Default)]
struct FakeInventoryQuery {
    calls: usize,
    rows: Vec<InventoryAlertRow>,
    force_oversized_page: bool,
    bypass_branch_filter: bool,
    seen_branches: Vec<String>,
    seen_filter: Option<InventoryAlertsFilter>,
    seen_page: Option<command_api::contracts::ValidatedPage>,
}

impl InventoryAlertsQuery for FakeInventoryQuery {
    fn fetch_inventory_alerts(
        &mut self,
        authorized_branches: &[String],
        filter: &InventoryAlertsFilter,
        page: &command_api::contracts::ValidatedPage,
    ) -> Result<ProjectionPage<InventoryAlertRow>, CommandApiError> {
        self.calls += 1;
        self.seen_branches = authorized_branches.to_vec();
        self.seen_filter = Some(filter.clone());
        self.seen_page = Some(page.clone());
        let take = if self.force_oversized_page {
            usize::from(page.limit) + 1
        } else {
            usize::from(page.limit)
        };
        let items = self
            .rows
            .iter()
            .filter(|row| self.bypass_branch_filter || authorized_branches.contains(&row.branch_id))
            .take(take)
            .cloned()
            .collect();
        Ok(ProjectionPage {
            items,
            next_cursor: None,
        })
    }
}

struct TestIds {
    user: String,
    node: String,
    branch_a: String,
    branch_b: String,
    product: String,
}

fn ids() -> TestIds {
    TestIds {
        user: Uuid::new_v4().to_string(),
        node: Uuid::new_v4().to_string(),
        branch_a: Uuid::new_v4().to_string(),
        branch_b: Uuid::new_v4().to_string(),
        product: Uuid::new_v4().to_string(),
    }
}

fn session(
    ids: &TestIds,
    access: SessionAccess,
    assigned_branches: impl IntoIterator<Item = String>,
) -> SessionContext {
    SessionContext {
        session_id: Uuid::new_v4().to_string(),
        node_id: ids.node.clone(),
        access,
        authentication_level: AuthenticationLevel::User,
        branch_local: false,
        issued_at: Utc::now() - Duration::minutes(1),
        expires_at: Utc::now() + Duration::hours(1),
        revoked: false,
        principal: AuthenticatedPrincipal {
            user_id: ids.user.clone(),
            assigned_branches: assigned_branches.into_iter().collect::<BTreeSet<_>>(),
            enabled_modules: BTreeSet::from(["core".to_string()]),
            roles: vec![RoleGrant {
                role_id: "role_manager".to_string(),
                branch_id: None,
                module_id: Some("core".to_string()),
            }],
            permissions: vec![
                PermissionGrant {
                    permission: "inventory.edit".to_string(),
                    effect: PermissionEffect::Allow,
                    branch_id: None,
                    module_id: Some("core".to_string()),
                },
                PermissionGrant {
                    permission: "inventory.view".to_string(),
                    effect: PermissionEffect::Allow,
                    branch_id: None,
                    module_id: Some("core".to_string()),
                },
            ],
            licence_valid: true,
        },
    }
}

fn command(ids: &TestIds, branch_id: &str) -> CommandEnvelope<SetReorderLevel> {
    CommandEnvelope {
        schema_version: 1,
        command_id: Uuid::new_v4().to_string(),
        command_type: SET_REORDER_LEVEL_COMMAND.to_string(),
        node_id: ids.node.clone(),
        user_id: ids.user.clone(),
        branch_id: branch_id.to_string(),
        expected_revision: Some(0),
        issued_at: Utc::now(),
        payload: SetReorderLevel {
            product_id: ids.product.clone(),
            reorder_level: 12,
        },
    }
}

fn read_request(
    ids: &TestIds,
    branch_scope: BranchScope,
    limit: Option<u16>,
) -> ReadProjectionRequest<InventoryAlertsFilter> {
    ReadProjectionRequest {
        schema_version: 1,
        request_id: Uuid::new_v4().to_string(),
        projection: INVENTORY_ALERTS_PROJECTION.to_string(),
        node_id: ids.node.clone(),
        user_id: ids.user.clone(),
        branch_scope,
        page: PageRequest {
            cursor: None,
            limit,
        },
        filter: InventoryAlertsFilter::default(),
    }
}

fn row(ids: &TestIds, branch_id: &str) -> InventoryAlertRow {
    InventoryAlertRow {
        product_id: ids.product.clone(),
        sku: "SKU-1".to_string(),
        name: "Pilot item".to_string(),
        branch_id: branch_id.to_string(),
        quantity_on_hand: 2.5,
        reorder_level: 12,
        revision: 1,
    }
}

#[test]
fn unauthorized_branch_access_is_rejected_before_ports() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let envelope = command(&ids, &ids.branch_b);
    let mut repository = FakeMutationRepository::default();
    assert_eq!(
        handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::BranchAccessDenied)
    );
    assert_eq!(repository.mutation_count, 0);
    assert!(repository.records.is_empty());

    let request = read_request(
        &ids,
        BranchScope::Branch {
            branch_id: ids.branch_b.clone(),
        },
        Some(20),
    );
    let mut query = FakeInventoryQuery::default();
    assert_eq!(
        handle_inventory_alerts_read(&session, &request, &mut query, Utc::now()),
        Err(CommandApiError::BranchAccessDenied)
    );
    assert_eq!(query.calls, 0);
}

#[test]
fn browser_session_can_read_but_cannot_mutate() {
    let ids = ids();
    let session = session(&ids, SessionAccess::BrowserReadOnly, [ids.branch_a.clone()]);
    let envelope = command(&ids, &ids.branch_a);
    let mut repository = FakeMutationRepository::default();
    assert_eq!(
        handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::MutationNotAllowed)
    );
    assert_eq!(repository.mutation_count, 0);

    let request = read_request(
        &ids,
        BranchScope::Branch {
            branch_id: ids.branch_a.clone(),
        },
        Some(10),
    );
    let mut query = FakeInventoryQuery {
        rows: vec![row(&ids, &ids.branch_a)],
        ..FakeInventoryQuery::default()
    };
    let response = handle_inventory_alerts_read(&session, &request, &mut query, Utc::now())
        .expect("browser projection should remain readable");
    assert_eq!(response.items.len(), 1);
    assert_eq!(response.items[0].quantity_on_hand, 2.5);
}

#[test]
fn android_session_can_apply_an_authorized_mutation() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Android, [ids.branch_a.clone()]);
    let envelope = command(&ids, &ids.branch_a);
    let mut repository = FakeMutationRepository::default();
    assert!(matches!(
        handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now()),
        Ok(IdempotencyOutcome::Applied(_))
    ));
    assert_eq!(repository.mutation_count, 1);
}

#[test]
fn identity_node_and_session_failures_precede_repository_access() {
    let ids = ids();
    let envelope = command(&ids, &ids.branch_a);
    let mut repository = FakeMutationRepository::default();

    let mut wrong_user = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    wrong_user.principal.user_id = Uuid::new_v4().to_string();
    assert_eq!(
        handle_set_reorder_level(&wrong_user, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::IdentityMismatch)
    );

    let mut wrong_node = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    wrong_node.node_id = Uuid::new_v4().to_string();
    assert_eq!(
        handle_set_reorder_level(&wrong_node, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::NodeMismatch)
    );

    let mut expired = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    expired.issued_at = Utc::now() - Duration::hours(2);
    expired.expires_at = Utc::now() - Duration::hours(1);
    assert_eq!(
        handle_set_reorder_level(&expired, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::SessionExpired)
    );

    let mut revoked = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    revoked.revoked = true;
    assert_eq!(
        handle_set_reorder_level(&revoked, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::SessionRevoked)
    );

    let mut invalid = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    invalid.session_id = "caller-supplied-session".to_string();
    assert_eq!(
        handle_set_reorder_level(&invalid, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::InvalidSession)
    );
    assert_eq!(repository.mutation_count, 0);
}

#[test]
fn envelope_and_payload_validation_precede_repository_access() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let mut repository = FakeMutationRepository::default();

    let mut wrong_type = command(&ids, &ids.branch_a);
    wrong_type.command_type = "inventory.notAllowed.v1".to_string();
    assert!(matches!(
        handle_set_reorder_level(&session, &wrong_type, &mut repository, Utc::now()),
        Err(CommandApiError::InvalidEnvelope { .. })
    ));

    let mut stale = command(&ids, &ids.branch_a);
    stale.issued_at = Utc::now() - Duration::days(31);
    assert_eq!(
        handle_set_reorder_level(&session, &stale, &mut repository, Utc::now()),
        Err(CommandApiError::StaleCommand)
    );

    let mut future = command(&ids, &ids.branch_a);
    future.issued_at = Utc::now() + Duration::minutes(6);
    assert!(matches!(
        handle_set_reorder_level(&session, &future, &mut repository, Utc::now()),
        Err(CommandApiError::InvalidEnvelope { .. })
    ));

    let mut all_branches = command(&ids, "all-branches");
    all_branches.expected_revision = None;
    assert_eq!(
        handle_set_reorder_level(&session, &all_branches, &mut repository, Utc::now()),
        Err(CommandApiError::AllBranchesMutationDenied)
    );

    let mut excessive = command(&ids, &ids.branch_a);
    excessive.payload.reorder_level = 1_000_001;
    assert!(matches!(
        handle_set_reorder_level(&session, &excessive, &mut repository, Utc::now()),
        Err(CommandApiError::InvalidEnvelope { .. })
    ));
    assert_eq!(repository.mutation_count, 0);
}

#[test]
fn licence_module_role_permission_and_deny_override_are_enforced() {
    let ids = ids();
    let envelope = command(&ids, &ids.branch_a);
    let mut repository = FakeMutationRepository::default();

    let mut unlicensed = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    unlicensed.principal.licence_valid = false;
    assert_eq!(
        handle_set_reorder_level(&unlicensed, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::LicenceRequired)
    );

    let mut missing_module = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    missing_module.principal.enabled_modules.clear();
    assert_eq!(
        handle_set_reorder_level(&missing_module, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::ModuleAccessDenied)
    );

    let mut missing_permission = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    missing_permission
        .principal
        .permissions
        .retain(|grant| grant.permission != "inventory.edit");
    assert_eq!(
        handle_set_reorder_level(&missing_permission, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::PermissionDenied)
    );

    let mut wrong_role_scope = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    wrong_role_scope.principal.roles[0].branch_id = Some(ids.branch_b.clone());
    assert_eq!(
        handle_set_reorder_level(&wrong_role_scope, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::RoleAccessDenied)
    );

    let mut denied = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    denied.principal.permissions.push(PermissionGrant {
        permission: "inventory.edit".to_string(),
        effect: PermissionEffect::Deny,
        branch_id: Some(ids.branch_a.clone()),
        module_id: Some("core".to_string()),
    });
    assert_eq!(
        handle_set_reorder_level(&denied, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::PermissionDenied)
    );
    assert_eq!(repository.mutation_count, 0);
}

#[test]
fn command_id_replays_once_and_rejects_changed_envelope() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let envelope = command(&ids, &ids.branch_a);
    let mut repository = FakeMutationRepository::default();

    let first = handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now())
        .expect("first command should apply");
    let replay = handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now())
        .expect("identical command should replay");
    assert!(matches!(first, IdempotencyOutcome::Applied(_)));
    assert!(matches!(replay, IdempotencyOutcome::Replayed(_)));
    assert_eq!(first.receipt(), replay.receipt());
    assert_eq!(repository.mutation_count, 1);

    let mut changed = envelope.clone();
    changed.payload.reorder_level = 13;
    assert_eq!(
        handle_set_reorder_level(&session, &changed, &mut repository, Utc::now()),
        Err(CommandApiError::IdempotencyConflict)
    );
    assert_eq!(repository.mutation_count, 1);
}

#[test]
fn optimistic_revision_conflict_does_not_mutate_or_claim_completion() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let mut envelope = command(&ids, &ids.branch_a);
    envelope.expected_revision = Some(9);
    let mut repository = FakeMutationRepository::default();

    assert_eq!(
        handle_set_reorder_level(&session, &envelope, &mut repository, Utc::now()),
        Err(CommandApiError::RevisionConflict)
    );
    assert_eq!(repository.mutation_count, 0);
    assert!(repository.records.is_empty());
}

#[test]
fn fingerprint_is_stable_for_map_insertion_order_and_covers_envelope() {
    let ids = ids();
    let mut first_map = HashMap::new();
    first_map.insert("alpha".to_string(), 1_u32);
    first_map.insert("beta".to_string(), 2_u32);
    let mut second_map = HashMap::new();
    second_map.insert("beta".to_string(), 2_u32);
    second_map.insert("alpha".to_string(), 1_u32);

    let envelope = CommandEnvelope {
        schema_version: 1,
        command_id: Uuid::new_v4().to_string(),
        command_type: "test.map.v1".to_string(),
        node_id: ids.node,
        user_id: ids.user,
        branch_id: ids.branch_a,
        expected_revision: Some(4),
        issued_at: Utc::now(),
        payload: first_map,
    };
    let mut reordered = envelope.clone();
    reordered.payload = second_map;
    assert_eq!(
        fingerprint_command(&envelope).unwrap(),
        fingerprint_command(&reordered).unwrap()
    );

    reordered.expected_revision = Some(5);
    assert_ne!(
        fingerprint_command(&envelope).unwrap(),
        fingerprint_command(&reordered).unwrap()
    );
}

#[test]
fn read_input_bounds_and_defaults_are_enforced_before_query() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let scope = BranchScope::Branch {
        branch_id: ids.branch_a.clone(),
    };
    let mut query = FakeInventoryQuery::default();

    for limit in [Some(0), Some(101)] {
        let request = read_request(&ids, scope.clone(), limit);
        assert!(matches!(
            handle_inventory_alerts_read(&session, &request, &mut query, Utc::now()),
            Err(CommandApiError::InvalidReadRequest { .. })
        ));
    }

    let mut bad_cursor = read_request(&ids, scope.clone(), Some(10));
    bad_cursor.page.cursor = Some("cursor\nsmuggle".to_string());
    assert!(matches!(
        handle_inventory_alerts_read(&session, &bad_cursor, &mut query, Utc::now()),
        Err(CommandApiError::InvalidReadRequest { .. })
    ));

    let mut bad_search = read_request(&ids, scope.clone(), Some(10));
    bad_search.filter.search = Some("bad\0search".to_string());
    assert!(matches!(
        handle_inventory_alerts_read(&session, &bad_search, &mut query, Utc::now()),
        Err(CommandApiError::InvalidReadRequest { .. })
    ));
    assert_eq!(query.calls, 0);

    let request = read_request(&ids, scope, None);
    let response = handle_inventory_alerts_read(&session, &request, &mut query, Utc::now())
        .expect("default page should be accepted");
    assert_eq!(response.limit, DEFAULT_READ_LIMIT);
    assert_eq!(query.seen_page.unwrap().limit, DEFAULT_READ_LIMIT);
}

#[test]
fn all_assigned_read_is_authorized_deterministically_and_fanout_is_bounded() {
    let first_ids = ids();
    let first_session = session(
        &first_ids,
        SessionAccess::Desktop,
        [first_ids.branch_b.clone(), first_ids.branch_a.clone()],
    );
    let request = read_request(&first_ids, BranchScope::AllAssigned, Some(10));
    let mut query = FakeInventoryQuery::default();
    handle_inventory_alerts_read(&first_session, &request, &mut query, Utc::now())
        .expect("both assigned branches should be authorized");
    let mut expected_branches = vec![first_ids.branch_a, first_ids.branch_b];
    expected_branches.sort();
    assert_eq!(query.seen_branches, expected_branches);

    let fanout_ids = ids();
    let branches = (0..=MAX_READ_BRANCHES)
        .map(|_| Uuid::new_v4().to_string())
        .collect::<Vec<_>>();
    let fanout_session = session(&fanout_ids, SessionAccess::Desktop, branches);
    let request = read_request(&fanout_ids, BranchScope::AllAssigned, Some(10));
    let mut query = FakeInventoryQuery::default();
    assert!(matches!(
        handle_inventory_alerts_read(&fanout_session, &request, &mut query, Utc::now()),
        Err(CommandApiError::InvalidReadRequest { .. })
    ));
    assert_eq!(query.calls, 0);
}

#[test]
fn filter_and_cursor_are_forwarded_to_the_allowlisted_query_port() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let mut request = read_request(
        &ids,
        BranchScope::Branch {
            branch_id: ids.branch_a.clone(),
        },
        Some(7),
    );
    request.page.cursor = Some("opaque-cursor_1".to_string());
    request.filter.search = Some("aspirin".to_string());
    request.filter.include_out_of_stock = true;
    let mut query = FakeInventoryQuery::default();

    handle_inventory_alerts_read(&session, &request, &mut query, Utc::now()).unwrap();
    assert_eq!(query.seen_branches, vec![ids.branch_a]);
    assert_eq!(
        query.seen_page.unwrap().cursor.as_deref(),
        Some("opaque-cursor_1")
    );
    assert_eq!(
        query.seen_filter,
        Some(InventoryAlertsFilter {
            search: Some("aspirin".to_string()),
            include_out_of_stock: true,
        })
    );
}

#[test]
fn projection_rejects_oversized_cross_branch_and_oversized_byte_results() {
    let ids = ids();
    let session = session(&ids, SessionAccess::Desktop, [ids.branch_a.clone()]);
    let request = read_request(
        &ids,
        BranchScope::Branch {
            branch_id: ids.branch_a.clone(),
        },
        Some(1),
    );

    let permitted = row(&ids, &ids.branch_a);
    let mut oversized_rows = FakeInventoryQuery {
        rows: vec![permitted.clone(), permitted],
        force_oversized_page: true,
        ..FakeInventoryQuery::default()
    };
    assert_eq!(
        handle_inventory_alerts_read(&session, &request, &mut oversized_rows, Utc::now()),
        Err(CommandApiError::InvalidProjectionResult)
    );

    let mut leaked = FakeInventoryQuery {
        rows: vec![row(&ids, &ids.branch_b)],
        bypass_branch_filter: true,
        ..FakeInventoryQuery::default()
    };
    assert_eq!(
        handle_inventory_alerts_read(&session, &request, &mut leaked, Utc::now()),
        Err(CommandApiError::InvalidProjectionResult)
    );

    let mut huge = row(&ids, &ids.branch_a);
    huge.name = "x".repeat(MAX_PROJECTION_PAGE_BYTES);
    let mut oversized_bytes = FakeInventoryQuery {
        rows: vec![huge],
        ..FakeInventoryQuery::default()
    };
    assert_eq!(
        handle_inventory_alerts_read(&session, &request, &mut oversized_bytes, Utc::now()),
        Err(CommandApiError::InvalidProjectionResult)
    );
}

#[test]
fn transport_dtos_reject_unknown_fields() {
    let ids = ids();
    let envelope = command(&ids, &ids.branch_a);
    let mut value = serde_json::to_value(&envelope).unwrap();
    value
        .as_object_mut()
        .unwrap()
        .insert("forgedRole".to_string(), serde_json::json!("role_owner"));
    assert!(serde_json::from_value::<CommandEnvelope<SetReorderLevel>>(value).is_err());

    let mut value = serde_json::to_value(&envelope).unwrap();
    value["payload"]["rawSql"] = serde_json::json!("UPDATE products SET active = 0");
    assert!(serde_json::from_value::<CommandEnvelope<SetReorderLevel>>(value).is_err());
}

#[test]
fn error_statuses_are_stable_and_storage_errors_are_sanitized() {
    assert_eq!(CommandApiError::AuthenticationRequired.http_status(), 401);
    assert_eq!(CommandApiError::InvalidSession.http_status(), 401);
    assert_eq!(CommandApiError::BranchAccessDenied.http_status(), 403);
    assert_eq!(CommandApiError::RevisionConflict.http_status(), 409);
    assert_eq!(
        CommandApiError::InvalidReadRequest {
            reason: "bounded".to_string()
        }
        .http_status(),
        422
    );
    assert_eq!(CommandApiError::InvalidProjectionResult.http_status(), 500);
    assert_eq!(CommandApiError::StorageUnavailable.http_status(), 503);

    let serialized = serde_json::to_string(&CommandApiError::StorageUnavailable).unwrap();
    assert_eq!(serialized, r#"{"code":"storage_unavailable"}"#);
    assert!(!serialized.contains("sql"));
}
