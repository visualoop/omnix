use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::{Uuid, Version};

use super::error::CommandApiError;

pub const API_SCHEMA_V1: u16 = 1;
pub const DEFAULT_READ_LIMIT: u16 = 50;
pub const MAX_READ_LIMIT: u16 = 100;
pub const MAX_CURSOR_LENGTH: usize = 512;
pub const MAX_SEARCH_LENGTH: usize = 128;
pub const MAX_PROJECTION_PAGE_BYTES: usize = 256 * 1024;
pub const MAX_COMMAND_AGE: Duration = Duration::days(30);
pub const MAX_CLOCK_SKEW: Duration = Duration::minutes(5);
pub const ALL_BRANCHES_CONTEXT: &str = "all-branches";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommandEnvelope<T> {
    /// Transport schema version. Command names are independently versioned as a defense against
    /// accidentally decoding a v2 payload under a v1 route.
    pub schema_version: u16,
    pub command_id: String,
    pub command_type: String,
    pub node_id: String,
    pub user_id: String,
    pub branch_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_revision: Option<u64>,
    pub issued_at: DateTime<Utc>,
    pub payload: T,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum BranchScope {
    Branch { branch_id: String },
    AllAssigned,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PageRequest {
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedPage {
    pub cursor: Option<String>,
    pub limit: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadProjectionRequest<F> {
    pub schema_version: u16,
    pub request_id: String,
    pub projection: String,
    pub node_id: String,
    pub user_id: String,
    pub branch_scope: BranchScope,
    #[serde(default)]
    pub page: PageRequest,
    pub filter: F,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectionPage<T> {
    pub items: Vec<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadProjectionResponse<T> {
    pub schema_version: u16,
    pub request_id: String,
    pub projection: String,
    pub branch_scope: BranchScope,
    pub generated_at: DateTime<Utc>,
    pub limit: u16,
    pub items: Vec<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

pub fn validate_command_envelope<T>(
    envelope: &CommandEnvelope<T>,
    expected_type: &str,
    now: DateTime<Utc>,
) -> Result<(), CommandApiError> {
    if envelope.schema_version != API_SCHEMA_V1 {
        return Err(envelope_error("schemaVersion is not supported"));
    }
    validate_uuid_v4(&envelope.command_id, "commandId").map_err(envelope_error)?;
    validate_uuid_v4(&envelope.node_id, "nodeId").map_err(envelope_error)?;
    validate_uuid_v4(&envelope.user_id, "userId").map_err(envelope_error)?;

    if envelope.branch_id == ALL_BRANCHES_CONTEXT {
        return Err(CommandApiError::AllBranchesMutationDenied);
    }
    validate_uuid_v4(&envelope.branch_id, "branchId").map_err(envelope_error)?;

    if envelope.command_type.is_empty() || envelope.command_type.len() > 128 {
        return Err(envelope_error("commandType has an invalid length"));
    }
    if envelope.command_type != expected_type {
        return Err(envelope_error("commandType is not allowlisted"));
    }
    if envelope.issued_at > now + MAX_CLOCK_SKEW {
        return Err(envelope_error("issuedAt is too far in the future"));
    }
    if envelope.issued_at < now - MAX_COMMAND_AGE {
        return Err(CommandApiError::StaleCommand);
    }
    Ok(())
}

pub fn validate_read_request<F>(
    request: &ReadProjectionRequest<F>,
    expected_projection: &str,
) -> Result<ValidatedPage, CommandApiError> {
    if request.schema_version != API_SCHEMA_V1 {
        return Err(read_error("schemaVersion is not supported"));
    }
    validate_uuid_v4(&request.request_id, "requestId").map_err(read_error)?;
    validate_uuid_v4(&request.node_id, "nodeId").map_err(read_error)?;
    validate_uuid_v4(&request.user_id, "userId").map_err(read_error)?;

    if request.projection.is_empty() || request.projection.len() > 128 {
        return Err(read_error("projection has an invalid length"));
    }
    if request.projection != expected_projection {
        return Err(read_error("projection is not allowlisted"));
    }
    match &request.branch_scope {
        BranchScope::Branch { branch_id } => {
            validate_uuid_v4(branch_id, "branchId").map_err(read_error)?;
        }
        BranchScope::AllAssigned => {}
    }

    let limit = request.page.limit.unwrap_or(DEFAULT_READ_LIMIT);
    if limit == 0 || limit > MAX_READ_LIMIT {
        return Err(read_error("limit must be between 1 and 100"));
    }
    if request
        .page
        .cursor
        .as_deref()
        .is_some_and(|cursor| !valid_cursor(cursor))
    {
        return Err(read_error("cursor has an invalid format or length"));
    }

    Ok(ValidatedPage {
        cursor: request.page.cursor.clone(),
        limit,
    })
}

pub fn validate_resource_id(id: &str, field: &str) -> Result<(), CommandApiError> {
    validate_uuid_v4(id, field).map_err(envelope_error)
}

pub fn validate_read_resource_id(id: &str, field: &str) -> Result<(), CommandApiError> {
    validate_uuid_v4(id, field).map_err(read_error)
}

pub fn validate_search(search: Option<&str>) -> Result<(), CommandApiError> {
    if search
        .is_some_and(|value| value.len() > MAX_SEARCH_LENGTH || value.chars().any(char::is_control))
    {
        return Err(read_error(
            "search exceeds 128 bytes or contains control characters",
        ));
    }
    Ok(())
}

pub fn validate_projection_page<T: Serialize>(
    page: &ProjectionPage<T>,
    requested_limit: u16,
) -> Result<(), CommandApiError> {
    if page.items.len() > usize::from(requested_limit)
        || page
            .next_cursor
            .as_deref()
            .is_some_and(|cursor| !valid_cursor(cursor))
    {
        return Err(CommandApiError::InvalidProjectionResult);
    }

    let encoded_size = serde_json::to_vec(page)
        .map_err(|_| CommandApiError::InvalidProjectionResult)?
        .len();
    if encoded_size > MAX_PROJECTION_PAGE_BYTES {
        return Err(CommandApiError::InvalidProjectionResult);
    }
    Ok(())
}

fn valid_cursor(cursor: &str) -> bool {
    !cursor.is_empty()
        && cursor.len() <= MAX_CURSOR_LENGTH
        && cursor.bytes().all(|byte| byte.is_ascii_graphic())
}

fn validate_uuid_v4(value: &str, field: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} must be a UUID v4"))?;
    if parsed.get_version() != Some(Version::Random) {
        return Err(format!("{field} must be a UUID v4"));
    }
    Ok(())
}

fn envelope_error(reason: impl Into<String>) -> CommandApiError {
    CommandApiError::InvalidEnvelope {
        reason: reason.into(),
    }
}

fn read_error(reason: impl Into<String>) -> CommandApiError {
    CommandApiError::InvalidReadRequest {
        reason: reason.into(),
    }
}
