//! Pure policy boundary for the browser read-only API.
//!
//! This module intentionally contains no router, database, SQL, or mutation
//! implementation. A coordinator must register it from `network/mod.rs`, map
//! an exact allowlisted path to [`Projection`], authorize before querying a
//! typed repository, project only [`Projection::output_fields`], and enforce
//! [`assert_output_within_caps`] before serializing the response.

use std::fmt;

pub const DEFAULT_LIMIT: usize = 25;
pub const MAX_LIMIT: usize = 100;
pub const MAX_SEARCH_CHARS: usize = 80;
pub const MAX_CURSOR_CHARS: usize = 160;
pub const MAX_IDENTIFIER_CHARS: usize = 128;
pub const MAX_RESPONSE_BYTES: usize = 256 * 1024;
pub const MAX_SESSION_SECONDS: i64 = 8 * 60 * 60;
pub const MAX_ASSIGNED_BRANCHES: usize = 100;
pub const MAX_SESSION_PERMISSIONS: usize = 6;

pub const PERMISSION_REPORTS_VIEW: &str = "reports.view";
pub const PERMISSION_REPORTS_PNL: &str = "reports.pnl";
pub const PERMISSION_REPORTS_ZREPORT: &str = "reports.zreport";
pub const PERMISSION_ETIMS_VIEW: &str = "etims.view";
pub const PERMISSION_PAYROLL_VIEW: &str = "hr.payroll.view";
pub const PERMISSION_AUDIT_VIEW: &str = "audit.view";

const ALLOWED_PERMISSIONS: [&str; MAX_SESSION_PERMISSIONS] = [
    PERMISSION_REPORTS_VIEW,
    PERMISSION_REPORTS_PNL,
    PERMISSION_REPORTS_ZREPORT,
    PERMISSION_ETIMS_VIEW,
    PERMISSION_PAYROLL_VIEW,
    PERMISSION_AUDIT_VIEW,
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SessionRole {
    Viewer,
    Manager,
}

#[derive(Clone, Copy, Debug)]
pub struct SessionClaims<'a> {
    pub session_id: &'a str,
    pub user_id: &'a str,
    pub role: SessionRole,
    pub read_only: bool,
    pub assigned_branch_ids: &'a [&'a str],
    pub permissions: &'a [&'a str],
    pub issued_at_unix_seconds: i64,
    pub expires_at_unix_seconds: i64,
}

#[derive(Clone, Copy, Debug)]
pub struct RequestOrigin<'a> {
    /// The origin that serves this API, derived from trusted server config.
    pub expected_origin: &'a str,
    /// Parsed `Origin` header. Same-origin GETs may omit it.
    pub origin_header: Option<&'a str>,
    /// Parsed `Sec-Fetch-Site` header.
    pub sec_fetch_site: Option<&'a str>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct QueryParam<'a> {
    pub name: &'a str,
    pub value: &'a str,
}

#[derive(Clone, Copy, Debug)]
pub struct PolicyRequest<'a> {
    pub method: &'a str,
    pub path: &'a str,
    pub origin: RequestOrigin<'a>,
    /// Decoded query parameters. Duplicate and unknown names are rejected.
    pub query: &'a [QueryParam<'a>],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BranchScope<'a> {
    Branch(&'a str),
    All,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct BoundedQuery<'a> {
    pub limit: usize,
    pub search: Option<&'a str>,
    pub cursor: Option<&'a str>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Projection {
    HomeDashboard,
    BranchesList,
    ReportsCatalog,
    ReportsRows,
    AlertsList,
    SyncHealth,
    DrilldownReportRow,
    ProfileSession,
}

const HOME_FIELDS: &[&str] = &[
    "generatedAt",
    "scopeLabel",
    "salesToday",
    "transactionCount",
    "lowStockCount",
    "openAlertCount",
    "recentActivity",
];
const BRANCH_FIELDS: &[&str] = &[
    "id",
    "code",
    "name",
    "town",
    "lastSeenAt",
    "syncState",
    "salesToday",
    "transactionCount",
];
const REPORT_DEFINITION_FIELDS: &[&str] =
    &["id", "title", "description", "permission", "sensitive"];
