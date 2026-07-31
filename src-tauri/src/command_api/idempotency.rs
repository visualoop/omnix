use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::authorization::AuthenticationLevel;
use super::contracts::{CommandEnvelope, API_SCHEMA_V1};
use super::error::CommandApiError;

const FINGERPRINT_DOMAIN: &[u8] = b"omnix-command-envelope-v1\0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(transparent)]
pub struct CommandFingerprint(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommandReceipt<R> {
    pub schema_version: u16,
    pub command_id: String,
    pub committed_at: DateTime<Utc>,
    pub resulting_revision: u64,
    pub response: R,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "disposition",
    content = "receipt",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum IdempotencyOutcome<R> {
    Applied(CommandReceipt<R>),
    Replayed(CommandReceipt<R>),
}

impl<R> IdempotencyOutcome<R> {
    pub fn receipt(&self) -> &CommandReceipt<R> {
        match self {
            Self::Applied(receipt) | Self::Replayed(receipt) => receipt,
        }
    }
}

/// Sanitized audit event that must be written in the same transaction as a mutation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEventDraft {
    pub action: &'static str,
    pub permission: &'static str,
    pub entity_type: &'static str,
    pub entity_id: String,
}

/// Durable replication/event record that must be written before the business transaction commits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutboxEventDraft {
    pub event_type: &'static str,
    pub aggregate_type: &'static str,
    pub aggregate_id: String,
    pub schema_version: u16,
}

/// Server-created facts passed to the persistence leaf. No value in this structure is accepted
/// from the request body except the already validated aggregate identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AtomicCommitContext {
    pub fingerprint: CommandFingerprint,
    pub session_id: String,
    pub authentication_level: AuthenticationLevel,
    pub permission: &'static str,
    pub module_id: &'static str,
    pub audit: AuditEventDraft,
    pub outbox: OutboxEventDraft,
}

impl AtomicCommitContext {
    pub fn new(
        fingerprint: CommandFingerprint,
        session_id: &str,
        authentication_level: AuthenticationLevel,
        permission: &'static str,
        module_id: &'static str,
        audit: AuditEventDraft,
        outbox: OutboxEventDraft,
    ) -> Self {
        Self {
            fingerprint,
            session_id: session_id.to_string(),
            authentication_level,
            permission,
            module_id,
            audit,
            outbox,
        }
    }
}

/// Persistence boundary for a command mutation and its idempotency ledger entry.
///
/// Implementations MUST use one durable SQLite transaction to:
/// 1. claim `(command_id, user_id, node_id, branch_id)` under a unique command-id constraint,
/// 2. reject a claimed key whose fingerprint differs,
/// 3. re-load/lock the branch-scoped aggregate and validate `expected_revision`,
/// 4. perform the business mutation with a mandatory branch predicate,
/// 5. append the sanitized audit event and branch-scoped outbox event, and
/// 6. store the complete typed receipt and resulting revision before one commit.
///
/// The repository MUST compare the envelope identity to the server-created commit context and
/// session record; it must not trust identity, role, module, or authentication claims from JSON.
/// Business state, audit, outbox, and completed receipt must either all commit or all roll back.
/// A matching completed command returns `Replayed` without running the mutation. An active
/// matching claim returns `CommandInProgress`; a different fingerprint returns
/// `IdempotencyConflict`. Authorization and payload validation happen before this boundary.
/// Failed transactions must not leave a completed receipt or a permanently active claim.
pub trait IdempotentMutation<P, R> {
    fn execute_once(
        &mut self,
        envelope: &CommandEnvelope<P>,
        context: &AtomicCommitContext,
    ) -> Result<IdempotencyOutcome<R>, CommandApiError>;
}

pub fn receipt_v1<R>(
    command_id: String,
    committed_at: DateTime<Utc>,
    resulting_revision: u64,
    response: R,
) -> CommandReceipt<R> {
    CommandReceipt {
        schema_version: API_SCHEMA_V1,
        command_id,
        committed_at,
        resulting_revision,
        response,
    }
}

/// Hash the full envelope using domain-separated, recursively key-sorted JSON.
///
/// The server computes this after DTO deserialization, so object/map insertion order cannot
/// change a command's identity. Arrays retain their order and every envelope field participates.
pub fn fingerprint_command<T: Serialize>(
    envelope: &CommandEnvelope<T>,
) -> Result<CommandFingerprint, CommandApiError> {
    let value = serde_json::to_value(envelope).map_err(fingerprint_error)?;
    let mut bytes = Vec::new();
    write_canonical_json(&value, &mut bytes)?;

    let mut digest = Sha256::new();
    digest.update(FINGERPRINT_DOMAIN);
    digest.update(bytes);
    Ok(CommandFingerprint(hex::encode(digest.finalize())))
}

fn write_canonical_json(value: &Value, output: &mut Vec<u8>) -> Result<(), CommandApiError> {
    match value {
        Value::Null => output.extend_from_slice(b"null"),
        Value::Bool(value) => output.extend_from_slice(if *value { b"true" } else { b"false" }),
        Value::Number(value) => output.extend_from_slice(value.to_string().as_bytes()),
        Value::String(value) => serde_json::to_writer(output, value).map_err(fingerprint_error)?,
        Value::Array(values) => {
            output.push(b'[');
            for (index, value) in values.iter().enumerate() {
                if index != 0 {
                    output.push(b',');
                }
                write_canonical_json(value, output)?;
            }
            output.push(b']');
        }
        Value::Object(values) => {
            output.push(b'{');
            let mut keys: Vec<&String> = values.keys().collect();
            keys.sort_unstable();
            for (index, key) in keys.into_iter().enumerate() {
                if index != 0 {
                    output.push(b',');
                }
                serde_json::to_writer(&mut *output, key).map_err(fingerprint_error)?;
                output.push(b':');
                write_canonical_json(&values[key], output)?;
            }
            output.push(b'}');
        }
    }
    Ok(())
}

fn fingerprint_error(_: serde_json::Error) -> CommandApiError {
    CommandApiError::InvalidEnvelope {
        reason: "payload cannot be serialized deterministically".to_string(),
    }
}
