#[path = "../src/network/read_only_policy.rs"]
mod read_only_policy;

use read_only_policy::*;

const EXPECTED_ORIGIN: &str = "http://192.168.1.8:39420";
const BRANCHES: &[&str] = &["branch-nairobi", "branch-thika"];
const MANAGER_PERMISSIONS: &[&str] = &[
    PERMISSION_REPORTS_VIEW,
    PERMISSION_REPORTS_PNL,
    PERMISSION_REPORTS_ZREPORT,
];
const VIEWER_PERMISSIONS: &[&str] = &[PERMISSION_REPORTS_VIEW];

fn session<'a>(
    role: SessionRole,
    read_only: bool,
    branches: &'a [&'a str],
    permissions: &'a [&'a str],
) -> SessionClaims<'a> {
    SessionClaims {
        session_id: "session-01",
        user_id: "user-01",
        role,
        read_only,
        assigned_branch_ids: branches,
        permissions,
        issued_at_unix_seconds: 100,
        expires_at_unix_seconds: 200,
    }
}

fn request<'a>(method: &'a str, path: &'a str, query: &'a [QueryParam<'a>]) -> PolicyRequest<'a> {
    PolicyRequest {
        method,
        path,
        origin: RequestOrigin {
            expected_origin: EXPECTED_ORIGIN,
            origin_header: Some(EXPECTED_ORIGIN),
            sec_fetch_site: Some("same-origin"),
        },
        query,
    }
}

fn param<'a>(name: &'a str, value: &'a str) -> QueryParam<'a> {
    QueryParam { name, value }
}

fn manager() -> SessionClaims<'static> {
    session(SessionRole::Manager, true, BRANCHES, MANAGER_PERMISSIONS)
}

fn viewer() -> SessionClaims<'static> {
    session(
        SessionRole::Viewer,
        true,
        &["branch-thika"],
        VIEWER_PERMISSIONS,
    )
}

#[test]
fn session_must_be_active_well_formed_read_only_and_branch_assigned() {
    assert!(assert_active_read_only_session(manager(), 150).is_ok());

    let exact_maximum = SessionClaims {
        expires_at_unix_seconds: 100 + MAX_SESSION_SECONDS,
        ..manager()
    };
    assert!(assert_active_read_only_session(exact_maximum, 150).is_ok());

    let expired = assert_active_read_only_session(manager(), 200).unwrap_err();
    assert_eq!(expired.kind, PolicyErrorKind::SessionExpired);

    let writable = session(SessionRole::Manager, false, BRANCHES, MANAGER_PERMISSIONS);
    assert_eq!(
        assert_active_read_only_session(writable, 150)
            .unwrap_err()
            .kind,
        PolicyErrorKind::Forbidden
    );

    for malformed in [
        SessionClaims {
            expires_at_unix_seconds: 100,
            ..manager()
        },
        SessionClaims {
            issued_at_unix_seconds: 151,
            ..manager()
        },
        SessionClaims {
            expires_at_unix_seconds: 100 + MAX_SESSION_SECONDS + 1,
            ..manager()
        },
        SessionClaims {
            session_id: "../session",
            ..manager()
        },
    ] {
        assert_eq!(
            assert_active_read_only_session(malformed, 150)
                .unwrap_err()
                .kind,
            PolicyErrorKind::Forbidden
        );
    }

    for invalid_claims in [
        session(SessionRole::Viewer, true, &[], VIEWER_PERMISSIONS),
        session(
            SessionRole::Viewer,
            true,
            &["branch-thika", "branch-thika"],
            VIEWER_PERMISSIONS,
        ),
        session(
            SessionRole::Viewer,
            true,
            &["branch-thika"],
            &["reports.view", "unknown.permission"],
        ),
    ] {
        assert_eq!(
            assert_active_read_only_session(invalid_claims, 150)
                .unwrap_err()
                .kind,
            PolicyErrorKind::Forbidden
        );
    }
}