const REPORT_ROW_FIELDS: &[&str] = &["id", "label", "secondary", "value", "occurredAt"];
const ALERT_FIELDS: &[&str] = &[
    "id",
    "severity",
    "title",
    "detail",
    "branchName",
    "raisedAt",
];
const SYNC_FIELDS: &[&str] = &[
    "branchId",
    "branchName",
    "state",
    "lastSuccessfulSyncAt",
    "pendingRecords",
    "hubReachable",
];
const DRILLDOWN_FIELDS: &[&str] = &["id", "title", "subtitle", "branchName", "fields", "related"];
const PROFILE_FIELDS: &[&str] = &[
    "sessionId",
    "userId",
    "role",
    "readonly",
    "displayName",
    "roleLabel",
    "assignedBranches",
    "permissions",
    "sessionIssuedAt",
    "sessionExpiresAt",
    "connectedHubName",
    "deviceLabel",
];

impl Projection {
    pub const ALL: [Self; 8] = [
        Self::HomeDashboard,
        Self::BranchesList,
        Self::ReportsCatalog,
        Self::ReportsRows,
        Self::AlertsList,
        Self::SyncHealth,
        Self::DrilldownReportRow,
        Self::ProfileSession,
    ];

    pub const fn path(self) -> &'static str {
        match self {
            Self::HomeDashboard => "/api/web/v1/home",
            Self::BranchesList => "/api/web/v1/branches",
            Self::ReportsCatalog => "/api/web/v1/reports",
            Self::ReportsRows => "/api/web/v1/reports/rows",
            Self::AlertsList => "/api/web/v1/alerts",
            Self::SyncHealth => "/api/web/v1/sync-health",
            Self::DrilldownReportRow => "/api/web/v1/drill-down",
            Self::ProfileSession => "/api/web/v1/profile",
        }
    }

    pub fn from_path(path: &str) -> Option<Self> {
        Self::ALL
            .iter()
            .copied()
            .find(|projection| projection.path() == path)
    }

    pub const fn output_fields(self) -> &'static [&'static str] {
        match self {
            Self::HomeDashboard => HOME_FIELDS,
            Self::BranchesList => BRANCH_FIELDS,
            Self::ReportsCatalog => REPORT_DEFINITION_FIELDS,
            Self::ReportsRows => REPORT_ROW_FIELDS,
            Self::AlertsList => ALERT_FIELDS,
            Self::SyncHealth => SYNC_FIELDS,
            Self::DrilldownReportRow => DRILLDOWN_FIELDS,
            Self::ProfileSession => PROFILE_FIELDS,
        }
    }

    pub const fn max_output_items(self) -> usize {
        match self {
            Self::HomeDashboard => 25,
            Self::BranchesList | Self::ReportsRows | Self::AlertsList => MAX_LIMIT,
            Self::ReportsCatalog => Report::ALL.len(),
            Self::SyncHealth => 1,
            Self::DrilldownReportRow | Self::ProfileSession => MAX_LIMIT,
        }
    }

    const fn required_permission(self) -> Option<&'static str> {
        match self {
            Self::ProfileSession => None,
            _ => Some(PERMISSION_REPORTS_VIEW),
        }
    }

    const fn scope_kind(self) -> ScopeKind {
        match self {
            Self::BranchesList => ScopeKind::AssignedList,
            Self::ProfileSession => ScopeKind::Session,
            Self::AlertsList | Self::SyncHealth => ScopeKind::Branch,
            Self::HomeDashboard
            | Self::ReportsCatalog
            | Self::ReportsRows
            | Self::DrilldownReportRow => ScopeKind::Analytics,
        }
    }

    const fn accepts_list_query(self) -> bool {
        matches!(
            self,
            Self::BranchesList | Self::ReportsRows | Self::AlertsList | Self::DrilldownReportRow
        )
    }

    const fn accepts_report(self) -> bool {
        matches!(self, Self::ReportsRows | Self::DrilldownReportRow)
    }

    const fn accepts_record(self) -> bool {
        matches!(self, Self::DrilldownReportRow)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ScopeKind {
    Branch,
    AssignedList,
    Session,
    Analytics,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Report {
    SalesSummary,
    InventoryPosition,
    ProfitAndLoss,
    ZReport,
    TaxSummary,
    PayrollSummary,
    AuditSummary,
}

impl Report {
    pub const ALL: [Self; 7] = [
        Self::SalesSummary,
        Self::InventoryPosition,
        Self::ProfitAndLoss,
        Self::ZReport,
        Self::TaxSummary,
        Self::PayrollSummary,
        Self::AuditSummary,
    ];

    pub const fn id(self) -> &'static str {
        match self {
            Self::SalesSummary => "sales-summary",
            Self::InventoryPosition => "inventory-position",
            Self::ProfitAndLoss => "profit-and-loss",
            Self::ZReport => "z-report",
            Self::TaxSummary => "tax-summary",
            Self::PayrollSummary => "payroll-summary",
            Self::AuditSummary => "audit-summary",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|report| report.id() == id)
    }

    pub const fn required_permission(self) -> &'static str {
        match self {
            Self::SalesSummary | Self::InventoryPosition => PERMISSION_REPORTS_VIEW,
            Self::ProfitAndLoss => PERMISSION_REPORTS_PNL,
            Self::ZReport => PERMISSION_REPORTS_ZREPORT,
            Self::TaxSummary => PERMISSION_ETIMS_VIEW,
            Self::PayrollSummary => PERMISSION_PAYROLL_VIEW,
            Self::AuditSummary => PERMISSION_AUDIT_VIEW,
        }
    }

    pub const fn sensitive(self) -> bool {
        !matches!(self, Self::SalesSummary | Self::InventoryPosition)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedRead<'a> {
    pub projection: Projection,
    pub path: &'static str,
    pub scope: Option<BranchScope<'a>>,
    pub authorized_branch_ids: Vec<&'a str>,
    pub query: BoundedQuery<'a>,
    pub report: Option<Report>,
    pub record_id: Option<&'a str>,
    pub session_id: &'a str,
    pub user_id: &'a str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PolicyErrorKind {
    BadQuery,
    Forbidden,
    SessionExpired,
    NotFound,
    OutputTooLarge,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyError {
    pub kind: PolicyErrorKind,
    pub message: &'static str,
}

impl PolicyError {
    const fn new(kind: PolicyErrorKind, message: &'static str) -> Self {
        Self { kind, message }
    }
}

impl fmt::Display for PolicyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for PolicyError {}

pub fn authorize<'a>(
    session: SessionClaims<'a>,
    request: PolicyRequest<'a>,
    now_unix_seconds: i64,
) -> Result<AuthorizedRead<'a>, PolicyError> {
    assert_active_read_only_session(session, now_unix_seconds)?;
    assert_same_origin(request.origin)?;

    if request.method != "GET" {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "The browser API accepts GET requests only.",
        ));
    }

    let projection = Projection::from_path(request.path).ok_or_else(|| {
        PolicyError::new(
            PolicyErrorKind::NotFound,
            "The requested read projection is not allowlisted.",
        )
    })?;
    assert_permission(session, projection.required_permission())?;

    let parsed = parse_query(projection, request.query)?;
    let scope = authorize_scope(
        session,
        projection.scope_kind(),
        parsed.scope,
        parsed.branch_id,
    )?;
    let report = authorize_report(session, projection, parsed.report_id)?;
    let record_id = authorize_record(projection, parsed.record_id)?;

    let authorized_branch_ids = match scope {
        Some(BranchScope::Branch(branch_id)) => vec![branch_id],
        Some(BranchScope::All) | None => session.assigned_branch_ids.to_vec(),
    };

    Ok(AuthorizedRead {
        projection,
        path: projection.path(),
        scope,
        authorized_branch_ids,
        query: BoundedQuery {
            limit: parsed.limit,
            search: parsed.search,
            cursor: parsed.cursor,
        },
        report,
        record_id,
        session_id: session.session_id,
        user_id: session.user_id,
    })
}

