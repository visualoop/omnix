use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::{Uuid, Version};

use super::authorization::{
    AuthenticatedPrincipal, AuthenticationLevel, SessionAccess, SessionContext,
};
use super::contracts::API_SCHEMA_V1;
use super::error::CommandApiError;

pub const LOCAL_LOGIN_SCHEMA: &str = "auth.branchLocalLogin.v1";
pub const MAX_LOCAL_SESSION_TTL: Duration = Duration::hours(12);

#[derive(Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BranchLocalLoginV1 {
    pub schema_version: u16,
    pub request_id: String,
    pub login_type: String,
    pub node_id: String,
    pub branch_id: String,
    pub username: String,
    pub password: String,
    pub requested_access: LocalAccessV1,
}

/// Deliberately excludes browser access. Browser sessions are issued through the online/read-only
/// flow and can never be upgraded by this DTO.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalAccessV1 {
    Desktop,
    Android,
}

impl LocalAccessV1 {
    const fn session_access(self) -> SessionAccess {
        match self {
            Self::Desktop => SessionAccess::Desktop,
            Self::Android => SessionAccess::Android,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BranchLocalMeshEnrollmentV1 {
    pub enrollment_id: String,
    pub status: String,
    pub node_id: String,
    pub hub_name: String,
    pub key_id: String,
    pub device_public_key: String,
    pub interface_address: String,
    pub mesh_subnet: String,
    pub peer_public_key: String,
    pub endpoint: String,
    pub allowed_ips: Vec<String>,
    pub persistent_keepalive_seconds: u16,
    pub hub_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BranchLocalLoginResultV1 {
    pub schema_version: u16,
    pub session_id: String,
    pub access_token: String,
    pub user_id: String,
    pub full_name: String,
    pub role: String,
    pub branch_id: String,
    pub assigned_branch_ids: Vec<String>,
    pub permissions: Vec<String>,
    pub enabled_modules: Vec<String>,
    pub node_id: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub authentication_level: String,
    pub branch_local: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mesh_enrollment: Option<BranchLocalMeshEnrollmentV1>,
}

/// Server-loaded credential record. It is not serializable and must never leave the host.
#[derive(Clone)]
pub struct LocalCredentialRecord {
    pub user_id: String,
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub password_hash: String,
    pub branch_id: String,
    pub node_id: String,
    pub user_active: bool,
    pub node_approved: bool,
    pub allow_desktop: bool,
    pub allow_android: bool,
    pub principal: AuthenticatedPrincipal,
}

#[derive(Clone)]
pub struct IssuedLocalSession {
    pub session: SessionContext,
    pub access_token: String,
}

pub trait LocalPasswordVerifier {
    /// Verify an Argon2 PHC string using a constant-time library. `None` requires a dummy Argon2
    /// verification so unknown usernames and wrong passwords have comparable cost. Implementations
    /// must not log either argument.
    fn verify_or_dummy(&self, password: &str, password_hash: Option<&str>) -> bool;
}

pub trait BranchLocalAuthenticationStore {
    /// The implementation must use one fixed, parameterized query matching node + user + branch,
    /// including `users.active = 1`, `devices.approved = 1`, and `user_branches.branch_id = ?`.
    fn find_local_credential(
        &mut self,
        node_id: &str,
        branch_id: &str,
        normalized_username: &str,
    ) -> Result<Option<LocalCredentialRecord>, CommandApiError>;

    /// Record a sanitized failed attempt for rate limiting/audit. Do not persist the password,
    /// password hash, bearer token, or raw request body.
    fn record_failed_attempt(
        &mut self,
        request_id: &str,
        node_id: &str,
        branch_id: &str,
        now: DateTime<Utc>,
    ) -> Result<(), CommandApiError>;

    /// Atomically insert the server-generated session, hashed token, node binding, branch-local
    /// marker, expiry, and successful-login audit record. The returned clear token is emitted once.
    fn issue_local_session(
        &mut self,
        credential: &LocalCredentialRecord,
        access: SessionAccess,
        now: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<IssuedLocalSession, CommandApiError>;
}

pub fn authenticate_branch_local<S, V>(
    request: &BranchLocalLoginV1,
    store: &mut S,
    verifier: &V,
    now: DateTime<Utc>,
    requested_ttl: Duration,
) -> Result<BranchLocalLoginResultV1, CommandApiError>
where
    S: BranchLocalAuthenticationStore,
    V: LocalPasswordVerifier,
{
    validate_login(request, requested_ttl)?;
    let username = request.username.trim().to_lowercase();
    let credential =
        store.find_local_credential(&request.node_id, &request.branch_id, &username)?;
    let password_valid = verifier.verify_or_dummy(
        &request.password,
        credential
            .as_ref()
            .map(|record| record.password_hash.as_str()),
    );

    let valid = credential.as_ref().is_some_and(|record| {
        record.user_active
            && record.node_approved
            && record.node_id == request.node_id
            && record.branch_id == request.branch_id
            && record.username.to_lowercase() == username
            && record.principal.user_id == record.user_id
            && record
                .principal
                .assigned_branches
                .contains(&request.branch_id)
            && record.principal.licence_valid
            && match request.requested_access {
                LocalAccessV1::Desktop => record.allow_desktop,
                LocalAccessV1::Android => record.allow_android,
            }
            && password_valid
    });

    if !valid {
        store.record_failed_attempt(
            &request.request_id,
            &request.node_id,
            &request.branch_id,
            now,
        )?;
        return Err(CommandApiError::AuthenticationFailed);
    }

    let Some(credential) = credential else {
        return Err(CommandApiError::AuthenticationFailed);
    };
    let access = request.requested_access.session_access();
    let expires_at = now + requested_ttl;
    let issued = store.issue_local_session(&credential, access, now, expires_at)?;
    validate_issued_session(&issued, &credential, access, now, expires_at)?;

    let assigned_branch_ids = issued
        .session
        .principal
        .assigned_branches
        .iter()
        .cloned()
        .collect();
    let permissions = super::authorization::effective_permission_keys(
        &issued.session.principal,
        &request.branch_id,
    );
    let enabled_modules = issued
        .session
        .principal
        .enabled_modules
        .iter()
        .cloned()
        .collect();

    Ok(BranchLocalLoginResultV1 {
        schema_version: API_SCHEMA_V1,
        session_id: issued.session.session_id,
        access_token: issued.access_token,
        user_id: issued.session.principal.user_id,
        full_name: credential.full_name,
        role: credential.role,
        branch_id: request.branch_id.clone(),
        assigned_branch_ids,
        permissions,
        enabled_modules,
        node_id: issued.session.node_id,
        issued_at: issued.session.issued_at,
        expires_at: issued.session.expires_at,
        authentication_level: "user".to_string(),
        branch_local: true,
        mesh_enrollment: None,
    })
}

fn validate_login(
    request: &BranchLocalLoginV1,
    requested_ttl: Duration,
) -> Result<(), CommandApiError> {
    if request.schema_version != API_SCHEMA_V1 || request.login_type != LOCAL_LOGIN_SCHEMA {
        return Err(CommandApiError::AuthenticationFailed);
    }
    for value in [&request.request_id, &request.node_id, &request.branch_id] {
        if !is_uuid_v4(value) {
            return Err(CommandApiError::AuthenticationFailed);
        }
    }
    if request.username.trim().is_empty()
        || request.username.len() > 128
        || request.username.chars().any(char::is_control)
        || request.password.is_empty()
        || request.password.len() > 1_024
        || requested_ttl <= Duration::zero()
        || requested_ttl > MAX_LOCAL_SESSION_TTL
    {
        return Err(CommandApiError::AuthenticationFailed);
    }
    Ok(())
}

fn validate_issued_session(
    issued: &IssuedLocalSession,
    credential: &LocalCredentialRecord,
    access: SessionAccess,
    issued_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> Result<(), CommandApiError> {
    let session = &issued.session;
    if !is_uuid_v4(&session.session_id)
        || session.node_id != credential.node_id
        || session.principal.user_id != credential.user_id
        || session.access != access
        || session.authentication_level != AuthenticationLevel::User
        || !session.branch_local
        || session.revoked
        || session.issued_at != issued_at
        || session.expires_at != expires_at
        || issued.access_token.len() < 32
        || issued.access_token.chars().any(char::is_whitespace)
    {
        return Err(CommandApiError::StorageUnavailable);
    }
    Ok(())
}

fn is_uuid_v4(value: &str) -> bool {
    Uuid::parse_str(value).is_ok_and(|parsed| parsed.get_version() == Some(Version::Random))
}