#[test]
fn route_surface_is_a_fixed_get_only_projection_allowlist() {
    let expected = [
        (Projection::HomeDashboard, "/api/web/v1/home"),
        (Projection::BranchesList, "/api/web/v1/branches"),
        (Projection::ReportsCatalog, "/api/web/v1/reports"),
        (Projection::ReportsRows, "/api/web/v1/reports/rows"),
        (Projection::AlertsList, "/api/web/v1/alerts"),
        (Projection::SyncHealth, "/api/web/v1/sync-health"),
        (Projection::DrilldownReportRow, "/api/web/v1/drill-down"),
        (Projection::ProfileSession, "/api/web/v1/profile"),
    ];
    assert_eq!(Projection::ALL.len(), expected.len());
    for (projection, path) in expected {
        assert_eq!(projection.path(), path);
        assert_eq!(Projection::from_path(path), Some(projection));
    }

    for forbidden in [
        "/api/db/query",
        "/api/db/execute",
        "/api/web/v1/sql",
        "/api/web/v1/query",
        "/api/web/v1/create",
        "/api/web/v1/update",
        "/api/web/v1/delete",
        "/api/web/v1/mutate",
    ] {
        assert_eq!(Projection::from_path(forbidden), None);
        assert_eq!(
            authorize(manager(), request("GET", forbidden, &[]), 150)
                .unwrap_err()
                .kind,
            PolicyErrorKind::NotFound
        );
    }

    for method in ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] {
        assert_eq!(
            authorize(manager(), request(method, "/api/web/v1/profile", &[]), 150)
                .unwrap_err()
                .kind,
            PolicyErrorKind::Forbidden
        );
    }
}

