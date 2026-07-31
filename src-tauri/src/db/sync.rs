//! Transactional SQLite queries for offline synchronization.
//!
//! This is an intentionally unregistered integration leaf. Domain services must
//! pass the same [`Transaction`] to their business mutation and the `*_in_tx`
//! functions below. Command handlers must never embed these SQL statements.
//! Cryptographic verification, canonical serialization, trusted time, UUID v4
//! generation, and audit emission remain service-layer responsibilities.

use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};

#[derive(Debug, thiserror::Error)]
pub enum SyncDbError {
    #[error("sync storage error: {0}")]
    Sql(#[from] sqlx::Error),
    #[error("branch epoch is missing")]
    MissingEpoch,
    #[error("epoch fence rejected: current hq={current_hq}, branch={current_branch}")]
    FenceRejected {
        current_hq: i64,
        current_branch: i64,
    },
    #[error("event identity does not match the persisted event")]
    EventIdentityMismatch,
    #[error("outbox lease is no longer owned by this worker")]
    LeaseLost,
    #[error("terminal sync state cannot be changed")]
    TerminalState,
    #[error("receipt replay does not match the persisted receipt")]
    ReceiptMismatch,
    #[error("invalid sync input: {0}")]
    InvalidInput(&'static str),
}

pub type SyncDbResult<T> = Result<T, SyncDbError>;

#[derive(Clone, Debug)]
pub struct CaptureEvent<'a> {
    pub event_id: &'a str,
    pub source_node_id: &'a str,
    pub destination_node_id: Option<&'a str>,
    pub branch_id: &'a str,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub protocol_version: i64,
    pub entity_type: &'a str,
    pub entity_id: &'a str,
    pub operation: &'a str,
    pub payload_media_type: &'a str,
    pub payload_schema_version: i64,
    pub payload: &'a [u8],
    pub payload_sha256: &'a [u8],
    pub signing_key_id: &'a str,
    pub signature_algorithm: &'a str,
    pub signature: &'a [u8],
    pub emitted_at: &'a str,
    pub expires_at: Option<&'a str>,
    pub now: &'a str,
}

#[derive(Clone, Debug, FromRow)]
pub struct OutboxEvent {
    pub event_id: String,
    pub source_node_id: String,
    pub destination_node_id: Option<String>,
    pub branch_id: String,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub protocol_version: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub payload_media_type: String,
    pub payload_schema_version: i64,
    pub payload: Vec<u8>,
    pub payload_sha256: Vec<u8>,
    pub signing_key_id: String,
    pub signature_algorithm: String,
    pub signature: Vec<u8>,
    pub emitted_at: String,
    pub expires_at: Option<String>,
}

#[derive(Clone, Debug)]
pub struct LeaseRequest<'a> {
    pub owner_node_id: &'a str,
    pub destination_node_id: Option<&'a str>,
    pub now: &'a str,
    pub lease_expires_at: &'a str,
    pub limit: i64,
}

#[derive(Clone, Debug)]
pub struct LeasedOutboxEvent {
    pub event: OutboxEvent,
    pub lease_generation: i64,
    pub attempt: i64,
}

#[derive(Clone, Debug)]
pub struct LeaseToken<'a> {
    pub event_id: &'a str,
    pub owner_node_id: &'a str,
    pub generation: i64,
}

#[derive(Clone, Debug)]
pub struct OutboxReceipt<'a> {
    pub lease: LeaseToken<'a>,
    pub receiver_node_id: &'a str,
    pub receipt_hq_epoch: i64,
    pub receipt_branch_epoch: i64,
    pub source_sequence: i64,
    pub contiguous_sequence: i64,
    pub outcome: &'a str,
    pub receipt_sha256: &'a [u8],
    pub recorded_at: &'a str,
}

#[derive(Clone, Debug)]
pub struct RetryOutbox<'a> {
    pub lease: LeaseToken<'a>,
    pub error_class: &'a str,
    pub diagnostic: &'a str,
    pub retry_at: &'a str,
    pub retryable: bool,
    pub max_attempts: i64,
    pub dead_letter_id: &'a str,
}

#[derive(Clone, Debug)]
pub struct InboxIdentity<'a> {
    pub event_id: &'a str,
    pub source_node_id: &'a str,
    pub receiver_node_id: &'a str,
    pub branch_id: &'a str,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub payload_sha256: &'a [u8],
    pub received_at: &'a str,
}

#[derive(Clone, Debug, FromRow, PartialEq, Eq)]
pub struct StoredReceipt {
    pub event_id: String,
    pub receiver_node_id: String,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub contiguous_sequence: i64,
    pub outcome: String,
    pub conflict_class: Option<String>,
    pub receipt_sha256: Vec<u8>,
    pub recorded_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InboxStart {
    Apply,
    Duplicate(StoredReceipt),
}

#[derive(Clone, Debug)]
pub struct CompleteInbox<'a> {
    pub event_id: &'a str,
    pub receiver_node_id: &'a str,
    pub source_node_id: &'a str,
    pub branch_id: &'a str,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub application_result: &'a str,
    pub receipt_sha256: &'a [u8],
    pub validated_at: &'a str,
    pub applied_at: &'a str,
    pub recorded_at: &'a str,
}

