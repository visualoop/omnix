use std::collections::BTreeSet;

use chrono::{DateTime, Utc};
use uuid::{Uuid, Version};

use super::contracts::{BranchScope, CommandEnvelope, ReadProjectionRequest};
use super::error::CommandApiError;

pub const MAX_READ_BRANCHES: usize = 100;

/// Server-resolved channel type. It is intentionally not deserializable from transport input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionAccess {
    Desktop,
    Android,
    BrowserReadOnly,
}

impl SessionAccess {
    const fn allows_mutation(self) -> bool {
        matches!(self, Self::Desktop | Self::Android)
    }
}

/// Authentication strength resolved by the server-side session store.
///
/// This value is deliberately not deserializable from command input. A paired device alone can
/// reach pairing/bootstrap endpoints, but business reads require a locally authenticated user and
/// sensitive mutations can require a fresh password/PIN challenge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum AuthenticationLevel {
    DevicePaired,
    User,
    Elevated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionEffect {
    Allow,
    Deny,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoleGrant {
    pub role_id: String,
    pub branch_id: Option<String>,
    pub module_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PermissionGrant {
    pub permission: String,
    pub effect: PermissionEffect,
    pub branch_id: Option<String>,
    pub module_id: Option<String>,
}

/// Effective authorization facts loaded server-side from the local database and licence state.
/// None of these fields may be copied from a command or read request body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthenticatedPrincipal {
    pub user_id: String,
    pub assigned_branches: BTreeSet<String>,
    pub enabled_modules: BTreeSet<String>,
    pub roles: Vec<RoleGrant>,
    pub permissions: Vec<PermissionGrant>,
    pub licence_valid: bool,
}

/// A short-lived, server-resolved session. This type has no Serde transport implementation on
/// purpose: adapters resolve it from an opaque credential before calling a typed handler.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionContext {
    pub session_id: String,
    pub node_id: String,
    pub access: SessionAccess,
    pub authentication_level: AuthenticationLevel,
    /// True only when this session was issued from branch-local credentials while the WAN was
    /// unavailable. It does not reduce any authorization check or expand branch scope.
    pub branch_local: bool,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked: bool,
    pub principal: AuthenticatedPrincipal,
}

#[derive(Debug, Clone, Copy)]
pub struct AuthorizationRequirement<'a> {
    pub allowed_roles: &'a [&'a str],
    pub permission: &'a str,
    pub module_id: &'a str,
    pub minimum_authentication: AuthenticationLevel,
}

#[derive(Debug, Clone, Copy)]
pub struct ReadAuthorizationRequirement<'a> {
    pub access: AuthorizationRequirement<'a>,
    pub allow_all_assigned: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorizedBranches(pub Vec<String>);

pub fn authorize_command<T>(
    session: &SessionContext,
    envelope: &CommandEnvelope<T>,
    requirement: AuthorizationRequirement<'_>,
    now: DateTime<Utc>,
) -> Result<(), CommandApiError> {
    validate_session(session, now)?;
    validate_request_identity(session, &envelope.user_id, &envelope.node_id)?;
    if !session.access.allows_mutation() {
        return Err(CommandApiError::MutationNotAllowed);
    }
    if session.authentication_level < requirement.minimum_authentication {
        return Err(CommandApiError::AuthenticationLevelInsufficient);
    }
    authorize_branch(&session.principal, &envelope.branch_id, requirement)
}

pub fn authorize_read<F>(
    session: &SessionContext,
    request: &ReadProjectionRequest<F>,
    requirement: ReadAuthorizationRequirement<'_>,
    now: DateTime<Utc>,
) -> Result<AuthorizedBranches, CommandApiError> {
    validate_session(session, now)?;
    validate_request_identity(session, &request.user_id, &request.node_id)?;
    if session.authentication_level < requirement.access.minimum_authentication {
        return Err(CommandApiError::AuthenticationLevelInsufficient);
    }

    match &request.branch_scope {
        BranchScope::Branch { branch_id } => {
            authorize_branch(&session.principal, branch_id, requirement.access)?;
            Ok(AuthorizedBranches(vec![branch_id.clone()]))
        }
        BranchScope::AllAssigned if !requirement.allow_all_assigned => {
            Err(CommandApiError::BranchAccessDenied)
        }
        BranchScope::AllAssigned => {
            if session.principal.assigned_branches.is_empty() {
                return Err(CommandApiError::BranchAccessDenied);
            }
            if session.principal.assigned_branches.len() > MAX_READ_BRANCHES {
                return Err(CommandApiError::InvalidReadRequest {
                    reason: "allAssigned exceeds the branch fan-out limit".to_string(),
                });
            }
            for branch_id in &session.principal.assigned_branches {
                authorize_branch(&session.principal, branch_id, requirement.access)?;
            }
            Ok(AuthorizedBranches(
                session
                    .principal
                    .assigned_branches
                    .iter()
                    .cloned()
                    .collect(),
            ))
        }
    }
}