#[test]
fn every_allowlisted_projection_authorizes_with_its_exact_query_shape() {
    let cases: &[(Projection, &[QueryParam<'_>])] = &[
        (
            Projection::HomeDashboard,
            &[
                param("scope", "branch"),
                param("branchId", "branch-nairobi"),
            ],
        ),
        (Projection::BranchesList, &[param("limit", "10")]),
        (
            Projection::ReportsCatalog,
            &[
                param("scope", "branch"),
                param("branchId", "branch-nairobi"),
            ],
        ),
        (
            Projection::ReportsRows,
            &[
                param("scope", "branch"),
                param("branchId", "branch-nairobi"),
                param("reportId", "sales-summary"),
                param("limit", "10"),
            ],
        ),
        (
            Projection::AlertsList,
            &[param("branchId", "branch-nairobi"), param("limit", "10")],
        ),
        (
            Projection::SyncHealth,
            &[param("branchId", "branch-nairobi")],
        ),
        (
            Projection::DrilldownReportRow,
            &[
                param("scope", "branch"),
                param("branchId", "branch-nairobi"),
                param("reportId", "sales-summary"),
                param("recordId", "sale:01"),
                param("limit", "10"),
            ],
        ),
        (Projection::ProfileSession, &[]),
    ];

    for (projection, query) in cases {
        let authorized = authorize(manager(), request("GET", projection.path(), query), 150)
            .unwrap_or_else(|error| panic!("{} rejected: {error}", projection.path()));
        assert_eq!(authorized.projection, *projection);
        assert_eq!(authorized.path, projection.path());
    }
}

#[test]
fn same_origin_evidence_is_mandatory_and_cross_origin_is_rejected() {
    let mut policy_request = request("GET", "/api/web/v1/profile", &[]);
    policy_request.origin.origin_header = Some("https://evil.example");
    assert_eq!(
        authorize(manager(), policy_request, 150).unwrap_err().kind,
        PolicyErrorKind::Forbidden
    );

    let mut missing_fetch_metadata = request("GET", "/api/web/v1/profile", &[]);
    missing_fetch_metadata.origin.origin_header = None;
    missing_fetch_metadata.origin.sec_fetch_site = None;
    assert_eq!(
        authorize(manager(), missing_fetch_metadata, 150)
            .unwrap_err()
            .kind,
        PolicyErrorKind::Forbidden
    );

    let same_origin_without_origin_header = PolicyRequest {
        origin: RequestOrigin {
            expected_origin: EXPECTED_ORIGIN,
            origin_header: None,
            sec_fetch_site: Some("same-origin"),
        },
        ..request("GET", "/api/web/v1/profile", &[])
    };
    assert!(authorize(manager(), same_origin_without_origin_header, 150).is_ok());
}

#[test]
fn branch_scope_never_escapes_session_assignments() {
    let allowed = [param("branchId", "branch-thika")];
    let authorized = authorize(
        viewer(),
        request("GET", "/api/web/v1/alerts", &allowed),
        150,
    )
    .unwrap();
    assert_eq!(authorized.authorized_branch_ids, vec!["branch-thika"]);

    let unassigned = [param("branchId", "branch-nairobi")];
    assert_eq!(
        authorize(
            viewer(),
            request("GET", "/api/web/v1/alerts", &unassigned),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::Forbidden
    );
}

#[test]
fn all_branch_scope_is_manager_only_and_analytics_only() {
    let all = [param("scope", "all")];
    let authorized = authorize(manager(), request("GET", "/api/web/v1/home", &all), 150).unwrap();
    assert_eq!(authorized.scope, Some(BranchScope::All));
    assert_eq!(authorized.authorized_branch_ids, BRANCHES);

    assert_eq!(
        authorize(viewer(), request("GET", "/api/web/v1/home", &all), 150,)
            .unwrap_err()
            .kind,
        PolicyErrorKind::Forbidden
    );

    let branch_route_all = [param("branchId", "all")];
    assert_eq!(
        authorize(
            manager(),
            request("GET", "/api/web/v1/alerts", &branch_route_all),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::Forbidden
    );

    let explicit_scope_on_branch_route = [param("scope", "all")];
    assert_eq!(
        authorize(
            manager(),
            request(
                "GET",
                "/api/web/v1/sync-health",
                &explicit_scope_on_branch_route,
            ),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::BadQuery
    );
}

#[test]
fn sensitive_report_catalog_and_direct_access_require_specific_permission() {
    assert_eq!(
        visible_reports(viewer()),
        vec![Report::SalesSummary, Report::InventoryPosition]
    );
    assert!(Report::ALL
        .iter()
        .filter(|report| report.sensitive())
        .all(|report| report.required_permission() != PERMISSION_REPORTS_VIEW));

    let pnl = [
        param("scope", "branch"),
        param("branchId", "branch-thika"),
        param("reportId", "profit-and-loss"),
    ];
    assert_eq!(
        authorize(
            viewer(),
            request("GET", "/api/web/v1/reports/rows", &pnl),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::Forbidden
    );
    assert_eq!(
        authorize(
            manager(),
            request("GET", "/api/web/v1/reports/rows", &pnl),
            150,
        )
        .unwrap()
        .report,
        Some(Report::ProfitAndLoss)
    );

    let unknown = [
        param("scope", "branch"),
        param("branchId", "branch-thika"),
        param("reportId", "customer-bank-details"),
    ];
    assert_eq!(
        authorize(
            manager(),
            request("GET", "/api/web/v1/reports/rows", &unknown),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::NotFound
    );
}

#[test]
fn limit_search_cursor_and_identifier_inputs_are_strictly_bounded() {
    let valid = [
        param("limit", "100"),
        param("search", "  stock  "),
        param("cursor", "next_page-2"),
    ];
    let authorized = authorize(
        manager(),
        request("GET", "/api/web/v1/branches", &valid),
        150,
    )
    .unwrap();
    assert_eq!(authorized.query.limit, 100);
    assert_eq!(authorized.query.search, Some("stock"));
    assert_eq!(authorized.query.cursor, Some("next_page-2"));

    let too_long_search = "x".repeat(MAX_SEARCH_CHARS + 1);
    let too_long_cursor = "x".repeat(MAX_CURSOR_CHARS + 1);
    let bad_queries = [
        vec![param("limit", "0")],
        vec![param("limit", "101")],
        vec![param("limit", "1.5")],
        vec![param("search", &too_long_search)],
        vec![param("search", "bad\nquery")],
        vec![param("cursor", "next page")],
        vec![param("cursor", &too_long_cursor)],
        vec![param("sql", "SELECT * FROM users")],
        vec![param("limit", "10"), param("limit", "20")],
    ];
    for query in &bad_queries {
        assert_eq!(
            authorize(
                manager(),
                request("GET", "/api/web/v1/branches", query),
                150,
            )
            .unwrap_err()
            .kind,
            PolicyErrorKind::BadQuery
        );
    }

    let unsafe_record = [
        param("scope", "branch"),
        param("branchId", "branch-nairobi"),
        param("reportId", "sales-summary"),
        param("recordId", "../../users"),
    ];
    assert_eq!(
        authorize(
            manager(),
            request("GET", "/api/web/v1/drill-down", &unsafe_record),
            150,
        )
        .unwrap_err()
        .kind,
        PolicyErrorKind::BadQuery
    );
}

#[test]
fn fixed_output_projection_and_response_caps_prevent_overbroad_results() {
    for projection in Projection::ALL {
        assert!(!projection.output_fields().is_empty());
        assert!(projection.output_fields().iter().all(|field| !matches!(
            *field,
            "password" | "passwordHash" | "rawSql" | "bankAccount"
        )));
        assert!(assert_output_within_caps(
            projection,
            projection.max_output_items(),
            MAX_RESPONSE_BYTES,
        )
        .is_ok());
        assert_eq!(
            assert_output_within_caps(
                projection,
                projection.max_output_items() + 1,
                MAX_RESPONSE_BYTES,
            )
            .unwrap_err()
            .kind,
            PolicyErrorKind::OutputTooLarge
        );
        assert_eq!(
            assert_output_within_caps(projection, 0, MAX_RESPONSE_BYTES + 1,)
                .unwrap_err()
                .kind,
            PolicyErrorKind::OutputTooLarge
        );
    }
}