#[derive(Clone, Debug)]
pub struct SnapshotCursor<'a> {
    pub source_node_id: &'a str,
    pub contiguous_sequence: i64,
}

#[derive(Clone, Debug)]
pub struct SnapshotMetadata<'a> {
    pub id: &'a str,
    pub branch_id: &'a str,
    pub created_by_node_id: &'a str,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub schema_version: i64,
    pub byte_length: i64,
    pub chunk_count: i64,
    pub sha256: &'a [u8],
    pub signature_key_id: &'a str,
    pub signature: &'a [u8],
    pub storage_ref: &'a str,
    pub created_at: &'a str,
    pub cursors: &'a [SnapshotCursor<'a>],
}

#[derive(Clone, Debug)]
pub struct RecoveryMetadata<'a> {
    pub id: &'a str,
    pub snapshot_id: &'a str,
    pub requested_by_node_id: &'a str,
    pub target_branch_id: &'a str,
    pub target_hq_epoch: i64,
    pub target_branch_epoch: i64,
    pub mode: &'a str,
    pub pre_restore_backup_ref: Option<&'a str>,
    pub requested_at: &'a str,
}

#[derive(Debug, FromRow)]
struct EpochRow {
    hq_epoch: i64,
    branch_epoch: i64,
}

#[derive(Debug, FromRow)]
struct CandidateRow {
    event_id: String,
}

#[derive(Debug, FromRow)]
struct LeaseGenerationRow {
    generation: i64,
}

#[derive(Debug, FromRow)]
struct AttemptStateRow {
    attempts: i64,
    state: String,
}

#[derive(Debug, FromRow)]
struct InboxRow {
    source_node_id: String,
    receiver_node_id: String,
    branch_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
    source_sequence: i64,
    payload_sha256: Vec<u8>,
    state: String,
}

#[derive(Debug, FromRow)]
struct CursorRow {
    contiguous_sequence: i64,
}

/// Verifies exact HQ and branch epochs. Higher epochs are rejected just like
/// lower epochs; reconciliation must occur through a signed control event.
pub async fn require_current_fence_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    branch_id: &str,
    hq_epoch: i64,
    branch_epoch: i64,
) -> SyncDbResult<()> {
    let current = sqlx::query_as::<_, EpochRow>(
        "SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1",
    )
    .bind(branch_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(SyncDbError::MissingEpoch)?;

    if current.hq_epoch != hq_epoch || current.branch_epoch != branch_epoch {
        return Err(SyncDbError::FenceRejected {
            current_hq: current.hq_epoch,
            current_branch: current.branch_epoch,
        });
    }
    Ok(())
}

/// Reads the sequence that must be embedded in the next signed envelope. The
/// caller must keep this transaction open until `capture_event_in_tx` commits.
pub async fn peek_next_sequence_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    source_node_id: &str,
    branch_id: &str,
    hq_epoch: i64,
    branch_epoch: i64,
    now: &str,
) -> SyncDbResult<i64> {
    require_current_fence_in_tx(tx, branch_id, hq_epoch, branch_epoch).await?;
    sqlx::query(
        "INSERT INTO sync_sequences (
             source_node_id, branch_id, hq_epoch, branch_epoch, next_sequence, updated_at
         ) VALUES (?1, ?2, ?3, ?4, 1, ?5)
         ON CONFLICT (source_node_id, branch_id, hq_epoch, branch_epoch) DO NOTHING",
    )
    .bind(source_node_id)
    .bind(branch_id)
    .bind(hq_epoch)
    .bind(branch_epoch)
    .bind(now)
    .execute(&mut **tx)
    .await?;

    let (next_sequence,): (i64,) = sqlx::query_as(
        "SELECT next_sequence FROM sync_sequences
         WHERE source_node_id = ?1 AND branch_id = ?2
           AND hq_epoch = ?3 AND branch_epoch = ?4",
    )
    .bind(source_node_id)
    .bind(branch_id)
    .bind(hq_epoch)
    .bind(branch_epoch)
    .fetch_one(&mut **tx)
    .await?;
    Ok(next_sequence)
}