fn validate_session(session: &SessionContext, now: DateTime<Utc>) -> Result<(), CommandApiError> {
    if session.revoked {
        return Err(CommandApiError::SessionRevoked);
    }
    if !is_uuid_v4(&session.session_id)
        || !is_uuid_v4(&session.node_id)
        || !is_uuid_v4(&session.principal.user_id)
        || session
            .principal
            .assigned_branches
            .iter()
            .any(|branch_id| !is_uuid_v4(branch_id))
        || session.expires_at <= session.issued_at
        || session.issued_at > now
    {
        return Err(CommandApiError::InvalidSession);
    }
    if session.expires_at <= now {
        return Err(CommandApiError::SessionExpired);
    }
    Ok(())
}

fn validate_request_identity(
    session: &SessionContext,
    user_id: &str,
    node_id: &str,
) -> Result<(), CommandApiError> {
    if session.principal.user_id != user_id {
        return Err(CommandApiError::IdentityMismatch);
    }
    if session.node_id != node_id {
        return Err(CommandApiError::NodeMismatch);
    }
    Ok(())
}

fn authorize_branch(
    principal: &AuthenticatedPrincipal,
    branch_id: &str,
    requirement: AuthorizationRequirement<'_>,
) -> Result<(), CommandApiError> {
    if !principal.assigned_branches.contains(branch_id) {
        return Err(CommandApiError::BranchAccessDenied);
    }
    if !principal.licence_valid {
        return Err(CommandApiError::LicenceRequired);
    }
    if !principal.enabled_modules.contains(requirement.module_id) {
        return Err(CommandApiError::ModuleAccessDenied);
    }

    let applicable_permissions: Vec<&PermissionGrant> = principal
        .permissions
        .iter()
        .filter(|grant| {
            grant.permission == requirement.permission
                && scope_matches(grant.branch_id.as_deref(), branch_id)
                && module_matches(grant.module_id.as_deref(), requirement.module_id)
        })
        .collect();

    if applicable_permissions
        .iter()
        .any(|grant| grant.effect == PermissionEffect::Deny)
        || !applicable_permissions
            .iter()
            .any(|grant| grant.effect == PermissionEffect::Allow)
    {
        return Err(CommandApiError::PermissionDenied);
    }

    if !principal.roles.iter().any(|grant| {
        requirement.allowed_roles.contains(&grant.role_id.as_str())
            && scope_matches(grant.branch_id.as_deref(), branch_id)
            && module_matches(grant.module_id.as_deref(), requirement.module_id)
    }) {
        return Err(CommandApiError::RoleAccessDenied);
    }
    Ok(())
}

fn scope_matches(grant_branch: Option<&str>, requested_branch: &str) -> bool {
    grant_branch.is_none_or(|branch| branch == requested_branch)
}

fn module_matches(grant_module: Option<&str>, requested_module: &str) -> bool {
    grant_module.is_none_or(|module| module == requested_module)
}

fn is_uuid_v4(value: &str) -> bool {
    Uuid::parse_str(value).is_ok_and(|parsed| parsed.get_version() == Some(Version::Random))
}

/// Permission keys suitable for client navigation at one assigned branch.
/// Denies win exactly as they do at command boundaries; the server still
/// authorizes every concrete typed request independently.
pub fn effective_permission_keys(
    principal: &AuthenticatedPrincipal,
    branch_id: &str,
) -> Vec<String> {
    let mut candidates = principal
        .permissions
        .iter()
        .filter(|grant| {
            scope_matches(grant.branch_id.as_deref(), branch_id)
                && grant
                    .module_id
                    .as_ref()
                    .is_none_or(|module| principal.enabled_modules.contains(module))
        })
        .map(|grant| grant.permission.clone())
        .collect::<BTreeSet<_>>();
    candidates.retain(|permission| {
        let applicable = principal.permissions.iter().filter(|grant| {
            grant.permission == *permission
                && scope_matches(grant.branch_id.as_deref(), branch_id)
                && grant
                    .module_id
                    .as_ref()
                    .is_none_or(|module| principal.enabled_modules.contains(module))
        });
        let grants = applicable.collect::<Vec<_>>();
        grants
            .iter()
            .any(|grant| grant.effect == PermissionEffect::Allow)
            && !grants
                .iter()
                .any(|grant| grant.effect == PermissionEffect::Deny)
    });
    candidates.into_iter().collect()
}