pub fn assert_active_read_only_session(
    session: SessionClaims<'_>,
    now_unix_seconds: i64,
) -> Result<(), PolicyError> {
    if !session.read_only {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "Browser sessions must carry a read-only claim.",
        ));
    }
    if !is_safe_identifier(session.session_id)
        || !is_safe_identifier(session.user_id)
        || session.issued_at_unix_seconds < 0
        || session.issued_at_unix_seconds > now_unix_seconds
        || session.expires_at_unix_seconds <= session.issued_at_unix_seconds
        || session.expires_at_unix_seconds - session.issued_at_unix_seconds > MAX_SESSION_SECONDS
    {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "Session claims are malformed.",
        ));
    }
    if session.expires_at_unix_seconds <= now_unix_seconds {
        return Err(PolicyError::new(
            PolicyErrorKind::SessionExpired,
            "The browser session has expired.",
        ));
    }
    if session.assigned_branch_ids.is_empty()
        || session.assigned_branch_ids.len() > MAX_ASSIGNED_BRANCHES
        || session
            .assigned_branch_ids
            .iter()
            .enumerate()
            .any(|(index, branch_id)| {
                !is_safe_identifier(branch_id)
                    || session.assigned_branch_ids[..index].contains(branch_id)
            })
    {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "The session has no valid assigned branches.",
        ));
    }
    if session.permissions.is_empty()
        || session.permissions.len() > MAX_SESSION_PERMISSIONS
        || session
            .permissions
            .iter()
            .enumerate()
            .any(|(index, permission)| {
                !ALLOWED_PERMISSIONS.contains(permission)
                    || session.permissions[..index].contains(permission)
            })
    {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "Session report permissions are invalid.",
        ));
    }
    Ok(())
}

