use crate::network::read_only_policy::{
    AuthorizedRead, BranchScope, Projection, Report, SessionRole, MAX_ASSIGNED_BRANCHES,
    MAX_SESSION_PERMISSIONS, MAX_SESSION_SECONDS, PERMISSION_AUDIT_VIEW, PERMISSION_ETIMS_VIEW,
    PERMISSION_PAYROLL_VIEW, PERMISSION_REPORTS_PNL, PERMISSION_REPORTS_VIEW,
    PERMISSION_REPORTS_ZREPORT,
};
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::{Row, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

const GRANT_SECONDS: i64 = 10 * 60;
const REPORT_PERMISSIONS: [&str; MAX_SESSION_PERMISSIONS] = [
    PERMISSION_REPORTS_VIEW,
    PERMISSION_REPORTS_PNL,
    PERMISSION_REPORTS_ZREPORT,
    PERMISSION_ETIMS_VIEW,
    PERMISSION_PAYROLL_VIEW,
    PERMISSION_AUDIT_VIEW,
];

#[derive(Debug, thiserror::Error)]
pub enum ReadOnlyWebDbError {
    #[error("{0}")]
    Invalid(&'static str),
    #[error("{0}")]
    Forbidden(&'static str),
    #[error("{0}")]
    NotFound(&'static str),
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("stored browser authorization is invalid")]
    Corrupt,
}

impl ReadOnlyWebDbError {
    fn database(error: sqlx::Error) -> Self {
        Self::Database(error)
    }

    fn internal(_message: &'static str) -> Self {
        Self::Corrupt
    }

    fn bad_request(message: &'static str) -> Self {
        Self::Invalid(message)
    }

    fn unauthorized(message: &'static str) -> Self {
        Self::Forbidden(message)
    }

    fn not_found(message: &'static str) -> Self {
        Self::NotFound(message)
    }
}

#[derive(Clone, Debug)]
pub struct StoredSession {
    pub session_id: String,
    pub user_id: String,
    pub display_name: String,
    pub role: SessionRole,
    pub read_only: bool,
    pub assigned_branch_ids: Vec<String>,
    pub assigned_branch_ids_json: String,
    pub permissions: Vec<String>,
    pub device_label: String,
    pub issued_at_unix_seconds: i64,
    pub expires_at_unix_seconds: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedBrowserAuthorization {
    pub grant_id: String,
    pub authorization_code: String,
    pub user_id: String,
    pub display_name: String,
    pub device_label: String,
    pub role: &'static str,
    pub assigned_branch_ids: Vec<String>,
    pub permissions: Vec<String>,
    pub grant_expires_at: String,
    pub session_expires_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSessionAdminRow {
    pub id: String,
    pub display_name: String,
    pub device_label: String,
    pub state: String,
    pub issued_at: String,
    pub expires_at: String,
    pub revoked_at: Option<String>,
}

pub struct RedeemedSession {
    pub raw_token: String,
    pub max_age_seconds: i64,
}

pub fn token_hash(raw: &str) -> String {
    hex::encode(Sha256::digest(raw.as_bytes()))
}

pub async fn issue_authorization(
    pool: &SqlitePool,
    administrator_user_id: &str,
    user_id: &str,
    device_label: &str,
    ttl_seconds: i64,
    now: i64,
) -> Result<IssuedBrowserAuthorization, ReadOnlyWebDbError> {
    let device_label = device_label.trim();
    if device_label.is_empty()
        || device_label.chars().count() > 120
        || device_label.chars().any(char::is_control)
    {
        return Err(ReadOnlyWebDbError::Invalid(
            "Device label must be between 1 and 120 visible characters.",
        ));
    }
    if !(60..=MAX_SESSION_SECONDS).contains(&ttl_seconds) {
        return Err(ReadOnlyWebDbError::Invalid(
            "Browser session duration must be between one minute and eight hours.",
        ));
    }

    require_administrator(pool, administrator_user_id).await?;
    let user =
        sqlx::query("SELECT full_name, role FROM users WHERE id = ?1 AND active = 1 LIMIT 1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?
            .ok_or(ReadOnlyWebDbError::NotFound(
                "The selected active user was not found.",
            ))?;
    let display_name: String = user.try_get("full_name")?;
    let legacy_role: String = user.try_get("role")?;

    let branch_rows = sqlx::query(
        "SELECT b.id FROM branches b JOIN user_branches ub ON ub.branch_id = b.id \
         WHERE ub.user_id = ?1 AND b.active = 1 ORDER BY ub.is_primary DESC, b.name LIMIT 101",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    if branch_rows.is_empty() || branch_rows.len() > MAX_ASSIGNED_BRANCHES {
        return Err(ReadOnlyWebDbError::Forbidden(
            "The selected user must have between one and 100 active branch assignments.",
        ));
    }
    let assigned_branch_ids = branch_rows
        .into_iter()
        .map(|row| row.try_get::<String, _>("id"))
        .collect::<Result<Vec<_>, _>>()?;

    let mut permissions = Vec::new();
    for permission in REPORT_PERMISSIONS {
        let mut allowed_everywhere = true;
        for branch_id in &assigned_branch_ids {
            if !effective_permission(pool, user_id, &legacy_role, branch_id, permission).await? {
                allowed_everywhere = false;
                break;
            }
        }
        if allowed_everywhere {
            permissions.push(permission.to_string());
        }
    }
    if !permissions
        .iter()
        .any(|permission| permission == PERMISSION_REPORTS_VIEW)
    {
        return Err(ReadOnlyWebDbError::Forbidden(
            "The selected user does not have report access at every assigned branch.",
        ));
    }

    let role = if is_manager(pool, user_id, &legacy_role).await? {
        "manager"
    } else {
        "viewer"
    };
    let assigned_json =
        serde_json::to_string(&assigned_branch_ids).map_err(|_| ReadOnlyWebDbError::Corrupt)?;
    let permissions_json =
        serde_json::to_string(&permissions).map_err(|_| ReadOnlyWebDbError::Corrupt)?;
    let grant_id = Uuid::new_v4().to_string();
    let raw_code = random_hex(16);
    let authorization_code = format_code(&raw_code);
    let grant_expires_at = now + GRANT_SECONDS;
    let session_expires_at = now + ttl_seconds;

    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO web_read_session_grants \
         (id, code_hash, user_id, authorized_by_user_id, role, assigned_branch_ids_json, \
          permissions_json, device_label, issued_at_unix_seconds, session_expires_at_unix_seconds, \
          grant_expires_at_unix_seconds) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&grant_id)
    .bind(token_hash(&raw_code))
    .bind(user_id)
    .bind(administrator_user_id)
    .bind(role)
    .bind(&assigned_json)
    .bind(&permissions_json)
    .bind(device_label)
    .bind(now)
    .bind(session_expires_at)
    .bind(grant_expires_at)
    .execute(&mut *transaction)
    .await?;
    insert_audit(
        &mut transaction,
        administrator_user_id,
        "web.read_session.issue",
        &grant_id,
        Some(&format!(
            "{{\"viewerUserId\":{},\"deviceLabel\":{}}}",
            json_string(user_id),
            json_string(device_label)
        )),
    )
    .await?;
    transaction.commit().await?;

    Ok(IssuedBrowserAuthorization {
        grant_id,
        authorization_code,
        user_id: user_id.to_string(),
        display_name,
        device_label: device_label.to_string(),
        role,
        assigned_branch_ids,
        permissions,
        grant_expires_at: timestamp(grant_expires_at)?,
        session_expires_at: timestamp(session_expires_at)?,
    })
}

pub async fn redeem_authorization(
    pool: &SqlitePool,
    authorization_code: &str,
    now: i64,
) -> Result<RedeemedSession, ReadOnlyWebDbError> {
    let normalized = normalize_code(authorization_code)?;
    let mut transaction = pool.begin().await?;
    let grant = sqlx::query(
        "SELECT g.id, g.user_id, g.role, g.assigned_branch_ids_json, g.permissions_json, \
                g.device_label, g.issued_at_unix_seconds, g.session_expires_at_unix_seconds \
         FROM web_read_session_grants g JOIN users u ON u.id = g.user_id \
         WHERE g.code_hash = ?1 AND g.redeemed_at IS NULL AND g.revoked_at IS NULL \
           AND g.grant_expires_at_unix_seconds > ?2 \
           AND g.session_expires_at_unix_seconds > ?2 AND u.active = 1 LIMIT 1",
    )
    .bind(token_hash(&normalized))
    .bind(now)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or(ReadOnlyWebDbError::NotFound(
        "This browser authorization code is invalid, expired, or already used.",
    ))?;

    let grant_id: String = grant.try_get("id")?;
    let raw_token = random_hex(32);
    let session_id = Uuid::new_v4().to_string();
    let expires_at: i64 = grant.try_get("session_expires_at_unix_seconds")?;
    let updated = sqlx::query(
        "UPDATE web_read_session_grants SET redeemed_at = datetime('now') \
         WHERE id = ?1 AND redeemed_at IS NULL AND revoked_at IS NULL",
    )
    .bind(&grant_id)
    .execute(&mut *transaction)
    .await?;
    if updated.rows_affected() != 1 {
        return Err(ReadOnlyWebDbError::NotFound(
            "This browser authorization code is invalid, expired, or already used.",
        ));
    }
    sqlx::query(
        "INSERT INTO web_read_sessions \
         (id, token_hash, user_id, role, read_only, assigned_branch_ids_json, permissions_json, \
          device_label, issued_at_unix_seconds, expires_at_unix_seconds) \
         VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&session_id)
    .bind(token_hash(&raw_token))
    .bind(grant.try_get::<String, _>("user_id")?)
    .bind(grant.try_get::<String, _>("role")?)
    .bind(grant.try_get::<String, _>("assigned_branch_ids_json")?)
    .bind(grant.try_get::<String, _>("permissions_json")?)
    .bind(grant.try_get::<String, _>("device_label")?)
    .bind(grant.try_get::<i64, _>("issued_at_unix_seconds")?)
    .bind(expires_at)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(RedeemedSession {
        raw_token,
        max_age_seconds: expires_at - now,
    })
}

pub async fn load_session(
    pool: &SqlitePool,
    raw_token: &str,
    now: i64,
) -> Result<StoredSession, ReadOnlyWebDbError> {
    if raw_token.len() < 43
        || raw_token.len() > 256
        || !raw_token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(ReadOnlyWebDbError::NotFound(
            "A valid browser session is required.",
        ));
    }
    let row = sqlx::query(
        "SELECT ws.id, ws.user_id, u.full_name, ws.role, ws.read_only, \
                ws.assigned_branch_ids_json, ws.permissions_json, ws.device_label, \
                ws.issued_at_unix_seconds, ws.expires_at_unix_seconds \
         FROM web_read_sessions ws JOIN users u ON u.id = ws.user_id \
         WHERE ws.token_hash = ?1 AND ws.revoked_at IS NULL AND u.active = 1 \
           AND ws.expires_at_unix_seconds > ?2 LIMIT 1",
    )
    .bind(token_hash(raw_token))
    .bind(now)
    .fetch_optional(pool)
    .await?
    .ok_or(ReadOnlyWebDbError::NotFound(
        "A valid browser session is required.",
    ))?;
    let role = match row.try_get::<String, _>("role")?.as_str() {
        "manager" => SessionRole::Manager,
        "viewer" => SessionRole::Viewer,
        _ => return Err(ReadOnlyWebDbError::Corrupt),
    };
    let assigned_branch_ids_json: String = row.try_get("assigned_branch_ids_json")?;
    let assigned_branch_ids = parse_claim_array(&assigned_branch_ids_json, MAX_ASSIGNED_BRANCHES)?;
    let permissions = parse_claim_array(
        &row.try_get::<String, _>("permissions_json")?,
        MAX_SESSION_PERMISSIONS,
    )?;
    Ok(StoredSession {
        session_id: row.try_get("id")?,
        user_id: row.try_get("user_id")?,
        display_name: row.try_get("full_name")?,
        role,
        read_only: row.try_get::<i64, _>("read_only")? == 1,
        assigned_branch_ids,
        assigned_branch_ids_json,
        permissions,
        device_label: row.try_get("device_label")?,
        issued_at_unix_seconds: row.try_get("issued_at_unix_seconds")?,
        expires_at_unix_seconds: row.try_get("expires_at_unix_seconds")?,
    })
}

pub async fn list_authorizations(
    pool: &SqlitePool,
    administrator_user_id: &str,
    now: i64,
) -> Result<Vec<BrowserSessionAdminRow>, ReadOnlyWebDbError> {
    require_administrator(pool, administrator_user_id).await?;
    let rows = sqlx::query(
        "SELECT id, display_name, device_label, state, issued_at, expires_at, revoked_at FROM ( \
           SELECT ws.id, u.full_name AS display_name, ws.device_label, \
             CASE WHEN ws.revoked_at IS NOT NULL THEN 'revoked' WHEN ws.expires_at_unix_seconds <= ?1 THEN 'expired' ELSE 'active' END AS state, \
             ws.issued_at_unix_seconds AS issued_at, ws.expires_at_unix_seconds AS expires_at, ws.revoked_at \
           FROM web_read_sessions ws JOIN users u ON u.id = ws.user_id \
           UNION ALL \
           SELECT g.id, u.full_name, g.device_label, \
             CASE WHEN g.revoked_at IS NOT NULL THEN 'revoked' WHEN g.redeemed_at IS NOT NULL THEN 'redeemed' WHEN g.grant_expires_at_unix_seconds <= ?1 THEN 'expired' ELSE 'pending' END, \
             g.issued_at_unix_seconds, g.session_expires_at_unix_seconds, g.revoked_at \
           FROM web_read_session_grants g JOIN users u ON u.id = g.user_id \
         ) ORDER BY issued_at DESC LIMIT 100",
    )
    .bind(now)
    .fetch_all(pool)
    .await?;
    rows.into_iter()
        .map(|row| {
            Ok(BrowserSessionAdminRow {
                id: row.try_get("id")?,
                display_name: row.try_get("display_name")?,
                device_label: row.try_get("device_label")?,
                state: row.try_get("state")?,
                issued_at: timestamp(row.try_get("issued_at")?)?,
                expires_at: timestamp(row.try_get("expires_at")?)?,
                revoked_at: row.try_get("revoked_at")?,
            })
        })
        .collect()
}

pub async fn revoke_authorization(
    pool: &SqlitePool,
    administrator_user_id: &str,
    authorization_id: &str,
) -> Result<(), ReadOnlyWebDbError> {
    require_administrator(pool, administrator_user_id).await?;
    let mut transaction = pool.begin().await?;
    let sessions = sqlx::query(
        "UPDATE web_read_sessions SET revoked_at = datetime('now') WHERE id = ?1 AND revoked_at IS NULL",
    )
    .bind(authorization_id)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    let grants = sqlx::query(
        "UPDATE web_read_session_grants SET revoked_at = datetime('now') WHERE id = ?1 AND revoked_at IS NULL",
    )
    .bind(authorization_id)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    if sessions + grants == 0 {
        return Err(ReadOnlyWebDbError::NotFound(
            "Browser authorization was not found.",
        ));
    }
    insert_audit(
        &mut transaction,
        administrator_user_id,
        "web.read_session.revoke",
        authorization_id,
        None,
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

async fn require_administrator(pool: &SqlitePool, user_id: &str) -> Result<(), ReadOnlyWebDbError> {
    let allowed: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM users u WHERE u.id = ?1 AND u.active = 1 AND (u.role = 'owner' OR EXISTS ( \
           SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'role_owner' \
         )) LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    allowed.ok_or(ReadOnlyWebDbError::Forbidden(
        "Only an authenticated owner can authorize browser viewers.",
    ))?;
    Ok(())
}

async fn is_manager(
    pool: &SqlitePool,
    user_id: &str,
    legacy_role: &str,
) -> Result<bool, sqlx::Error> {
    if matches!(legacy_role, "owner" | "manager") {
        return Ok(true);
    }
    sqlx::query_scalar::<_, i64>(
        "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = ?1 AND role_id IN ('role_owner','role_manager'))",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map(|value| value == 1)
}

async fn effective_permission(
    pool: &SqlitePool,
    user_id: &str,
    legacy_role: &str,
    branch_id: &str,
    permission: &str,
) -> Result<bool, sqlx::Error> {
    let fallback = legacy_permission(legacy_role, permission);
    let decision: i64 = sqlx::query_scalar(
        "WITH effective_roles(role_id) AS ( \
           SELECT role_id FROM user_roles WHERE user_id = ?1 AND (branch_id IS NULL OR branch_id = ?2) AND (module_id IS NULL OR module_id = 'core') \
           UNION SELECT gr.role_id FROM group_roles gr JOIN group_members gm ON gm.group_id = gr.group_id \
             WHERE gm.user_id = ?1 AND (gr.branch_id IS NULL OR gr.branch_id = ?2) AND (gr.module_id IS NULL OR gr.module_id = 'core') \
         ), subjects(subject_id) AS ( \
           SELECT ?1 UNION SELECT group_id FROM group_members WHERE user_id = ?1 UNION SELECT role_id FROM effective_roles \
         ) SELECT CASE \
           WHEN EXISTS(SELECT 1 FROM effective_roles WHERE role_id = 'role_owner') THEN 1 \
           WHEN EXISTS(SELECT 1 FROM permission_overrides po JOIN subjects s ON s.subject_id = po.subject_id \
             WHERE po.permission_key = ?3 AND po.effect = 'deny' AND (po.branch_id IS NULL OR po.branch_id = ?2) AND (po.module_id IS NULL OR po.module_id = 'core')) THEN 0 \
           WHEN EXISTS(SELECT 1 FROM permission_overrides po JOIN subjects s ON s.subject_id = po.subject_id \
             WHERE po.permission_key = ?3 AND po.effect = 'allow' AND (po.branch_id IS NULL OR po.branch_id = ?2) AND (po.module_id IS NULL OR po.module_id = 'core')) THEN 1 \
           WHEN EXISTS(SELECT 1 FROM role_permissions rp JOIN effective_roles er ON er.role_id = rp.role_id WHERE rp.permission_key = ?3 AND rp.effect = 'deny') THEN 0 \
           WHEN EXISTS(SELECT 1 FROM role_permissions rp JOIN effective_roles er ON er.role_id = rp.role_id WHERE rp.permission_key = ?3 AND rp.effect = 'allow') THEN 1 \
           ELSE ?4 END",
    )
    .bind(user_id)
    .bind(branch_id)
    .bind(permission)
    .bind(if fallback { 1 } else { 0 })
    .fetch_one(pool)
    .await?;
    Ok(decision == 1)
}

fn legacy_permission(role: &str, permission: &str) -> bool {
    match role {
        "owner" => true,
        "manager" => REPORT_PERMISSIONS.contains(&permission),
        "viewer" => matches!(
            permission,
            PERMISSION_REPORTS_VIEW | PERMISSION_REPORTS_PNL | PERMISSION_ETIMS_VIEW
        ),
        _ => false,
    }
}

async fn insert_audit(
    transaction: &mut Transaction<'_, Sqlite>,
    user_id: &str,
    action: &str,
    entity_id: &str,
    metadata: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO audit_log \
         (id, user_id, user_name, permission_key, action, outcome, risk_level, entity_type, entity_id, metadata) \
         SELECT ?1, u.id, u.full_name, 'settings.network', ?2, 'allowed', 'critical', 'web_read_session', ?3, ?4 \
         FROM users u WHERE u.id = ?5",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(action)
    .bind(entity_id)
    .bind(metadata)
    .bind(user_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn parse_claim_array(raw: &str, cap: usize) -> Result<Vec<String>, ReadOnlyWebDbError> {
    let values: Vec<String> = serde_json::from_str(raw).map_err(|_| ReadOnlyWebDbError::Corrupt)?;
    if values.is_empty() || values.len() > cap {
        return Err(ReadOnlyWebDbError::Corrupt);
    }
    Ok(values)
}

fn random_hex(bytes: usize) -> String {
    let mut value = vec![0_u8; bytes];
    rand::thread_rng().fill_bytes(&mut value);
    hex::encode(value)
}

fn format_code(raw: &str) -> String {
    raw.as_bytes()
        .chunks(4)
        .map(|chunk| String::from_utf8_lossy(chunk).to_uppercase())
        .collect::<Vec<_>>()
        .join("-")
}

fn normalize_code(value: &str) -> Result<String, ReadOnlyWebDbError> {
    let normalized: String = value
        .bytes()
        .filter(|byte| !matches!(byte, b'-' | b' '))
        .map(|byte| byte.to_ascii_lowercase() as char)
        .collect();
    if normalized.len() != 32 || !normalized.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(ReadOnlyWebDbError::Invalid(
            "Authorization code format is invalid.",
        ));
    }
    Ok(normalized)
}

fn timestamp(value: i64) -> Result<String, ReadOnlyWebDbError> {
    chrono::DateTime::from_timestamp(value, 0)
        .map(|date| date.to_rfc3339())
        .ok_or(ReadOnlyWebDbError::Corrupt)
}

fn json_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}

// Fixed, bounded report projections. Every business-row query below receives
// the issuance-time branch snapshot as a bound JSON parameter.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPage<T> {
    items: Vec<T>,
    next_cursor: Option<String>,
    has_more: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityProjection {
    id: String,
    occurred_at: String,
    branch_name: String,
    description: String,
    amount: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeProjection {
    generated_at: String,
    scope_label: String,
    sales_today: String,
    transaction_count: i64,
    low_stock_count: i64,
    open_alert_count: i64,
    recent_activity: Vec<ActivityProjection>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchProjection {
    id: String,
    code: String,
    name: String,
    town: Option<String>,
    last_seen_at: Option<String>,
    sync_state: &'static str,
    sales_today: String,
    transaction_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportDefinitionProjection {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    permission: &'static str,
    sensitive: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRowProjection {
    id: String,
    label: String,
    secondary: String,
    value: String,
    occurred_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertProjection {
    id: String,
    severity: String,
    title: String,
    detail: String,
    branch_name: String,
    raised_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncHealthProjection {
    branch_id: String,
    branch_name: String,
    state: &'static str,
    last_successful_sync_at: Option<String>,
    pending_records: i64,
    hub_reachable: bool,
}

#[derive(Serialize)]
pub struct FieldProjection {
    label: String,
    value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrilldownProjection {
    id: String,
    title: String,
    subtitle: String,
    branch_name: String,
    fields: Vec<FieldProjection>,
    related: CursorPage<ReportRowProjection>,
}

#[derive(Serialize)]
pub struct AssignedBranchProjection {
    id: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileProjection {
    session_id: String,
    user_id: String,
    role: &'static str,
    readonly: bool,
    display_name: String,
    role_label: &'static str,
    assigned_branches: Vec<AssignedBranchProjection>,
    permissions: Vec<String>,
    session_issued_at: String,
    session_expires_at: String,
    connected_hub_name: String,
    device_label: String,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum ProjectionPayload {
    Home(HomeProjection),
    Branches(CursorPage<BranchProjection>),
    Reports(Vec<ReportDefinitionProjection>),
    Rows(CursorPage<ReportRowProjection>),
    Alerts(CursorPage<AlertProjection>),
    Sync(SyncHealthProjection),
    Drilldown(DrilldownProjection),
    Profile(ProfileProjection),
}

impl ProjectionPayload {
    pub fn item_count(&self) -> usize {
        match self {
            Self::Home(value) => value.recent_activity.len(),
            Self::Branches(value) => value.items.len(),
            Self::Reports(value) => value.len(),
            Self::Rows(value) => value.items.len(),
            Self::Alerts(value) => value.items.len(),
            Self::Sync(_) | Self::Profile(_) => 1,
            Self::Drilldown(value) => value.related.items.len(),
        }
    }
}

pub async fn execute_projection(
    pool: &SqlitePool,
    hub_name: &str,
    session: &StoredSession,
    authorized: &AuthorizedRead<'_>,
) -> Result<ProjectionPayload, ReadOnlyWebDbError> {
    match authorized.projection {
        Projection::HomeDashboard => Ok(ProjectionPayload::Home(
            home_projection(pool, authorized).await?,
        )),
        Projection::BranchesList => Ok(ProjectionPayload::Branches(
            branch_projection(pool, authorized).await?,
        )),
        Projection::ReportsCatalog => Ok(ProjectionPayload::Reports(report_catalog(session))),
        Projection::ReportsRows => Ok(ProjectionPayload::Rows(
            report_rows(pool, authorized).await?,
        )),
        Projection::AlertsList => Ok(ProjectionPayload::Alerts(
            alert_projection(pool, authorized).await?,
        )),
        Projection::SyncHealth => Ok(ProjectionPayload::Sync(
            sync_projection(pool, authorized).await?,
        )),
        Projection::DrilldownReportRow => Ok(ProjectionPayload::Drilldown(
            drilldown_projection(pool, authorized).await?,
        )),
        Projection::ProfileSession => Ok(ProjectionPayload::Profile(
            profile_projection(pool, hub_name, session).await?,
        )),
    }
}

fn branch_filter<'a>(authorized: &AuthorizedRead<'a>) -> Option<&'a str> {
    match authorized.scope {
        Some(BranchScope::Branch(branch_id)) => Some(branch_id),
        Some(BranchScope::All) | None => None,
    }
}

fn branch_ids_json(authorized: &AuthorizedRead<'_>) -> Result<String, ReadOnlyWebDbError> {
    serde_json::to_string(&authorized.authorized_branch_ids)
        .map_err(|_| ReadOnlyWebDbError::internal("The branch authorization could not be encoded."))
}

async fn home_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<HomeProjection, ReadOnlyWebDbError> {
    let branch_id = branch_filter(authorized);
    let summary = sqlx::query(
        "SELECT COALESCE(SUM(s.total), 0.0) AS total, COUNT(*) AS sale_count \
         FROM sales s WHERE s.status = 'completed' AND date(s.created_at) = date('now') \
           AND s.branch_id IN (SELECT value FROM json_each(?1)) \
           AND (?2 IS NULL OR s.branch_id = ?2)",
    )
    .bind(branch_ids_json(authorized)?)
    .bind(branch_id)
    .fetch_one(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    let low_stock: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM stockable_products p WHERE p.active = 1 AND COALESCE(( \
           SELECT SUM(b.quantity) FROM batches b \
           WHERE b.product_id = p.id AND b.branch_id IN (SELECT value FROM json_each(?1)) \
             AND (?2 IS NULL OR b.branch_id = ?2)), 0) <= p.reorder_level",
    )
    .bind(branch_ids_json(authorized)?)
    .bind(branch_id)
    .fetch_one(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    let open_alert_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE read_at IS NULL \
           AND (snoozed_until IS NULL OR snoozed_until < datetime('now')) \
           AND json_extract(metadata, '$.branchId') IN (SELECT value FROM json_each(?1))",
    )
    .bind(branch_ids_json(authorized)?)
    .fetch_one(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    let activity_rows = sqlx::query(
        "SELECT s.id, s.sale_number, s.total, s.created_at, b.name AS branch_name \
         FROM sales s JOIN branches b ON b.id = s.branch_id \
         WHERE s.status = 'completed' \
           AND s.branch_id IN (SELECT value FROM json_each(?1)) \
           AND (?2 IS NULL OR s.branch_id = ?2) \
         ORDER BY s.created_at DESC LIMIT 25",
    )
    .bind(branch_ids_json(authorized)?)
    .bind(branch_id)
    .fetch_all(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    let recent_activity = activity_rows
        .into_iter()
        .map(|row| {
            Ok(ActivityProjection {
                id: row.try_get("id").map_err(ReadOnlyWebDbError::database)?,
                occurred_at: row
                    .try_get("created_at")
                    .map_err(ReadOnlyWebDbError::database)?,
                branch_name: row
                    .try_get("branch_name")
                    .map_err(ReadOnlyWebDbError::database)?,
                description: format!(
                    "Sale {} completed",
                    row.try_get::<i64, _>("sale_number")
                        .map_err(ReadOnlyWebDbError::database)?
                ),
                amount: Some(format_kes(
                    row.try_get("total").map_err(ReadOnlyWebDbError::database)?,
                )),
            })
        })
        .collect::<Result<Vec<_>, ReadOnlyWebDbError>>()?;
    let scope_label = match branch_id {
        Some(id) => {
            sqlx::query_scalar::<_, String>("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(ReadOnlyWebDbError::database)?
                .unwrap_or_else(|| "Assigned branch".to_string())
        }
        None => "All branches / analytics".to_string(),
    };
    Ok(HomeProjection {
        generated_at: chrono::Utc::now().to_rfc3339(),
        scope_label,
        sales_today: format_kes(
            summary
                .try_get("total")
                .map_err(ReadOnlyWebDbError::database)?,
        ),
        transaction_count: summary
            .try_get("sale_count")
            .map_err(ReadOnlyWebDbError::database)?,
        low_stock_count: low_stock,
        open_alert_count,
        recent_activity,
    })
}

async fn branch_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<BranchProjection>, ReadOnlyWebDbError> {
    let offset = cursor_offset(authorized.query.cursor)?;
    let search = authorized.query.search.unwrap_or("");
    let rows = sqlx::query(
        "SELECT b.id, b.code, b.name, b.address, \
           COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed' AND date(s.created_at) = date('now')), 0.0) AS sales_today, \
           COALESCE((SELECT COUNT(*) FROM sales s WHERE s.branch_id = b.id AND s.status = 'completed' AND date(s.created_at) = date('now')), 0) AS transaction_count \
         FROM branches b \
         WHERE b.id IN (SELECT value FROM json_each(?1)) AND b.active = 1 \
           AND (?2 = '' OR b.name LIKE '%' || ?2 || '%' OR b.code LIKE '%' || ?2 || '%') \
         ORDER BY b.is_default DESC, b.name LIMIT ?3 OFFSET ?4",
    )
    .bind(branch_ids_json(authorized)?)
    .bind(search)
    .bind((authorized.query.limit + 1) as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    paged(rows, authorized.query.limit, offset, |row| {
        Ok(BranchProjection {
            id: row.try_get("id").map_err(ReadOnlyWebDbError::database)?,
            code: row.try_get("code").map_err(ReadOnlyWebDbError::database)?,
            name: row.try_get("name").map_err(ReadOnlyWebDbError::database)?,
            town: row
                .try_get("address")
                .map_err(ReadOnlyWebDbError::database)?,
            last_seen_at: None,
            sync_state: "healthy",
            sales_today: format_kes(
                row.try_get("sales_today")
                    .map_err(ReadOnlyWebDbError::database)?,
            ),
            transaction_count: row
                .try_get("transaction_count")
                .map_err(ReadOnlyWebDbError::database)?,
        })
    })
}

fn report_catalog(session: &StoredSession) -> Vec<ReportDefinitionProjection> {
    Report::ALL
        .iter()
        .copied()
        .filter(|report| {
            session
                .permissions
                .iter()
                .any(|permission| permission == report.required_permission())
        })
        .map(report_definition)
        .collect()
}

fn report_definition(report: Report) -> ReportDefinitionProjection {
    let (title, description) = match report {
        Report::SalesSummary => (
            "Sales summary",
            "Revenue, transaction count, and payment mix.",
        ),
        Report::InventoryPosition => (
            "Inventory position",
            "Stock value, low-stock items, and ageing.",
        ),
        Report::ProfitAndLoss => (
            "Profit & loss",
            "Income, cost of sales, and operating result.",
        ),
        Report::ZReport => ("Z-report", "Till totals and reconciliation variance."),
        Report::TaxSummary => ("Tax summary", "VAT and eTIMS submission totals."),
        Report::PayrollSummary => (
            "Payroll summary",
            "Payroll totals without employee bank details.",
        ),
        Report::AuditSummary => ("Audit summary", "Security and business event overview."),
    };
    ReportDefinitionProjection {
        id: report.id(),
        title,
        description,
        permission: report.required_permission(),
        sensitive: report.sensitive(),
    }
}

async fn report_rows(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<ReportRowProjection>, ReadOnlyWebDbError> {
    let report = authorized
        .report
        .ok_or_else(|| ReadOnlyWebDbError::bad_request("A report is required."))?;
    let offset = cursor_offset(authorized.query.cursor)?;
    let limit = authorized.query.limit;
    let search = authorized.query.search.unwrap_or("");
    let branch_id = branch_filter(authorized);
    let rows = match report {
        Report::InventoryPosition => sqlx::query(
            "SELECT p.id, p.name AS label, COALESCE(p.sku, 'No SKU') AS secondary, \
                    COALESCE(SUM(b.quantity), 0.0) AS amount, MAX(p.updated_at) AS occurred_at \
             FROM stockable_products p LEFT JOIN batches b ON b.product_id = p.id \
               AND b.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR b.branch_id = ?2) \
             WHERE p.active = 1 AND (?3 = '' OR p.name LIKE '%' || ?3 || '%' OR p.sku LIKE '%' || ?3 || '%') \
             GROUP BY p.id, p.name, p.sku ORDER BY p.name LIMIT ?4 OFFSET ?5",
        )
        .bind(branch_ids_json(authorized)?).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(ReadOnlyWebDbError::database)?,
        Report::PayrollSummary => sqlx::query(
            "SELECT pr.id, printf('%04d-%02d', pr.period_year, pr.period_month) AS label, \
                    pr.status || ' / ' || pr.employee_count || ' employees' AS secondary, \
                    pr.net_total AS amount, pr.created_at AS occurred_at \
             FROM payroll_runs pr WHERE pr.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR pr.branch_id = ?2) \
               AND (?3 = '' OR printf('%04d-%02d', pr.period_year, pr.period_month) LIKE '%' || ?3 || '%') \
             ORDER BY pr.period_year DESC, pr.period_month DESC LIMIT ?4 OFFSET ?5",
        )
        .bind(branch_ids_json(authorized)?).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(ReadOnlyWebDbError::database)?,
        Report::AuditSummary => sqlx::query(
            "SELECT a.id, a.action AS label, COALESCE(a.outcome, 'recorded') || ' / ' || COALESCE(a.permission_key, 'general') AS secondary, \
                    0.0 AS amount, a.created_at AS occurred_at \
             FROM audit_log a WHERE a.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR a.branch_id = ?2) \
               AND (?3 = '' OR a.action LIKE '%' || ?3 || '%' OR a.permission_key LIKE '%' || ?3 || '%') \
             ORDER BY a.created_at DESC LIMIT ?4 OFFSET ?5",
        )
        .bind(branch_ids_json(authorized)?).bind(branch_id).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(ReadOnlyWebDbError::database)?,
        _ => sqlx::query(
            "SELECT s.id, 'Sale ' || s.sale_number AS label, \
                    s.payment_status || ' / ' || b.name AS secondary, \
                    CASE WHEN ?3 = 'tax-summary' THEN s.tax_amount ELSE s.total END AS amount, \
                    s.created_at AS occurred_at \
             FROM sales s JOIN branches b ON b.id = s.branch_id \
             WHERE s.status = 'completed' AND s.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR s.branch_id = ?2) \
               AND (?4 = '' OR CAST(s.sale_number AS TEXT) LIKE '%' || ?4 || '%' OR b.name LIKE '%' || ?4 || '%') \
             ORDER BY s.created_at DESC LIMIT ?5 OFFSET ?6",
        )
        .bind(branch_ids_json(authorized)?).bind(branch_id).bind(report.id()).bind(search).bind((limit + 1) as i64).bind(offset as i64)
        .fetch_all(pool).await.map_err(ReadOnlyWebDbError::database)?,
    };
    paged(rows, limit, offset, |row| {
        let amount: f64 = row
            .try_get("amount")
            .map_err(ReadOnlyWebDbError::database)?;
        Ok(ReportRowProjection {
            id: row.try_get("id").map_err(ReadOnlyWebDbError::database)?,
            label: row.try_get("label").map_err(ReadOnlyWebDbError::database)?,
            secondary: row
                .try_get("secondary")
                .map_err(ReadOnlyWebDbError::database)?,
            value: if report == Report::InventoryPosition {
                format!("{amount:.2} units")
            } else if report == Report::AuditSummary {
                "Recorded".to_string()
            } else {
                format_kes(amount)
            },
            occurred_at: row
                .try_get("occurred_at")
                .map_err(ReadOnlyWebDbError::database)?,
        })
    })
}

async fn alert_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<CursorPage<AlertProjection>, ReadOnlyWebDbError> {
    let branch_id = branch_filter(authorized)
        .ok_or_else(|| ReadOnlyWebDbError::bad_request("A branch is required."))?;
    let branch_name: String = sqlx::query_scalar("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
        .bind(branch_id)
        .fetch_one(pool)
        .await
        .map_err(ReadOnlyWebDbError::database)?;
    let offset = cursor_offset(authorized.query.cursor)?;
    let search = authorized.query.search.unwrap_or("");
    let rows = sqlx::query(
        "SELECT id, severity, title, COALESCE(body, '') AS detail, created_at \
         FROM notifications WHERE read_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < datetime('now')) \
           AND json_extract(metadata, '$.branchId') = ?1 \
           AND (?2 = '' OR title LIKE '%' || ?2 || '%' OR body LIKE '%' || ?2 || '%') \
         ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
    )
    .bind(branch_id).bind(search).bind((authorized.query.limit + 1) as i64).bind(offset as i64)
    .fetch_all(pool).await.map_err(ReadOnlyWebDbError::database)?;
    paged(rows, authorized.query.limit, offset, |row| {
        Ok(AlertProjection {
            id: row.try_get("id").map_err(ReadOnlyWebDbError::database)?,
            severity: row
                .try_get("severity")
                .map_err(ReadOnlyWebDbError::database)?,
            title: row.try_get("title").map_err(ReadOnlyWebDbError::database)?,
            detail: row
                .try_get("detail")
                .map_err(ReadOnlyWebDbError::database)?,
            branch_name: branch_name.clone(),
            raised_at: row
                .try_get("created_at")
                .map_err(ReadOnlyWebDbError::database)?,
        })
    })
}

async fn sync_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<SyncHealthProjection, ReadOnlyWebDbError> {
    let branch_id = branch_filter(authorized)
        .ok_or_else(|| ReadOnlyWebDbError::bad_request("A branch is required."))?;
    let branch_name: String = sqlx::query_scalar("SELECT name FROM branches WHERE id = ?1 LIMIT 1")
        .bind(branch_id)
        .fetch_one(pool)
        .await
        .map_err(ReadOnlyWebDbError::database)?;
    let pending_records: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE branch_id = ?1 AND state IN ('pending','leased','awaiting_receipt')",
    )
    .bind(branch_id)
    .fetch_one(pool).await.map_err(ReadOnlyWebDbError::database)?;
    let last_successful_sync_at: Option<String> = sqlx::query_scalar(
        "SELECT MAX(updated_at) FROM sync_outbox WHERE branch_id = ?1 AND state = 'delivered'",
    )
    .bind(branch_id)
    .fetch_one(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    Ok(SyncHealthProjection {
        branch_id: branch_id.to_string(),
        branch_name,
        state: if pending_records > 0 {
            "delayed"
        } else {
            "healthy"
        },
        last_successful_sync_at,
        pending_records,
        hub_reachable: true,
    })
}

async fn drilldown_projection(
    pool: &SqlitePool,
    authorized: &AuthorizedRead<'_>,
) -> Result<DrilldownProjection, ReadOnlyWebDbError> {
    let record_id = authorized
        .record_id
        .ok_or_else(|| ReadOnlyWebDbError::bad_request("A record is required."))?;
    let report = authorized
        .report
        .ok_or_else(|| ReadOnlyWebDbError::bad_request("A report is required."))?;
    let branch_id = branch_filter(authorized);
    let row = match report {
        Report::InventoryPosition => sqlx::query(
            "SELECT p.id, p.name AS label, COALESCE(p.sku, 'No SKU') AS secondary, COALESCE(SUM(b.quantity), 0.0) AS amount, NULL AS occurred_at, COALESCE(MAX(br.name), 'Assigned branches') AS branch_name \
             FROM stockable_products p LEFT JOIN batches b ON b.product_id = p.id LEFT JOIN branches br ON br.id = b.branch_id \
             WHERE p.id = ?3 AND b.branch_id IN (SELECT value FROM json_each(?1)) AND (?2 IS NULL OR b.branch_id = ?2) GROUP BY p.id, p.name, p.sku",
        ).bind(branch_ids_json(authorized)?).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(ReadOnlyWebDbError::database)?,
        Report::PayrollSummary => sqlx::query(
            "SELECT pr.id, printf('%04d-%02d', pr.period_year, pr.period_month) AS label, \
                    pr.status || ' / ' || pr.employee_count || ' employees' AS secondary, \
                    pr.net_total AS amount, pr.created_at AS occurred_at, \
                    COALESCE(b.name, 'All assigned branches') AS branch_name \
             FROM payroll_runs pr LEFT JOIN branches b ON b.id = pr.branch_id \
             WHERE pr.id = ?3 \
               AND pr.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR pr.branch_id = ?2) LIMIT 1",
        ).bind(branch_ids_json(authorized)?).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(ReadOnlyWebDbError::database)?,
        Report::AuditSummary => sqlx::query(
            "SELECT a.id, a.action AS label, \
                    COALESCE(a.outcome, 'recorded') || ' / ' || COALESCE(a.permission_key, 'general') AS secondary, \
                    0.0 AS amount, a.created_at AS occurred_at, \
                    COALESCE(b.name, 'All assigned branches') AS branch_name \
             FROM audit_log a LEFT JOIN branches b ON b.id = a.branch_id \
             WHERE a.id = ?3 \
               AND a.branch_id IN (SELECT value FROM json_each(?1)) \
               AND (?2 IS NULL OR a.branch_id = ?2) LIMIT 1",
        ).bind(branch_ids_json(authorized)?).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(ReadOnlyWebDbError::database)?,
        Report::SalesSummary | Report::ProfitAndLoss | Report::ZReport | Report::TaxSummary => sqlx::query(
            "SELECT s.id, 'Sale ' || s.sale_number AS label, s.payment_status AS secondary, s.total AS amount, s.created_at AS occurred_at, b.name AS branch_name \
             FROM sales s JOIN branches b ON b.id = s.branch_id WHERE s.id = ?3 AND s.status = 'completed' \
               AND s.branch_id IN (SELECT value FROM json_each(?1)) AND (?2 IS NULL OR s.branch_id = ?2) LIMIT 1",
        ).bind(branch_ids_json(authorized)?).bind(branch_id).bind(record_id).fetch_optional(pool).await.map_err(ReadOnlyWebDbError::database)?,
    }.ok_or_else(|| ReadOnlyWebDbError::not_found("The requested report row was not found."))?;
    let label: String = row.try_get("label").map_err(ReadOnlyWebDbError::database)?;
    let secondary: String = row
        .try_get("secondary")
        .map_err(ReadOnlyWebDbError::database)?;
    let amount: f64 = row
        .try_get("amount")
        .map_err(ReadOnlyWebDbError::database)?;
    let occurred_at: Option<String> = row
        .try_get("occurred_at")
        .map_err(ReadOnlyWebDbError::database)?;
    let branch_name: String = row
        .try_get("branch_name")
        .map_err(ReadOnlyWebDbError::database)?;
    let related = CursorPage {
        items: vec![ReportRowProjection {
            id: record_id.to_string(),
            label: label.clone(),
            secondary: secondary.clone(),
            value: if report == Report::InventoryPosition {
                format!("{amount:.2} units")
            } else {
                format_kes(amount)
            },
            occurred_at: occurred_at.clone(),
        }],
        next_cursor: None,
        has_more: false,
    };
    Ok(DrilldownProjection {
        id: record_id.to_string(),
        title: label,
        subtitle: report_definition(report).title.to_string(),
        branch_name,
        fields: vec![
            FieldProjection {
                label: "Status".to_string(),
                value: secondary,
            },
            FieldProjection {
                label: "Value".to_string(),
                value: if report == Report::InventoryPosition {
                    format!("{amount:.2} units")
                } else {
                    format_kes(amount)
                },
            },
            FieldProjection {
                label: "Recorded".to_string(),
                value: occurred_at.unwrap_or_else(|| "Not recorded".to_string()),
            },
        ],
        related,
    })
}

async fn profile_projection(
    pool: &SqlitePool,
    hub_name: &str,
    session: &StoredSession,
) -> Result<ProfileProjection, ReadOnlyWebDbError> {
    let rows = sqlx::query(
        "SELECT b.id, b.name FROM branches b \
         WHERE b.id IN (SELECT value FROM json_each(?1)) AND b.active = 1 \
         ORDER BY b.is_default DESC, b.name LIMIT 100",
    )
    .bind(&session.assigned_branch_ids_json)
    .fetch_all(pool)
    .await
    .map_err(ReadOnlyWebDbError::database)?;
    let assigned = rows
        .into_iter()
        .filter_map(|row| {
            let id: String = row.try_get("id").ok()?;
            if !session.assigned_branch_ids.contains(&id) {
                return None;
            }
            Some(AssignedBranchProjection {
                id,
                name: row.try_get("name").ok()?,
            })
        })
        .collect();
    let (role, role_label) = match session.role {
        SessionRole::Manager => ("manager", "Manager"),
        SessionRole::Viewer => ("viewer", "Viewer"),
    };
    Ok(ProfileProjection {
        session_id: session.session_id.clone(),
        user_id: session.user_id.clone(),
        role,
        readonly: true,
        display_name: session.display_name.clone(),
        role_label,
        assigned_branches: assigned,
        permissions: session.permissions.clone(),
        session_issued_at: timestamp_iso(session.issued_at_unix_seconds)?,
        session_expires_at: timestamp_iso(session.expires_at_unix_seconds)?,
        connected_hub_name: hub_name.to_string(),
        device_label: session.device_label.clone(),
    })
}

fn paged<T, F>(
    rows: Vec<sqlx::sqlite::SqliteRow>,
    limit: usize,
    offset: usize,
    map: F,
) -> Result<CursorPage<T>, ReadOnlyWebDbError>
where
    F: Fn(sqlx::sqlite::SqliteRow) -> Result<T, ReadOnlyWebDbError>,
{
    let has_more = rows.len() > limit;
    let items = rows
        .into_iter()
        .take(limit)
        .map(map)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(CursorPage {
        items,
        next_cursor: has_more.then(|| format!("o_{}", offset + limit)),
        has_more,
    })
}

fn cursor_offset(cursor: Option<&str>) -> Result<usize, ReadOnlyWebDbError> {
    match cursor {
        None => Ok(0),
        Some(value) => value
            .strip_prefix("o_")
            .and_then(|raw| raw.parse::<usize>().ok())
            .filter(|offset| *offset <= 1_000_000)
            .ok_or_else(|| ReadOnlyWebDbError::bad_request("The cursor is invalid.")),
    }
}

fn format_kes(value: f64) -> String {
    format!("KES {value:.2}")
}

fn timestamp_iso(value: i64) -> Result<String, ReadOnlyWebDbError> {
    chrono::DateTime::from_timestamp(value, 0)
        .map(|date| date.to_rfc3339())
        .ok_or_else(|| ReadOnlyWebDbError::unauthorized("A valid browser session is required."))
}
