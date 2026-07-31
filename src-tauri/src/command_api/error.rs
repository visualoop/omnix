use serde::Serialize;
use thiserror::Error;

/// Errors exposed by typed command and read-projection boundaries.
///
/// Variants deliberately avoid database messages, tokens, and resource identifiers so a
/// transport adapter can serialize them without leaking sensitive implementation details.
#[derive(Debug, Error, Serialize, PartialEq, Eq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum CommandApiError {
    #[error("authentication is required")]
    AuthenticationRequired,
    #[error("authentication failed")]
    AuthenticationFailed,
    #[error("the authenticated session is invalid")]
    InvalidSession,
    #[error("the authenticated session has expired")]
    SessionExpired,
    #[error("the authenticated session has been revoked")]
    SessionRevoked,
    #[error("the request identity does not match the authenticated session")]
    IdentityMismatch,
    #[error("the request node does not match the authenticated session")]
    NodeMismatch,
    #[error("the session authentication strength is insufficient")]
    AuthenticationLevelInsufficient,
    #[error("the authenticated principal cannot access this branch")]
    BranchAccessDenied,
    #[error("all-branch context is read-only")]
    AllBranchesMutationDenied,
    #[error("this session is read-only")]
    MutationNotAllowed,
    #[error("the authenticated principal does not have a required role")]
    RoleAccessDenied,
    #[error("the authenticated principal does not have the required permission")]
    PermissionDenied,
    #[error("the requested module is not enabled for this principal")]
    ModuleAccessDenied,
    #[error("a valid licence is required for this operation")]
    LicenceRequired,
    #[error("the command envelope is invalid: {reason}")]
    InvalidEnvelope { reason: String },
    #[error("the read request is invalid: {reason}")]
    InvalidReadRequest { reason: String },
    #[error("the command is too old to execute")]
    StaleCommand,
    #[error("the command id was already used with different content")]
    IdempotencyConflict,
    #[error("the command is already being processed")]
    CommandInProgress,
    #[error("the expected revision does not match the current revision")]
    RevisionConflict,
    #[error("the requested resource was not found")]
    NotFound,
    #[error("the data store is temporarily unavailable")]
    StorageUnavailable,
    #[error("the projection returned an invalid page")]
    InvalidProjectionResult,
}

impl CommandApiError {
    /// Transport-neutral status code recommendation for a future HTTP adapter.
    pub const fn http_status(&self) -> u16 {
        match self {
            Self::AuthenticationRequired
            | Self::AuthenticationFailed
            | Self::InvalidSession
            | Self::SessionExpired
            | Self::SessionRevoked => 401,
            Self::IdentityMismatch
            | Self::NodeMismatch
            | Self::AuthenticationLevelInsufficient
            | Self::BranchAccessDenied
            | Self::AllBranchesMutationDenied
            | Self::MutationNotAllowed
            | Self::RoleAccessDenied
            | Self::PermissionDenied
            | Self::ModuleAccessDenied
            | Self::LicenceRequired => 403,
            Self::NotFound => 404,
            Self::IdempotencyConflict | Self::CommandInProgress | Self::RevisionConflict => 409,
            Self::InvalidEnvelope { .. } | Self::InvalidReadRequest { .. } | Self::StaleCommand => {
                422
            }
            Self::InvalidProjectionResult => 500,
            Self::StorageUnavailable => 503,
        }
    }
}