/// Atomically consumes the expected source sequence and inserts the signed
/// outbox event. Invoke this after the domain mutation but before committing the
/// same transaction; any error rolls both changes back.
pub async fn capture_event_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    event: &CaptureEvent<'_>,
) -> SyncDbResult<()> {
    require_current_fence_in_tx(tx, event.branch_id, event.hq_epoch, event.branch_epoch).await?;
    if event.source_sequence < 1 || event.payload_sha256.len() != 32 {
        return Err(SyncDbError::InvalidInput("event sequence or digest"));
    }

    let consumed = sqlx::query(
        "UPDATE sync_sequences
         SET next_sequence = next_sequence + 1, updated_at = ?6
         WHERE source_node_id = ?1 AND branch_id = ?2
           AND hq_epoch = ?3 AND branch_epoch = ?4 AND next_sequence = ?5",
    )
    .bind(event.source_node_id)
    .bind(event.branch_id)
    .bind(event.hq_epoch)
    .bind(event.branch_epoch)
    .bind(event.source_sequence)
    .bind(event.now)
    .execute(&mut **tx)
    .await?;
    if consumed.rows_affected() != 1 {
        return Err(SyncDbError::EventIdentityMismatch);
    }

    sqlx::query(
        "INSERT INTO sync_outbox (
             event_id, source_node_id, destination_node_id, branch_id,
             hq_epoch, branch_epoch, source_sequence, protocol_version,
             entity_type, entity_id, operation, payload_media_type,
             payload_schema_version, payload, payload_sha256, signing_key_id,
             signature_algorithm, signature, state, attempts, not_before,
             emitted_at, expires_at, created_at, updated_at
         ) VALUES (
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
             ?14, ?15, ?16, ?17, ?18, 'pending', 0, ?19, ?20, ?21, ?19, ?19
         )",
    )
    .bind(event.event_id)
    .bind(event.source_node_id)
    .bind(event.destination_node_id)
    .bind(event.branch_id)
    .bind(event.hq_epoch)
    .bind(event.branch_epoch)
    .bind(event.source_sequence)
    .bind(event.protocol_version)
    .bind(event.entity_type)
    .bind(event.entity_id)
    .bind(event.operation)
    .bind(event.payload_media_type)
    .bind(event.payload_schema_version)
    .bind(event.payload)
    .bind(event.payload_sha256)
    .bind(event.signing_key_id)
    .bind(event.signature_algorithm)
    .bind(event.signature)
    .bind(event.now)
    .bind(event.emitted_at)
    .bind(event.expires_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Advances an epoch only from the exact expected fence. The coordinator must
/// capture the signed control event in this same transaction.
pub async fn advance_epoch_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    branch_id: &str,
    expected_hq_epoch: i64,
    expected_branch_epoch: i64,
    next_hq_epoch: i64,
    next_branch_epoch: i64,
    changed_by_node_id: &str,
    control_event_id: &str,
    reason: &str,
    changed_at: &str,
) -> SyncDbResult<()> {
    let max_hq_epoch = expected_hq_epoch
        .checked_add(1)
        .ok_or(SyncDbError::InvalidInput("HQ epoch overflow"))?;
    let max_branch_epoch = expected_branch_epoch
        .checked_add(1)
        .ok_or(SyncDbError::InvalidInput("branch epoch overflow"))?;
    if next_hq_epoch < expected_hq_epoch
        || next_hq_epoch > max_hq_epoch
        || next_branch_epoch < expected_branch_epoch
        || next_branch_epoch > max_branch_epoch
        || (next_hq_epoch == expected_hq_epoch && next_branch_epoch == expected_branch_epoch)
    {
        return Err(SyncDbError::InvalidInput("epoch must advance"));
    }
    let result = sqlx::query(
        "UPDATE sync_epochs
         SET hq_epoch = ?4, branch_epoch = ?5, changed_by_node_id = ?6,
             control_event_id = ?7, reason = ?8, changed_at = ?9
         WHERE branch_id = ?1 AND hq_epoch = ?2 AND branch_epoch = ?3",
    )
    .bind(branch_id)
    .bind(expected_hq_epoch)
    .bind(expected_branch_epoch)
    .bind(next_hq_epoch)
    .bind(next_branch_epoch)
    .bind(changed_by_node_id)
    .bind(control_event_id)
    .bind(reason)
    .bind(changed_at)
    .execute(&mut **tx)
    .await?;
    if result.rows_affected() != 1 {
        let current = sqlx::query_as::<_, EpochRow>(
            "SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1",
        )
        .bind(branch_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(SyncDbError::MissingEpoch)?;
        return Err(SyncDbError::FenceRejected {
            current_hq: current.hq_epoch,
            current_branch: current.branch_epoch,
        });
    }
    Ok(())
}

/// Claims due events and increments durable per-event lease generations. Expired
/// leases and receipt deadlines are recoverable after a process crash.
pub async fn lease_outbox(
    pool: &SqlitePool,
    request: &LeaseRequest<'_>,
) -> SyncDbResult<Vec<LeasedOutboxEvent>> {
    if request.limit < 1 || request.lease_expires_at <= request.now {
        return Err(SyncDbError::InvalidInput("lease bounds"));
    }
    let mut tx = pool.begin().await?;
    let candidates = sqlx::query_as::<_, CandidateRow>(
        "SELECT o.event_id
         FROM sync_outbox o
         LEFT JOIN sync_outbox_leases l ON l.outbox_event_id = o.event_id
         WHERE (o.destination_node_id = ?1 OR (?1 IS NULL AND o.destination_node_id IS NULL))
           AND (
             (o.state = 'pending' AND o.not_before <= ?2)
             OR (o.state = 'leased' AND (l.expires_at <= ?2 OR l.released_at IS NOT NULL))
             OR (o.state = 'awaiting_receipt' AND o.receipt_deadline <= ?2)
           )
           AND (o.expires_at IS NULL OR o.expires_at > ?2)
         ORDER BY o.source_sequence
         LIMIT ?3",
    )
    .bind(request.destination_node_id)
    .bind(request.now)
    .bind(request.limit)
    .fetch_all(&mut *tx)
    .await?;

    let mut leased = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        let generation = sqlx::query_as::<_, LeaseGenerationRow>(
            "INSERT INTO sync_outbox_leases (
                 outbox_event_id, lease_owner_node_id, generation,
                 acquired_at, expires_at, released_at
             ) VALUES (?1, ?2, 1, ?3, ?4, NULL)
             ON CONFLICT (outbox_event_id) DO UPDATE SET
                 lease_owner_node_id = excluded.lease_owner_node_id,
                 generation = sync_outbox_leases.generation + 1,
                 acquired_at = excluded.acquired_at,
                 expires_at = excluded.expires_at,
                 released_at = NULL
             WHERE sync_outbox_leases.expires_at <= excluded.acquired_at
                OR sync_outbox_leases.released_at IS NOT NULL
             RETURNING generation",
        )
        .bind(&candidate.event_id)
        .bind(request.owner_node_id)
        .bind(request.now)
        .bind(request.lease_expires_at)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(generation) = generation else {
            continue;
        };

        let attempt = sqlx::query_as::<_, AttemptStateRow>(
            "UPDATE sync_outbox
             SET state = 'leased', attempts = attempts + 1, updated_at = ?2,
                 sent_at = NULL, receipt_deadline = NULL
             WHERE event_id = ?1 AND state IN ('pending', 'leased', 'awaiting_receipt')
             RETURNING attempts, state",
        )
        .bind(&candidate.event_id)
        .bind(request.now)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(attempt) = attempt else {
            continue;
        };

        let event = sqlx::query_as::<_, OutboxEvent>(
            "SELECT event_id, source_node_id, destination_node_id, branch_id,
                    hq_epoch, branch_epoch, source_sequence, protocol_version,
                    entity_type, entity_id, operation, payload_media_type,
                    payload_schema_version, payload, payload_sha256,
                    signing_key_id, signature_algorithm, signature,
                    emitted_at, expires_at
             FROM sync_outbox WHERE event_id = ?1",
        )
        .bind(&candidate.event_id)
        .fetch_one(&mut *tx)
        .await?;
        leased.push(LeasedOutboxEvent {
            event,
            lease_generation: generation.generation,
            attempt: attempt.attempts,
        });
    }
    tx.commit().await?;
    Ok(leased)
}

