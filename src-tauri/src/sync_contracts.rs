//! Pure synchronization protocol contracts.
//!
//! This module deliberately has no storage, transport, serialization, clock, or
//! cryptography dependencies. Callers must generate UUID v4 identifiers, obtain
//! trusted time, canonicalize/serialize envelopes, hash payloads, and verify
//! signatures before applying these contracts.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

pub const PROTOCOL_VERSION: u16 = 1;
pub const MAX_PAYLOAD_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    InvalidUuidV4,
    InvalidIdentifier(&'static str),
    InvalidTimestampOrder,
    InvalidPayload,
    InvalidSignatureMetadata,
    InvalidTransition(&'static str),
    LeaseMismatch,
    EventMismatch,
    FenceRejected(FenceDecision),
    ReceiptMismatch,
    InvalidSequence,
    InvalidSnapshot(&'static str),
}

fn validate_uuid_v4(bytes: &[u8; 16]) -> Result<(), ContractError> {
    if bytes.iter().all(|byte| *byte == 0)
        || bytes[6] >> 4 != 4
        || bytes[8] & 0b1100_0000 != 0b1000_0000
    {
        return Err(ContractError::InvalidUuidV4);
    }
    Ok(())
}

fn parse_uuid_v4(value: &str) -> Result<[u8; 16], ContractError> {
    if value.len() != 36
        || value.as_bytes()[8] != b'-'
        || value.as_bytes()[13] != b'-'
        || value.as_bytes()[18] != b'-'
        || value.as_bytes()[23] != b'-'
    {
        return Err(ContractError::InvalidUuidV4);
    }

    let mut bytes = [0_u8; 16];
    let mut nibble_index = 0_usize;
    for character in value.bytes() {
        if character == b'-' {
            continue;
        }
        let nibble = match character {
            b'0'..=b'9' => character - b'0',
            b'a'..=b'f' => character - b'a' + 10,
            _ => return Err(ContractError::InvalidUuidV4),
        };
        let byte_index = nibble_index / 2;
        if nibble_index % 2 == 0 {
            bytes[byte_index] = nibble << 4;
        } else {
            bytes[byte_index] |= nibble;
        }
        nibble_index += 1;
    }
    if nibble_index != 32 {
        return Err(ContractError::InvalidUuidV4);
    }
    validate_uuid_v4(&bytes)?;
    Ok(bytes)
}

fn format_uuid_v4(bytes: &[u8; 16], formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    for (index, byte) in bytes.iter().enumerate() {
        if matches!(index, 4 | 6 | 8 | 10) {
            formatter.write_str("-")?;
        }
        write!(formatter, "{byte:02x}")?;
    }
    Ok(())
}

macro_rules! uuid_v4_id {
    ($name:ident) => {
        #[derive(Clone, Copy, Eq, Hash, Ord, PartialEq, PartialOrd)]
        pub struct $name([u8; 16]);

        impl $name {
            pub fn from_uuid_v4_bytes(bytes: [u8; 16]) -> Result<Self, ContractError> {
                validate_uuid_v4(&bytes)?;
                Ok(Self(bytes))
            }

            pub fn parse(value: &str) -> Result<Self, ContractError> {
                parse_uuid_v4(value).map(Self)
            }

            pub fn as_bytes(&self) -> &[u8; 16] {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                format_uuid_v4(&self.0, formatter)
            }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(formatter, "{}({})", stringify!($name), self)
            }
        }
    };
}

uuid_v4_id!(EventId);
uuid_v4_id!(NodeId);
uuid_v4_id!(SnapshotId);
uuid_v4_id!(RecoveryId);

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct BranchId(String);

impl BranchId {
    pub fn new(value: impl Into<String>) -> Result<Self, ContractError> {
        let value = value.into();
        if value.is_empty()
            || value.len() > 64
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        {
            return Err(ContractError::InvalidIdentifier("branch id"));
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct UnixMillis(pub u64);

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct BranchEpoch(pub u64);

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct HqEpoch(pub u64);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FenceToken {
    pub hq: HqEpoch,
    pub branch: BranchEpoch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FenceDecision {
    Accept,
    StaleHq,
    FutureHq,
    StaleBranch,
    FutureBranch,
}

impl FenceToken {
    pub fn compare(self, current: Self) -> FenceDecision {
        if self.hq < current.hq {
            FenceDecision::StaleHq
        } else if self.hq > current.hq {
            FenceDecision::FutureHq
        } else if self.branch < current.branch {
            FenceDecision::StaleBranch
        } else if self.branch > current.branch {
            FenceDecision::FutureBranch
        } else {
            FenceDecision::Accept
        }
    }

    pub fn require_current(self, current: Self) -> Result<(), ContractError> {
        match self.compare(current) {
            FenceDecision::Accept => Ok(()),
            decision => Err(ContractError::FenceRejected(decision)),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EventOperation {
    Upsert,
    Delete,
    Command,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayloadDescriptor {
    pub media_type: String,
    pub schema_version: u32,
    pub length: u64,
    pub sha256: [u8; 32],
}

impl PayloadDescriptor {
    pub fn validate(&self) -> Result<(), ContractError> {
        if self.media_type.is_empty()
            || self.media_type.len() > 128
            || self.schema_version == 0
            || self.length > MAX_PAYLOAD_BYTES
            || self.sha256.iter().all(|byte| *byte == 0)
        {
            return Err(ContractError::InvalidPayload);
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SignatureAlgorithm {
    Ed25519,
    RsaPssSha256,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignatureMetadata {
    pub algorithm: SignatureAlgorithm,
    pub key_id: String,
    pub signature: Vec<u8>,
}

impl SignatureMetadata {
    pub fn validate_shape(&self) -> Result<(), ContractError> {
        let key_id_valid = !self.key_id.is_empty()
            && self.key_id.len() <= 128
            && self
                .key_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
        let signature_valid = match self.algorithm {
            SignatureAlgorithm::Ed25519 => self.signature.len() == 64,
            SignatureAlgorithm::RsaPssSha256 => (256..=512).contains(&self.signature.len()),
        };
        if !key_id_valid || !signature_valid {
            return Err(ContractError::InvalidSignatureMetadata);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnvelopeMetadata {
    pub protocol_version: u16,
    pub event_id: EventId,
    pub source_node_id: NodeId,
    pub branch_id: BranchId,
    pub fence: FenceToken,
    pub source_sequence: u64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: EventOperation,
    pub emitted_at: UnixMillis,
    pub expires_at: Option<UnixMillis>,
    pub payload: PayloadDescriptor,
}

impl EnvelopeMetadata {
    pub fn validate(&self) -> Result<(), ContractError> {
        if self.protocol_version != PROTOCOL_VERSION {
            return Err(ContractError::InvalidIdentifier("protocol version"));
        }
        if self.source_sequence == 0 {
            return Err(ContractError::InvalidSequence);
        }
        for (value, label) in [
            (&self.entity_type, "entity type"),
            (&self.entity_id, "entity id"),
        ] {
            if value.is_empty() || value.len() > 128 || value.chars().any(char::is_control) {
                return Err(ContractError::InvalidIdentifier(label));
            }
        }
        if self
            .expires_at
            .is_some_and(|expires_at| expires_at <= self.emitted_at)
        {
            return Err(ContractError::InvalidTimestampOrder);
        }
        self.payload.validate()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignedEnvelopeMetadata {
    pub envelope: EnvelopeMetadata,
    pub signature: SignatureMetadata,
}

impl SignedEnvelopeMetadata {
    /// Checks structural metadata only. It does not canonicalize, hash, sign, or verify.
    pub fn validate_shape(&self) -> Result<(), ContractError> {
        self.envelope.validate()?;
        self.signature.validate_shape()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LeaseGrant {
    pub owner: NodeId,
    pub generation: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OutboxState {
    Pending {
        attempts: u16,
        not_before: UnixMillis,
    },
    Leased {
        grant: LeaseGrant,
        attempt: u16,
        lease_expires_at: UnixMillis,
    },
    AwaitingReceipt {
        grant: LeaseGrant,
        attempt: u16,
        sent_at: UnixMillis,
        receipt_deadline: UnixMillis,
    },
    Delivered {
        receipt_at: UnixMillis,
        remote_contiguous_sequence: u64,
    },
    DeadLettered {
        class: DeadLetterClass,
        attempts: u16,
        failed_at: UnixMillis,
    },
}

impl OutboxState {
    pub fn new(now: UnixMillis) -> Self {
        Self::Pending {
            attempts: 0,
            not_before: now,
        }
    }

    pub fn lease(
        self,
        grant: LeaseGrant,
        now: UnixMillis,
        lease_expires_at: UnixMillis,
    ) -> Result<Self, ContractError> {
        match self {
            Self::Pending {
                attempts,
                not_before,
            } if now >= not_before && lease_expires_at > now && grant.generation > 0 => {
                let attempt = attempts
                    .checked_add(1)
                    .ok_or(ContractError::InvalidTransition("attempt overflow"))?;
                Ok(Self::Leased {
                    grant,
                    attempt,
                    lease_expires_at,
                })
            }
            Self::Pending { .. } => Err(ContractError::InvalidTimestampOrder),
            _ => Err(ContractError::InvalidTransition("outbox lease")),
        }
    }

    pub fn mark_sent(
        self,
        grant: LeaseGrant,
        sent_at: UnixMillis,
        receipt_deadline: UnixMillis,
    ) -> Result<Self, ContractError> {
        match self {
            Self::Leased {
                grant: held,
                attempt,
                lease_expires_at,
            } if held == grant => {
                if sent_at > lease_expires_at || receipt_deadline <= sent_at {
                    return Err(ContractError::InvalidTimestampOrder);
                }
                Ok(Self::AwaitingReceipt {
                    grant,
                    attempt,
                    sent_at,
                    receipt_deadline,
                })
            }
            Self::Leased { .. } => Err(ContractError::LeaseMismatch),
            _ => Err(ContractError::InvalidTransition("outbox send")),
        }
    }

    pub fn acknowledge(
        self,
        grant: LeaseGrant,
        expected_event: EventId,
        receipt: &Receipt,
    ) -> Result<Self, ContractError> {
        match self {
            Self::AwaitingReceipt {
                grant: held,
                sent_at,
                ..
            } if held == grant => {
                if receipt.event_id != expected_event {
                    return Err(ContractError::EventMismatch);
                }
                if receipt.recorded_at < sent_at {
                    return Err(ContractError::InvalidTimestampOrder);
                }
                match receipt.outcome {
                    ReceiptOutcome::Applied | ReceiptOutcome::Duplicate => Ok(Self::Delivered {
                        receipt_at: receipt.recorded_at,
                        remote_contiguous_sequence: receipt.contiguous_sequence,
                    }),
                    ReceiptOutcome::Rejected(_) => Err(ContractError::InvalidTransition(
                        "rejected receipt requires failure policy",
                    )),
                }
            }
            Self::AwaitingReceipt { .. } => Err(ContractError::LeaseMismatch),
            _ => Err(ContractError::InvalidTransition("outbox acknowledge")),
        }
    }

    pub fn retry(
        self,
        retry_at: UnixMillis,
        class: DeadLetterClass,
        max_attempts: u16,
    ) -> Result<Self, ContractError> {
        let (attempts, earliest) = match self {
            Self::Leased {
                attempt,
                lease_expires_at,
                ..
            } => (attempt, lease_expires_at),
            Self::AwaitingReceipt {
                attempt,
                receipt_deadline,
                ..
            } => (attempt, receipt_deadline),
            _ => return Err(ContractError::InvalidTransition("outbox retry")),
        };
        if retry_at < earliest {
            return Err(ContractError::InvalidTimestampOrder);
        }
        if !class.is_retryable() || attempts >= max_attempts {
            Ok(Self::DeadLettered {
                class,
                attempts,
                failed_at: retry_at,
            })
        } else {
            Ok(Self::Pending {
                attempts,
                not_before: retry_at,
            })
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InboxState {
    Received {
        received_at: UnixMillis,
    },
    Validated {
        validated_at: UnixMillis,
    },
    Applied {
        applied_at: UnixMillis,
    },
    ReceiptReady {
        receipt: Receipt,
    },
    Completed {
        completed_at: UnixMillis,
    },
    DeadLettered {
        class: DeadLetterClass,
        failed_at: UnixMillis,
    },
}

impl InboxState {
    pub fn validate(self, at: UnixMillis) -> Result<Self, ContractError> {
        match self {
            Self::Received { received_at } if at >= received_at => {
                Ok(Self::Validated { validated_at: at })
            }
            Self::Received { .. } => Err(ContractError::InvalidTimestampOrder),
            _ => Err(ContractError::InvalidTransition("inbox validate")),
        }
    }

    pub fn apply(self, at: UnixMillis) -> Result<Self, ContractError> {
        match self {
            Self::Validated { validated_at } if at >= validated_at => {
                Ok(Self::Applied { applied_at: at })
            }
            Self::Validated { .. } => Err(ContractError::InvalidTimestampOrder),
            _ => Err(ContractError::InvalidTransition("inbox apply")),
        }
    }

    pub fn prepare_receipt(self, receipt: Receipt) -> Result<Self, ContractError> {
        match self {
            Self::Applied { applied_at } if receipt.recorded_at >= applied_at => {
                Ok(Self::ReceiptReady { receipt })
            }
            Self::Applied { .. } => Err(ContractError::InvalidTimestampOrder),
            _ => Err(ContractError::InvalidTransition("inbox prepare receipt")),
        }
    }

    pub fn complete(self, at: UnixMillis) -> Result<Self, ContractError> {
        match self {
            Self::ReceiptReady { receipt } if at >= receipt.recorded_at => {
                Ok(Self::Completed { completed_at: at })
            }
            Self::ReceiptReady { .. } => Err(ContractError::InvalidTimestampOrder),
            _ => Err(ContractError::InvalidTransition("inbox complete")),
        }
    }

    pub fn dead_letter(
        self,
        class: DeadLetterClass,
        at: UnixMillis,
    ) -> Result<Self, ContractError> {
        let earliest = match self {
            Self::Received { received_at } => received_at,
            Self::Validated { validated_at } => validated_at,
            _ => return Err(ContractError::InvalidTransition("inbox dead letter")),
        };
        if at < earliest {
            return Err(ContractError::InvalidTimestampOrder);
        }
        Ok(Self::DeadLettered {
            class,
            failed_at: at,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConflictClass {
    ConcurrentUpdate,
    EntityDeleted,
    UniqueConstraint,
    ReferentialIntegrity,
    FiscalPeriodClosed,
    ComplianceImmutable,
    EpochFenced,
    SchemaMismatch,
    ReceiptMismatch,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DeadLetterClass {
    TransportUnavailable,
    ReceiptTimeout,
    StorageBusy,
    InvalidEnvelope,
    SignatureInvalid,
    UnknownSigningKey,
    PayloadHashMismatch,
    AuthorizationDenied,
    UnsupportedProtocol,
    Conflict(ConflictClass),
}

impl DeadLetterClass {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::TransportUnavailable | Self::ReceiptTimeout | Self::StorageBusy
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReceiptOutcome {
    Applied,
    Duplicate,
    Rejected(ConflictClass),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Receipt {
    pub event_id: EventId,
    pub receiver_node_id: NodeId,
    pub fence: FenceToken,
    pub source_sequence: u64,
    pub contiguous_sequence: u64,
    pub outcome: ReceiptOutcome,
    pub recorded_at: UnixMillis,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReceiptRecord {
    Inserted,
    Duplicate,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ReceiptLedger {
    receipts: BTreeMap<EventId, Receipt>,
}

impl ReceiptLedger {
    pub fn record(&mut self, receipt: Receipt) -> Result<ReceiptRecord, ContractError> {
        if receipt.source_sequence == 0 {
            return Err(ContractError::InvalidSequence);
        }
        match self.receipts.get(&receipt.event_id) {
            Some(existing) if existing == &receipt => Ok(ReceiptRecord::Duplicate),
            Some(_) => Err(ContractError::ReceiptMismatch),
            None => {
                self.receipts.insert(receipt.event_id, receipt);
                Ok(ReceiptRecord::Inserted)
            }
        }
    }

    pub fn get(&self, event_id: EventId) -> Option<&Receipt> {
        self.receipts.get(&event_id)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReceiveCursor {
    pub source_node_id: NodeId,
    pub branch_id: BranchId,
    pub fence: FenceToken,
    contiguous_sequence: u64,
    gaps: BTreeSet<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CursorObservation {
    Duplicate,
    GapRecorded { sequence: u64 },
    Advanced { from: u64, through: u64 },
}

impl ReceiveCursor {
    pub fn new(source_node_id: NodeId, branch_id: BranchId, fence: FenceToken) -> Self {
        Self {
            source_node_id,
            branch_id,
            fence,
            contiguous_sequence: 0,
            gaps: BTreeSet::new(),
        }
    }

    pub fn contiguous_sequence(&self) -> u64 {
        self.contiguous_sequence
    }

    pub fn pending_sequences(&self) -> impl Iterator<Item = u64> + '_ {
        self.gaps.iter().copied()
    }

    pub fn observe(
        &mut self,
        fence: FenceToken,
        sequence: u64,
    ) -> Result<CursorObservation, ContractError> {
        fence.require_current(self.fence)?;
        if sequence == 0 {
            return Err(ContractError::InvalidSequence);
        }
        if sequence <= self.contiguous_sequence || self.gaps.contains(&sequence) {
            return Ok(CursorObservation::Duplicate);
        }
        if sequence > self.contiguous_sequence + 1 {
            self.gaps.insert(sequence);
            return Ok(CursorObservation::GapRecorded { sequence });
        }

        let from = self.contiguous_sequence;
        self.contiguous_sequence = sequence;
        while let Some(next) = self.contiguous_sequence.checked_add(1) {
            if self.gaps.remove(&next) {
                self.contiguous_sequence = next;
            } else {
                break;
            }
        }
        Ok(CursorObservation::Advanced {
            from,
            through: self.contiguous_sequence,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CursorCheckpoint {
    pub source_node_id: NodeId,
    pub contiguous_sequence: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SnapshotMetadata {
    pub snapshot_id: SnapshotId,
    pub branch_id: BranchId,
    pub fence: FenceToken,
    pub created_at: UnixMillis,
    pub schema_version: u32,
    pub byte_length: u64,
    pub sha256: [u8; 32],
    pub chunk_count: u32,
    pub cursors: Vec<CursorCheckpoint>,
}

impl SnapshotMetadata {
    pub fn validate(&self) -> Result<(), ContractError> {
        if self.schema_version == 0
            || self.byte_length == 0
            || self.sha256.iter().all(|byte| *byte == 0)
            || self.chunk_count == 0
        {
            return Err(ContractError::InvalidSnapshot("shape"));
        }
        let unique_nodes: BTreeSet<NodeId> = self
            .cursors
            .iter()
            .map(|checkpoint| checkpoint.source_node_id)
            .collect();
        if unique_nodes.len() != self.cursors.len() {
            return Err(ContractError::InvalidSnapshot("duplicate cursor"));
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecoveryMode {
    ReplaceFromSnapshot,
    VerifyOnly,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecoveryState {
    Requested,
    SnapshotVerified,
    SnapshotRestored,
    Replaying,
    Complete,
    Aborted,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryMetadata {
    pub recovery_id: RecoveryId,
    pub requested_by: NodeId,
    pub target_branch_id: BranchId,
    pub target_fence: FenceToken,
    pub snapshot: SnapshotMetadata,
    pub mode: RecoveryMode,
    pub state: RecoveryState,
    pub requested_at: UnixMillis,
}

impl RecoveryMetadata {
    pub fn validate(&self) -> Result<(), ContractError> {
        self.snapshot.validate()?;
        if self.target_branch_id != self.snapshot.branch_id
            || self.target_fence != self.snapshot.fence
            || self.requested_at < self.snapshot.created_at
        {
            return Err(ContractError::InvalidSnapshot("recovery target"));
        }
        Ok(())
    }

    pub fn replay_after(&self, source_node_id: NodeId) -> u64 {
        self.snapshot
            .cursors
            .iter()
            .find(|checkpoint| checkpoint.source_node_id == source_node_id)
            .map_or(1, |checkpoint| {
                checkpoint.contiguous_sequence.saturating_add(1)
            })
    }
}