pub fn assert_same_origin(origin: RequestOrigin<'_>) -> Result<(), PolicyError> {
    if origin.expected_origin.is_empty()
        || origin.sec_fetch_site != Some("same-origin")
        || origin
            .origin_header
            .is_some_and(|header| header != origin.expected_origin)
    {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "Cross-origin browser requests are not allowed.",
        ));
    }
    Ok(())
}

pub fn assert_output_within_caps(
    projection: Projection,
    item_count: usize,
    encoded_bytes: usize,
) -> Result<(), PolicyError> {
    if item_count > projection.max_output_items() || encoded_bytes > MAX_RESPONSE_BYTES {
        return Err(PolicyError::new(
            PolicyErrorKind::OutputTooLarge,
            "The projected response exceeds its fixed output cap.",
        ));
    }
    Ok(())
}

pub fn visible_reports(session: SessionClaims<'_>) -> Vec<Report> {
    Report::ALL
        .iter()
        .copied()
        .filter(|report| has_permission(session, report.required_permission()))
        .collect()
}

fn assert_permission(
    session: SessionClaims<'_>,
    permission: Option<&str>,
) -> Result<(), PolicyError> {
    if permission.is_some_and(|required| !has_permission(session, required)) {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "The session lacks the required permission.",
        ));
    }
    Ok(())
}

fn has_permission(session: SessionClaims<'_>, permission: &str) -> bool {
    session.permissions.contains(&permission)
}

#[derive(Clone, Copy, Debug)]
struct ParsedQuery<'a> {
    limit: usize,
    search: Option<&'a str>,
    cursor: Option<&'a str>,
    scope: Option<&'a str>,
    branch_id: Option<&'a str>,
    report_id: Option<&'a str>,
    record_id: Option<&'a str>,
}

fn parse_query<'a>(
    projection: Projection,
    params: &'a [QueryParam<'a>],
) -> Result<ParsedQuery<'a>, PolicyError> {
    let mut parsed = ParsedQuery {
        limit: DEFAULT_LIMIT,
        search: None,
        cursor: None,
        scope: None,
        branch_id: None,
        report_id: None,
        record_id: None,
    };

    for (index, param) in params.iter().enumerate() {
        if params[..index]
            .iter()
            .any(|previous| previous.name == param.name)
        {
            return Err(bad_query("Duplicate query fields are not allowed."));
        }
        if !query_field_allowed(projection, param.name) {
            return Err(bad_query("The query contains a non-allowlisted field."));
        }

        match param.name {
            "limit" => {
                parsed.limit = param
                    .value
                    .parse::<usize>()
                    .ok()
                    .filter(|limit| (1..=MAX_LIMIT).contains(limit))
                    .ok_or_else(|| bad_query("Limit is outside the fixed range."))?;
            }
            "search" => {
                let search = param.value.trim();
                if search.chars().count() > MAX_SEARCH_CHARS || search.chars().any(char::is_control)
                {
                    return Err(bad_query("Search text exceeds its fixed cap."));
                }
                if !search.is_empty() {
                    parsed.search = Some(search);
                }
            }
            "cursor" => {
                if param.value.is_empty()
                    || param.value.chars().count() > MAX_CURSOR_CHARS
                    || !param
                        .value
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
                {
                    return Err(bad_query("Cursor is not a valid opaque cursor."));
                }
                parsed.cursor = Some(param.value);
            }
            "scope" => parsed.scope = Some(param.value),
            "branchId" => parsed.branch_id = Some(param.value),
            "reportId" => parsed.report_id = Some(param.value),
            "recordId" => parsed.record_id = Some(param.value),
            _ => return Err(bad_query("The query contains a non-allowlisted field.")),
        }
    }

    Ok(parsed)
}