pub async fn mark_outbox_sent(
    pool: &SqlitePool,
    lease: &LeaseToken<'_>,
    sent_at: &str,
    receipt_deadline: &str,
) -> SyncDbResult<()> {
    if receipt_deadline <= sent_at {
        return Err(SyncDbError::InvalidInput("receipt deadline"));
    }
    let mut tx = pool.begin().await?;
    require_live_lease_in_tx(&mut tx, lease, sent_at).await?;
    let result = sqlx::query(
        "UPDATE sync_outbox
         SET state = 'awaiting_receipt', sent_at = ?2, receipt_deadline = ?3, updated_at = ?2
         WHERE event_id = ?1 AND state = 'leased'",
    )
    .bind(lease.event_id)
    .bind(sent_at)
    .bind(receipt_deadline)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() != 1 {
        return Err(SyncDbError::TerminalState);
    }
    tx.commit().await?;
    Ok(())
}

/// Releases an acquired-but-unsent lease back to pending without consuming an
/// additional attempt. Awaiting-receipt events must use the explicit retry or
/// dead-letter transition so a possibly delivered event is not silently reset.
pub async fn release_outbox_lease(
    pool: &SqlitePool,
    lease: &LeaseToken<'_>,
    retry_at: &str,
) -> SyncDbResult<()> {
    let mut tx = pool.begin().await?;
    require_owned_lease_in_tx(&mut tx, lease).await?;
    let result = sqlx::query(
        "UPDATE sync_outbox
         SET state = 'pending', not_before = ?2, updated_at = ?2,
             sent_at = NULL, receipt_deadline = NULL
         WHERE event_id = ?1 AND state = 'leased'",
    )
    .bind(lease.event_id)
    .bind(retry_at)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() != 1 {
        return Err(SyncDbError::TerminalState);
    }
    release_lease_in_tx(&mut tx, lease, retry_at).await?;
    tx.commit().await?;
    Ok(())
}

/// Acknowledges only the live lease generation and only a matching receipt.
pub async fn acknowledge_outbox(
    pool: &SqlitePool,
    receipt: &OutboxReceipt<'_>,
) -> SyncDbResult<()> {
    if receipt.receipt_sha256.len() != 32 {
        return Err(SyncDbError::InvalidInput("receipt digest"));
    }
    let mut tx = pool.begin().await?;
    require_owned_lease_in_tx(&mut tx, &receipt.lease).await?;
    let result = sqlx::query(
        "UPDATE sync_outbox
         SET state = 'delivered', delivered_at = ?8,
             remote_contiguous_sequence = ?6, updated_at = ?8, last_error_class = NULL
         WHERE event_id = ?1 AND destination_node_id = ?2
           AND hq_epoch = ?3 AND branch_epoch = ?4 AND source_sequence = ?5
           AND state = 'awaiting_receipt' AND ?7 IN ('applied', 'duplicate')",
    )
    .bind(receipt.lease.event_id)
    .bind(receipt.receiver_node_id)
    .bind(receipt.receipt_hq_epoch)
    .bind(receipt.receipt_branch_epoch)
    .bind(receipt.source_sequence)
    .bind(receipt.contiguous_sequence)
    .bind(receipt.outcome)
    .bind(receipt.recorded_at)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() != 1 {
        return Err(SyncDbError::ReceiptMismatch);
    }
    release_lease_in_tx(&mut tx, &receipt.lease, receipt.recorded_at).await?;
    tx.commit().await?;
    Ok(())
}

/// Returns a transient failure to pending, or atomically moves permanent /
/// exhausted failures to the dead-letter table.
pub async fn retry_or_dead_letter_outbox(
    pool: &SqlitePool,
    failure: &RetryOutbox<'_>,
) -> SyncDbResult<bool> {
    let mut tx = pool.begin().await?;
    require_owned_lease_in_tx(&mut tx, &failure.lease).await?;
    let current = sqlx::query_as::<_, AttemptStateRow>(
        "SELECT attempts, state FROM sync_outbox WHERE event_id = ?1",
    )
    .bind(failure.lease.event_id)
    .fetch_one(&mut *tx)
    .await?;
    if !matches!(current.state.as_str(), "leased" | "awaiting_receipt") {
        return Err(SyncDbError::TerminalState);
    }

    let should_retry = failure.retryable && current.attempts < failure.max_attempts;
    if should_retry {
        sqlx::query(
            "UPDATE sync_outbox
             SET state = 'pending', not_before = ?2, updated_at = ?2,
                 sent_at = NULL, receipt_deadline = NULL, last_error_class = ?3
             WHERE event_id = ?1",
        )
        .bind(failure.lease.event_id)
        .bind(failure.retry_at)
        .bind(failure.error_class)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO sync_dead_letters (
                 id, direction, event_id, class, retryable, attempts,
                 payload_sha256, diagnostic, failed_at
             )
             SELECT ?1, 'outbox', event_id, ?3, ?4, attempts,
                    payload_sha256, ?5, ?6
             FROM sync_outbox WHERE event_id = ?2",
        )
        .bind(failure.dead_letter_id)
        .bind(failure.lease.event_id)
        .bind(failure.error_class)
        .bind(i64::from(failure.retryable))
        .bind(failure.diagnostic)
        .bind(failure.retry_at)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE sync_outbox
             SET state = 'dead_lettered', updated_at = ?2, last_error_class = ?3
             WHERE event_id = ?1",
        )
        .bind(failure.lease.event_id)
        .bind(failure.retry_at)
        .bind(failure.error_class)
        .execute(&mut *tx)
        .await?;
    }
    release_lease_in_tx(&mut tx, &failure.lease, failure.retry_at).await?;
    tx.commit().await?;
    Ok(should_retry)
}

async fn require_live_lease_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    lease: &LeaseToken<'_>,
    at: &str,
) -> SyncDbResult<()> {
    let valid: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM sync_outbox_leases
         WHERE outbox_event_id = ?1 AND lease_owner_node_id = ?2
           AND generation = ?3 AND released_at IS NULL AND expires_at >= ?4",
    )
    .bind(lease.event_id)
    .bind(lease.owner_node_id)
    .bind(lease.generation)
    .bind(at)
    .fetch_optional(&mut **tx)
    .await?;
    if valid.is_none() {
        return Err(SyncDbError::LeaseLost);
    }
    Ok(())
}

async fn require_owned_lease_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    lease: &LeaseToken<'_>,
) -> SyncDbResult<()> {
    let valid: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM sync_outbox_leases
         WHERE outbox_event_id = ?1 AND lease_owner_node_id = ?2
           AND generation = ?3 AND released_at IS NULL",
    )
    .bind(lease.event_id)
    .bind(lease.owner_node_id)
    .bind(lease.generation)
    .fetch_optional(&mut **tx)
    .await?;
    if valid.is_none() {
        return Err(SyncDbError::LeaseLost);
    }
    Ok(())
}