fn query_field_allowed(projection: Projection, field: &str) -> bool {
    let common_list_field =
        projection.accepts_list_query() && matches!(field, "limit" | "search" | "cursor");
    common_list_field
        || match projection.scope_kind() {
            ScopeKind::Analytics => matches!(field, "scope" | "branchId"),
            ScopeKind::Branch => field == "branchId",
            ScopeKind::AssignedList | ScopeKind::Session => false,
        }
        || (projection.accepts_report() && field == "reportId")
        || (projection.accepts_record() && field == "recordId")
}

fn authorize_scope<'a>(
    session: SessionClaims<'a>,
    kind: ScopeKind,
    scope: Option<&'a str>,
    branch_id: Option<&'a str>,
) -> Result<Option<BranchScope<'a>>, PolicyError> {
    match kind {
        ScopeKind::Session | ScopeKind::AssignedList => {
            if scope.is_some() || branch_id.is_some() {
                return Err(bad_query("This projection does not accept a branch scope."));
            }
            Ok(None)
        }
        ScopeKind::Branch => {
            if scope.is_some() {
                return Err(bad_query("This projection accepts branchId only."));
            }
            authorize_assigned_branch(session, branch_id)
                .map(|scope| Some(BranchScope::Branch(scope)))
        }
        ScopeKind::Analytics => match scope {
            Some("all") => {
                if branch_id.is_some() {
                    return Err(bad_query("All-branch scope cannot include branchId."));
                }
                if session.role != SessionRole::Manager {
                    return Err(PolicyError::new(
                        PolicyErrorKind::Forbidden,
                        "Only managers can view all-branch analytics.",
                    ));
                }
                Ok(Some(BranchScope::All))
            }
            Some("branch") => authorize_assigned_branch(session, branch_id)
                .map(|branch_id| Some(BranchScope::Branch(branch_id))),
            _ => Err(bad_query("A valid analytics scope is required.")),
        },
    }
}

fn authorize_assigned_branch<'a>(
    session: SessionClaims<'a>,
    branch_id: Option<&'a str>,
) -> Result<&'a str, PolicyError> {
    let branch_id = branch_id.ok_or_else(|| bad_query("A branch ID is required."))?;
    if !is_safe_identifier(branch_id) {
        return Err(bad_query("Branch ID is invalid."));
    }
    if !session.assigned_branch_ids.contains(&branch_id) {
        return Err(PolicyError::new(
            PolicyErrorKind::Forbidden,
            "The requested branch is not assigned to this user.",
        ));
    }
    Ok(branch_id)
}

fn authorize_report(
    session: SessionClaims<'_>,
    projection: Projection,
    report_id: Option<&str>,
) -> Result<Option<Report>, PolicyError> {
    if !projection.accepts_report() {
        return Ok(None);
    }
    let report_id = report_id.ok_or_else(|| bad_query("A report ID is required."))?;
    let report = Report::from_id(report_id).ok_or_else(|| {
        PolicyError::new(
            PolicyErrorKind::NotFound,
            "The requested report is not allowlisted.",
        )
    })?;
    assert_permission(session, Some(report.required_permission()))?;
    Ok(Some(report))
}

fn authorize_record<'a>(
    projection: Projection,
    record_id: Option<&'a str>,
) -> Result<Option<&'a str>, PolicyError> {
    if projection.accepts_record() {
        let record_id = record_id.ok_or_else(|| bad_query("A record ID is required."))?;
        if !is_safe_identifier(record_id) {
            return Err(bad_query("Record ID is invalid."));
        }
        Ok(Some(record_id))
    } else {
        Ok(None)
    }
}

fn is_safe_identifier(value: &str) -> bool {
    let mut bytes = value.bytes();
    let Some(first) = bytes.next() else {
        return false;
    };
    first.is_ascii_alphanumeric()
        && value.chars().count() <= MAX_IDENTIFIER_CHARS
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b':' | b'_' | b'-'))
}

const fn bad_query(message: &'static str) -> PolicyError {
    PolicyError::new(PolicyErrorKind::BadQuery, message)
}