async fn release_lease_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    lease: &LeaseToken<'_>,
    released_at: &str,
) -> SyncDbResult<()> {
    let result = sqlx::query(
        "UPDATE sync_outbox_leases SET released_at = ?4
         WHERE outbox_event_id = ?1 AND lease_owner_node_id = ?2
           AND generation = ?3 AND released_at IS NULL",
    )
    .bind(lease.event_id)
    .bind(lease.owner_node_id)
    .bind(lease.generation)
    .bind(released_at)
    .execute(&mut **tx)
    .await?;
    if result.rows_affected() != 1 {
        return Err(SyncDbError::LeaseLost);
    }
    Ok(())
}

/// Claims an inbox identity after the service has verified authorization,
/// digest, signature, expiry, and exact fence. A completed replay returns its
/// stable receipt without re-running the business mutation.
pub async fn begin_inbox_apply_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    incoming: &InboxIdentity<'_>,
) -> SyncDbResult<InboxStart> {
    require_current_fence_in_tx(
        tx,
        incoming.branch_id,
        incoming.hq_epoch,
        incoming.branch_epoch,
    )
    .await?;
    if incoming.payload_sha256.len() != 32 || incoming.source_sequence < 1 {
        return Err(SyncDbError::InvalidInput("inbox sequence or digest"));
    }

    sqlx::query(
        "INSERT INTO sync_inbox (
             event_id, source_node_id, receiver_node_id, branch_id,
             hq_epoch, branch_epoch, source_sequence, payload_sha256,
             state, received_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'received', ?9)
         ON CONFLICT (event_id) DO NOTHING",
    )
    .bind(incoming.event_id)
    .bind(incoming.source_node_id)
    .bind(incoming.receiver_node_id)
    .bind(incoming.branch_id)
    .bind(incoming.hq_epoch)
    .bind(incoming.branch_epoch)
    .bind(incoming.source_sequence)
    .bind(incoming.payload_sha256)
    .bind(incoming.received_at)
    .execute(&mut **tx)
    .await?;

    let stored = sqlx::query_as::<_, InboxRow>(
        "SELECT source_node_id, receiver_node_id, branch_id, hq_epoch,
                branch_epoch, source_sequence, payload_sha256, state
         FROM sync_inbox WHERE event_id = ?1",
    )
    .bind(incoming.event_id)
    .fetch_one(&mut **tx)
    .await?;
    if stored.source_node_id != incoming.source_node_id
        || stored.receiver_node_id != incoming.receiver_node_id
        || stored.branch_id != incoming.branch_id
        || stored.hq_epoch != incoming.hq_epoch
        || stored.branch_epoch != incoming.branch_epoch
        || stored.source_sequence != incoming.source_sequence
        || stored.payload_sha256 != incoming.payload_sha256
    {
        return Err(SyncDbError::EventIdentityMismatch);
    }

    if let Some(receipt) = load_receipt_in_tx(tx, incoming.event_id).await? {
        return Ok(InboxStart::Duplicate(receipt));
    }
    if matches!(stored.state.as_str(), "completed" | "dead_lettered") {
        return Err(SyncDbError::TerminalState);
    }
    Ok(InboxStart::Apply)
}

/// Finalizes the domain mutation, cursor, and stable receipt inside the caller's
/// transaction. Rollback removes all of them together.
pub async fn complete_inbox_apply_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    applied: &CompleteInbox<'_>,
) -> SyncDbResult<StoredReceipt> {
    require_current_fence_in_tx(
        tx,
        applied.branch_id,
        applied.hq_epoch,
        applied.branch_epoch,
    )
    .await?;
    if applied.receipt_sha256.len() != 32 {
        return Err(SyncDbError::InvalidInput("receipt digest"));
    }
    if let Some(existing) = load_receipt_in_tx(tx, applied.event_id).await? {
        let matches = existing.receiver_node_id == applied.receiver_node_id
            && existing.hq_epoch == applied.hq_epoch
            && existing.branch_epoch == applied.branch_epoch
            && existing.source_sequence == applied.source_sequence
            && existing.receipt_sha256 == applied.receipt_sha256;
        if !matches {
            return Err(SyncDbError::ReceiptMismatch);
        }
        return Ok(existing);
    }

    let transitioned = sqlx::query(
        "UPDATE sync_inbox
         SET state = 'applied', validated_at = ?8, applied_at = ?9,
             application_result = ?10
         WHERE event_id = ?1 AND receiver_node_id = ?2 AND source_node_id = ?3
           AND branch_id = ?4 AND hq_epoch = ?5 AND branch_epoch = ?6
           AND source_sequence = ?7 AND state IN ('received', 'validated')",
    )
    .bind(applied.event_id)
    .bind(applied.receiver_node_id)
    .bind(applied.source_node_id)
    .bind(applied.branch_id)
    .bind(applied.hq_epoch)
    .bind(applied.branch_epoch)
    .bind(applied.source_sequence)
    .bind(applied.validated_at)
    .bind(applied.applied_at)
    .bind(applied.application_result)
    .execute(&mut **tx)
    .await?;
    if transitioned.rows_affected() != 1 {
        return Err(SyncDbError::TerminalState);
    }

    let contiguous_sequence = advance_cursor_in_tx(
        tx,
        applied.receiver_node_id,
        applied.source_node_id,
        applied.branch_id,
        applied.hq_epoch,
        applied.branch_epoch,
        applied.source_sequence,
        applied.recorded_at,
    )
    .await?;

    sqlx::query(
        "INSERT INTO sync_receipts (
             event_id, receiver_node_id, hq_epoch, branch_epoch,
             source_sequence, contiguous_sequence, outcome, conflict_class,
             receipt_sha256, recorded_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'applied', NULL, ?7, ?8)",
    )
    .bind(applied.event_id)
    .bind(applied.receiver_node_id)
    .bind(applied.hq_epoch)
    .bind(applied.branch_epoch)
    .bind(applied.source_sequence)
    .bind(contiguous_sequence)
    .bind(applied.receipt_sha256)
    .bind(applied.recorded_at)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE sync_inbox
         SET state = 'completed', completed_at = ?2 WHERE event_id = ?1 AND state = 'applied'",
    )
    .bind(applied.event_id)
    .bind(applied.recorded_at)
    .execute(&mut **tx)
    .await?;
    load_receipt_in_tx(tx, applied.event_id)
        .await?
        .ok_or(SyncDbError::ReceiptMismatch)
}

async fn load_receipt_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    event_id: &str,
) -> SyncDbResult<Option<StoredReceipt>> {
    Ok(sqlx::query_as::<_, StoredReceipt>(
        "SELECT event_id, receiver_node_id, hq_epoch, branch_epoch,
                source_sequence, contiguous_sequence, outcome, conflict_class,
                receipt_sha256, recorded_at
         FROM sync_receipts WHERE event_id = ?1",
    )
    .bind(event_id)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn advance_cursor_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    receiver_node_id: &str,
    source_node_id: &str,
    branch_id: &str,
    hq_epoch: i64,
    branch_epoch: i64,
    observed_sequence: i64,
    observed_at: &str,
) -> SyncDbResult<i64> {
    sqlx::query(
        "INSERT INTO sync_cursors (
             receiver_node_id, source_node_id, branch_id, hq_epoch,
             branch_epoch, contiguous_sequence, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)
         ON CONFLICT (receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch)
         DO NOTHING",
    )
    .bind(receiver_node_id)
    .bind(source_node_id)
    .bind(branch_id)
    .bind(hq_epoch)
    .bind(branch_epoch)
    .bind(observed_at)
    .execute(&mut **tx)
    .await?;

    let mut cursor = sqlx::query_as::<_, CursorRow>(
        "SELECT contiguous_sequence FROM sync_cursors
         WHERE receiver_node_id = ?1 AND source_node_id = ?2 AND branch_id = ?3
           AND hq_epoch = ?4 AND branch_epoch = ?5",
    )
    .bind(receiver_node_id)
    .bind(source_node_id)
    .bind(branch_id)
    .bind(hq_epoch)
    .bind(branch_epoch)
    .fetch_one(&mut **tx)
    .await?
    .contiguous_sequence;

    if observed_sequence <= cursor {
        return Ok(cursor);
    }
    if observed_sequence > cursor + 1 {
        sqlx::query(
            "INSERT OR IGNORE INTO sync_cursor_gaps (
                 receiver_node_id, source_node_id, branch_id, hq_epoch,
                 branch_epoch, observed_sequence, observed_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(receiver_node_id)
        .bind(source_node_id)
        .bind(branch_id)
        .bind(hq_epoch)
        .bind(branch_epoch)
        .bind(observed_sequence)
        .bind(observed_at)
        .execute(&mut **tx)
        .await?;
        return Ok(cursor);
    }

    cursor = observed_sequence;
    loop {
        let next = cursor + 1;
        let removed = sqlx::query(
            "DELETE FROM sync_cursor_gaps
             WHERE receiver_node_id = ?1 AND source_node_id = ?2 AND branch_id = ?3
               AND hq_epoch = ?4 AND branch_epoch = ?5 AND observed_sequence = ?6",
        )
        .bind(receiver_node_id)
        .bind(source_node_id)
        .bind(branch_id)
        .bind(hq_epoch)
        .bind(branch_epoch)
        .bind(next)
        .execute(&mut **tx)
        .await?;
        if removed.rows_affected() == 0 {
            break;
        }
        cursor = next;
    }
    sqlx::query(
        "UPDATE sync_cursors SET contiguous_sequence = ?6, updated_at = ?7
         WHERE receiver_node_id = ?1 AND source_node_id = ?2 AND branch_id = ?3
           AND hq_epoch = ?4 AND branch_epoch = ?5",
    )
    .bind(receiver_node_id)
    .bind(source_node_id)
    .bind(branch_id)
    .bind(hq_epoch)
    .bind(branch_epoch)
    .bind(cursor)
    .bind(observed_at)
    .execute(&mut **tx)
    .await?;
    Ok(cursor)
}

/// Persists signed snapshot metadata and its replay boundaries atomically.
pub async fn record_snapshot_metadata(
    pool: &SqlitePool,
    snapshot: &SnapshotMetadata<'_>,
) -> SyncDbResult<()> {
    if snapshot.sha256.len() != 32 {
        return Err(SyncDbError::InvalidInput("snapshot digest or cursors"));
    }
    let mut tx = pool.begin().await?;
    require_current_fence_in_tx(
        &mut tx,
        snapshot.branch_id,
        snapshot.hq_epoch,
        snapshot.branch_epoch,
    )
    .await?;
    sqlx::query(
        "INSERT INTO sync_snapshots (
             id, branch_id, created_by_node_id, hq_epoch, branch_epoch,
             schema_version, byte_length, chunk_count, sha256,
             signature_key_id, signature, storage_ref, state, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'ready', ?13)",
    )
    .bind(snapshot.id)
    .bind(snapshot.branch_id)
    .bind(snapshot.created_by_node_id)
    .bind(snapshot.hq_epoch)
    .bind(snapshot.branch_epoch)
    .bind(snapshot.schema_version)
    .bind(snapshot.byte_length)
    .bind(snapshot.chunk_count)
    .bind(snapshot.sha256)
    .bind(snapshot.signature_key_id)
    .bind(snapshot.signature)
    .bind(snapshot.storage_ref)
    .bind(snapshot.created_at)
    .execute(&mut *tx)
    .await?;
    for cursor in snapshot.cursors {
        sqlx::query(
            "INSERT INTO sync_snapshot_cursors (
                 snapshot_id, source_node_id, contiguous_sequence
             ) VALUES (?1, ?2, ?3)",
        )
        .bind(snapshot.id)
        .bind(cursor.source_node_id)
        .bind(cursor.contiguous_sequence)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Records recovery intent only when the ready snapshot exactly matches the
/// requested branch/fence. Restore, integrity checks, and atomic file swap are
/// performed by the recovery service, never by this query leaf.
pub async fn request_recovery(
    pool: &SqlitePool,
    recovery: &RecoveryMetadata<'_>,
) -> SyncDbResult<()> {
    let mut tx = pool.begin().await?;
    require_current_fence_in_tx(
        &mut tx,
        recovery.target_branch_id,
        recovery.target_hq_epoch,
        recovery.target_branch_epoch,
    )
    .await?;
    let snapshot_matches: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM sync_snapshots
         WHERE id = ?1 AND branch_id = ?2 AND hq_epoch = ?3
           AND branch_epoch = ?4 AND state = 'ready'",
    )
    .bind(recovery.snapshot_id)
    .bind(recovery.target_branch_id)
    .bind(recovery.target_hq_epoch)
    .bind(recovery.target_branch_epoch)
    .fetch_optional(&mut *tx)
    .await?;
    if snapshot_matches.is_none() {
        return Err(SyncDbError::InvalidInput("snapshot recovery target"));
    }
    sqlx::query(
        "INSERT INTO sync_recoveries (
             id, snapshot_id, requested_by_node_id, target_branch_id,
             target_hq_epoch, target_branch_epoch, mode, state,
             pre_restore_backup_ref, requested_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'requested', ?8, ?9, ?9)",
    )
    .bind(recovery.id)
    .bind(recovery.snapshot_id)
    .bind(recovery.requested_by_node_id)
    .bind(recovery.target_branch_id)
    .bind(recovery.target_hq_epoch)
    .bind(recovery.target_branch_epoch)
    .bind(recovery.mode)
    .bind(recovery.pre_restore_backup_ref)
    .bind(recovery.requested_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Monotonic recovery-state update. The service must audit every transition.
pub async fn update_recovery_state(
    pool: &SqlitePool,
    recovery_id: &str,
    expected_state: &str,
    next_state: &str,
    at: &str,
    failure_detail: Option<&str>,
) -> SyncDbResult<()> {
    let legal = matches!(
        (expected_state, next_state),
        ("requested", "snapshot_verified")
            | ("snapshot_verified", "snapshot_restored")
            | ("snapshot_verified", "complete")
            | ("snapshot_restored", "replaying")
            | ("replaying", "complete")
            | ("requested", "aborted")
            | ("snapshot_verified", "aborted")
            | ("snapshot_restored", "aborted")
            | ("replaying", "aborted")
    );
    if !legal {
        return Err(SyncDbError::InvalidInput("recovery transition"));
    }
    let result = sqlx::query(
        "UPDATE sync_recoveries
         SET state = ?3, updated_at = ?4,
             completed_at = CASE WHEN ?3 = 'complete' THEN ?4 ELSE completed_at END,
             failure_detail = ?5
         WHERE id = ?1 AND state = ?2",
    )
    .bind(recovery_id)
    .bind(expected_state)
    .bind(next_state)
    .bind(at)
    .bind(failure_detail)
    .execute(pool)
    .await?;
    if result.rows_affected() != 1 {
        return Err(SyncDbError::TerminalState);
    }
    Ok(())
}
