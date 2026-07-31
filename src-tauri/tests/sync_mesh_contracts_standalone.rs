#![allow(dead_code)]

#[path = "../src/mesh_contracts.rs"]
mod mesh;
#[path = "../src/sync_contracts.rs"]
mod sync_contracts;

use std::net::Ipv4Addr;
use sync_contracts as sync;

fn uuid_bytes(seed: u8) -> [u8; 16] {
    let mut bytes = [seed; 16];
    bytes[6] = 0x40 | (seed & 0x0f);
    bytes[8] = 0x80 | (seed & 0x3f);
    bytes
}

fn event(seed: u8) -> sync::EventId {
    sync::EventId::from_uuid_v4_bytes(uuid_bytes(seed)).unwrap()
}

fn node(seed: u8) -> sync::NodeId {
    sync::NodeId::from_uuid_v4_bytes(uuid_bytes(seed)).unwrap()
}

fn mesh_node(seed: u8) -> mesh::NodeId {
    mesh::NodeId::from_uuid_v4_bytes(uuid_bytes(seed)).unwrap()
}

fn fence(hq: u64, branch: u64) -> sync::FenceToken {
    sync::FenceToken {
        hq: sync::HqEpoch(hq),
        branch: sync::BranchEpoch(branch),
    }
}

fn wireguard_key(character: char) -> mesh::WireGuardKey {
    mesh::WireGuardKey::new(format!("{}=", character.to_string().repeat(43))).unwrap()
}

#[test]
fn ids_require_canonical_uuid_v4_and_round_trip() {
    let id = node(0x2a);
    let rendered = id.to_string();
    assert_eq!(rendered.len(), 36);
    assert_eq!(sync::NodeId::parse(&rendered), Ok(id));
    assert_eq!(
        sync::NodeId::parse(&rendered.to_uppercase()),
        Err(sync::ContractError::InvalidUuidV4)
    );

    let mut version_one = uuid_bytes(3);
    version_one[6] = 0x10;
    assert_eq!(
        sync::EventId::from_uuid_v4_bytes(version_one),
        Err(sync::ContractError::InvalidUuidV4)
    );
}

#[test]
fn epoch_fence_rejects_stale_and_unknown_future_writers() {
    let current = fence(8, 14);
    assert_eq!(current.compare(current), sync::FenceDecision::Accept);
    assert_eq!(fence(7, 99).compare(current), sync::FenceDecision::StaleHq);
    assert_eq!(fence(9, 1).compare(current), sync::FenceDecision::FutureHq);
    assert_eq!(
        fence(8, 13).compare(current),
        sync::FenceDecision::StaleBranch
    );
    assert_eq!(
        fence(8, 15).compare(current),
        sync::FenceDecision::FutureBranch
    );
}

#[test]
fn signed_envelope_validation_is_shape_only() {
    let metadata = sync::SignedEnvelopeMetadata {
        envelope: sync::EnvelopeMetadata {
            protocol_version: sync::PROTOCOL_VERSION,
            event_id: event(1),
            source_node_id: node(2),
            branch_id: sync::BranchId::new("westlands-01").unwrap(),
            fence: fence(2, 7),
            source_sequence: 42,
            entity_type: "sale".to_owned(),
            entity_id: "sale-42".to_owned(),
            operation: sync::EventOperation::Upsert,
            emitted_at: sync::UnixMillis(1_000),
            expires_at: Some(sync::UnixMillis(61_000)),
            payload: sync::PayloadDescriptor {
                media_type: "application/json".to_owned(),
                schema_version: 1,
                length: 128,
                sha256: [9; 32],
            },
        },
        signature: sync::SignatureMetadata {
            algorithm: sync::SignatureAlgorithm::Ed25519,
            key_id: "node-2-signing-3".to_owned(),
            signature: vec![7; 64],
        },
    };
    assert_eq!(metadata.validate_shape(), Ok(()));

    let mut malformed = metadata;
    malformed.signature.signature.pop();
    assert_eq!(
        malformed.validate_shape(),
        Err(sync::ContractError::InvalidSignatureMetadata)
    );
}

#[test]
fn outbox_enforces_lease_ownership_and_receipt_identity() {
    let owner = node(3);
    let other = node(4);
    let grant = sync::LeaseGrant {
        owner,
        generation: 1,
    };
    let leased = sync::OutboxState::new(sync::UnixMillis(100))
        .lease(grant, sync::UnixMillis(100), sync::UnixMillis(200))
        .unwrap();
    assert_eq!(
        leased.clone().mark_sent(
            sync::LeaseGrant {
                owner: other,
                generation: 1,
            },
            sync::UnixMillis(110),
            sync::UnixMillis(250),
        ),
        Err(sync::ContractError::LeaseMismatch)
    );

    let awaiting = leased
        .mark_sent(grant, sync::UnixMillis(110), sync::UnixMillis(250))
        .unwrap();
    let receipt = sync::Receipt {
        event_id: event(5),
        receiver_node_id: other,
        fence: fence(1, 1),
        source_sequence: 1,
        contiguous_sequence: 1,
        outcome: sync::ReceiptOutcome::Duplicate,
        recorded_at: sync::UnixMillis(120),
    };
    assert_eq!(
        awaiting.clone().acknowledge(grant, event(6), &receipt),
        Err(sync::ContractError::EventMismatch)
    );
    assert!(matches!(
        awaiting.acknowledge(grant, event(5), &receipt).unwrap(),
        sync::OutboxState::Delivered {
            remote_contiguous_sequence: 1,
            ..
        }
    ));
}

#[test]
fn outbox_retry_policy_separates_transient_and_permanent_failures() {
    let grant = sync::LeaseGrant {
        owner: node(7),
        generation: 4,
    };
    let leased = sync::OutboxState::new(sync::UnixMillis(0))
        .lease(grant, sync::UnixMillis(0), sync::UnixMillis(10))
        .unwrap();
    assert!(matches!(
        leased
            .clone()
            .retry(
                sync::UnixMillis(10),
                sync::DeadLetterClass::TransportUnavailable,
                3,
            )
            .unwrap(),
        sync::OutboxState::Pending { attempts: 1, .. }
    ));
    assert!(matches!(
        leased
            .retry(
                sync::UnixMillis(10),
                sync::DeadLetterClass::SignatureInvalid,
                3,
            )
            .unwrap(),
        sync::OutboxState::DeadLettered { attempts: 1, .. }
    ));
}

#[test]
fn inbox_only_moves_forward_and_prepares_receipt_after_apply() {
    let receipt = sync::Receipt {
        event_id: event(8),
        receiver_node_id: node(9),
        fence: fence(1, 2),
        source_sequence: 2,
        contiguous_sequence: 2,
        outcome: sync::ReceiptOutcome::Applied,
        recorded_at: sync::UnixMillis(30),
    };
    let state = sync::InboxState::Received {
        received_at: sync::UnixMillis(10),
    }
    .validate(sync::UnixMillis(20))
    .unwrap()
    .apply(sync::UnixMillis(25))
    .unwrap()
    .prepare_receipt(receipt)
    .unwrap()
    .complete(sync::UnixMillis(31))
    .unwrap();
    assert!(matches!(state, sync::InboxState::Completed { .. }));
}

#[test]
fn receipts_are_idempotent_but_mismatched_replays_are_rejected() {
    let mut ledger = sync::ReceiptLedger::default();
    let receipt = sync::Receipt {
        event_id: event(10),
        receiver_node_id: node(11),
        fence: fence(1, 1),
        source_sequence: 7,
        contiguous_sequence: 9,
        outcome: sync::ReceiptOutcome::Applied,
        recorded_at: sync::UnixMillis(100),
    };
    assert_eq!(
        ledger.record(receipt.clone()),
        Ok(sync::ReceiptRecord::Inserted)
    );
    assert_eq!(
        ledger.record(receipt.clone()),
        Ok(sync::ReceiptRecord::Duplicate)
    );
    let mut forged = receipt;
    forged.outcome = sync::ReceiptOutcome::Rejected(sync::ConflictClass::ComplianceImmutable);
    assert_eq!(
        ledger.record(forged),
        Err(sync::ContractError::ReceiptMismatch)
    );
}

#[test]
fn cursor_tracks_gaps_then_advances_contiguously() {
    let active_fence = fence(4, 3);
    let mut cursor =
        sync::ReceiveCursor::new(node(12), sync::BranchId::new("hq").unwrap(), active_fence);
    assert_eq!(
        cursor.observe(active_fence, 3),
        Ok(sync::CursorObservation::GapRecorded { sequence: 3 })
    );
    assert_eq!(
        cursor.observe(active_fence, 1),
        Ok(sync::CursorObservation::Advanced {
            from: 0,
            through: 1,
        })
    );
    assert_eq!(
        cursor.observe(active_fence, 2),
        Ok(sync::CursorObservation::Advanced {
            from: 1,
            through: 3,
        })
    );
    assert_eq!(cursor.contiguous_sequence(), 3);
    assert_eq!(
        cursor.observe(active_fence, 3),
        Ok(sync::CursorObservation::Duplicate)
    );
    assert_eq!(
        cursor.observe(fence(4, 2), 4),
        Err(sync::ContractError::FenceRejected(
            sync::FenceDecision::StaleBranch
        ))
    );
}

#[test]
fn snapshot_recovery_validates_target_and_replay_boundaries() {
    let source = node(13);
    let snapshot = sync::SnapshotMetadata {
        snapshot_id: sync::SnapshotId::from_uuid_v4_bytes(uuid_bytes(14)).unwrap(),
        branch_id: sync::BranchId::new("branch-7").unwrap(),
        fence: fence(5, 9),
        created_at: sync::UnixMillis(5_000),
        schema_version: 99,
        byte_length: 8_192,
        sha256: [3; 32],
        chunk_count: 2,
        cursors: vec![sync::CursorCheckpoint {
            source_node_id: source,
            contiguous_sequence: 88,
        }],
    };
    let recovery = sync::RecoveryMetadata {
        recovery_id: sync::RecoveryId::from_uuid_v4_bytes(uuid_bytes(15)).unwrap(),
        requested_by: node(16),
        target_branch_id: snapshot.branch_id.clone(),
        target_fence: snapshot.fence,
        snapshot,
        mode: sync::RecoveryMode::ReplaceFromSnapshot,
        state: sync::RecoveryState::Requested,
        requested_at: sync::UnixMillis(5_100),
    };
    assert_eq!(recovery.validate(), Ok(()));
    assert_eq!(recovery.replay_after(source), 89);
    assert_eq!(recovery.replay_after(node(17)), 1);
}

#[test]
fn mesh_ipv4_plan_is_private_deterministic_and_partitioned_by_site() {
    let plan = mesh::MeshIpv4Plan::new(Ipv4Addr::new(10, 73, 0, 0)).unwrap();
    let hq = plan.allocate(0, 2).unwrap();
    let branch = plan.allocate(42, 2).unwrap();
    assert_eq!(hq.address, Ipv4Addr::new(10, 73, 0, 2));
    assert_eq!(hq.role, mesh::SiteRole::Hq);
    assert_eq!(branch.address, Ipv4Addr::new(10, 73, 42, 2));
    assert_eq!(branch.role, mesh::SiteRole::Branch);
    assert_eq!(plan.allocate(42, 0), Err(mesh::MeshError::InvalidHost));
    assert_eq!(
        mesh::MeshIpv4Plan::new(Ipv4Addr::new(8, 8, 0, 0)),
        Err(mesh::MeshError::InvalidPool)
    );
}

fn endpoint(address: Ipv4Addr, port: u16) -> mesh::Endpoint {
    mesh::Endpoint::new(mesh::EndpointHost::Ipv4(address), port).unwrap()
}

#[test]
fn nat_and_endpoint_classification_is_conservative() {
    let target_a = endpoint(Ipv4Addr::new(1, 1, 1, 1), 3478);
    let target_b = endpoint(Ipv4Addr::new(8, 8, 8, 8), 3478);
    let mapped_a = endpoint(Ipv4Addr::new(41, 90, 1, 5), 50_000);
    let mapped_b = endpoint(Ipv4Addr::new(41, 90, 1, 5), 50_001);
    let class = mesh::classify_nat(&mesh::NatEvidence {
        local_address: Ipv4Addr::new(192, 168, 1, 9),
        observations: vec![
            mesh::NatObservation {
                probe_target: target_a,
                mapped_endpoint: mapped_a,
            },
            mesh::NatObservation {
                probe_target: target_b,
                mapped_endpoint: mapped_b,
            },
        ],
        unsolicited_inbound_succeeded: false,
        address_restricted_probe_succeeded: false,
    });
    assert_eq!(class, mesh::NatClass::Symmetric);
    assert_eq!(
        mesh::classify_endpoint(None, class, false, true),
        mesh::EndpointClass::RelayRequired
    );

    let cgnat = mesh::NatEvidence {
        local_address: Ipv4Addr::new(100, 70, 2, 3),
        observations: Vec::new(),
        unsolicited_inbound_succeeded: false,
        address_restricted_probe_succeeded: false,
    };
    assert_eq!(mesh::classify_nat(&cgnat), mesh::NatClass::CarrierGrade);
}

fn policy() -> mesh::EnrollmentPolicy {
    mesh::EnrollmentPolicy {
        request_ttl_ms: 60_000,
        rotation_interval_ms: 1_000,
        rotation_grace_ms: 200,
        max_active_peers: 5,
    }
}

#[test]
fn enrollment_requires_hq_approval_freshness_and_capacity() {
    let mut request = mesh::EnrollmentRequest {
        node_id: mesh_node(18),
        key_id: mesh::KeyId::new("wg-18-v1").unwrap(),
        public_key: wireguard_key('A'),
        requested_at: mesh::UnixMillis(1_000),
        expires_at: mesh::UnixMillis(50_000),
        approved_by_hq: false,
    };
    assert_eq!(
        mesh::evaluate_enrollment(&policy(), &request, mesh::UnixMillis(2_000), 0),
        Ok(mesh::EnrollmentDecision::RejectUnapproved)
    );
    request.approved_by_hq = true;
    assert_eq!(
        mesh::evaluate_enrollment(&policy(), &request, mesh::UnixMillis(2_000), 5),
        Ok(mesh::EnrollmentDecision::RejectCapacity)
    );
    assert_eq!(
        mesh::evaluate_enrollment(&policy(), &request, mesh::UnixMillis(2_000), 4),
        Ok(mesh::EnrollmentDecision::Approve)
    );
    assert_eq!(
        mesh::evaluate_enrollment(&policy(), &request, mesh::UnixMillis(50_001), 0),
        Ok(mesh::EnrollmentDecision::RejectExpired)
    );
}

#[test]
fn rotation_grace_accepts_only_current_or_next_key_then_revocation_is_final() {
    let old = mesh::KeyId::new("old-key").unwrap();
    let next = mesh::KeyId::new("next-key").unwrap();
    let pending = mesh::PeerLifecycle::RotationPending {
        current_key_id: old.clone(),
        next_key_id: next.clone(),
        deadline: mesh::UnixMillis(2_000),
    };
    assert_eq!(
        pending.authorize_handshake(&policy(), &old, mesh::UnixMillis(1_999)),
        Ok(())
    );
    assert_eq!(
        pending.authorize_handshake(&policy(), &next, mesh::UnixMillis(2_001)),
        Err(mesh::MeshError::RotationRequired)
    );
    let revoked = pending
        .revoke(mesh::UnixMillis(1_500), mesh::RevocationReason::Compromised)
        .unwrap();
    assert_eq!(
        revoked.authorize_handshake(&policy(), &old, mesh::UnixMillis(1_500)),
        Err(mesh::MeshError::NodeRevoked)
    );
}

#[test]
fn wireguard_support_rendering_never_emits_raw_keys_or_endpoint_hosts() {
    let public = wireguard_key('B');
    let preshared = wireguard_key('C');
    let raw_public = format!("{}=", "B".repeat(43));
    let raw_preshared = format!("{}=", "C".repeat(43));
    let config = mesh::WireGuardPeerConfig {
        public_key: public,
        preshared_key: Some(preshared),
        allowed_ips: vec![mesh::Ipv4Cidr::new(Ipv4Addr::new(10, 73, 42, 2), 32).unwrap()],
        endpoint: Some(
            mesh::Endpoint::new(
                mesh::EndpointHost::Dns("branch-42.example.test".to_owned()),
                51_820,
            )
            .unwrap(),
        ),
        persistent_keepalive_seconds: Some(25),
    };
    let rendered = config.render_redacted();
    let debug = format!("{config:?}");
    assert!(rendered.contains("PublicKey = <redacted:"));
    assert!(rendered.contains("PresharedKey = <redacted>"));
    assert!(rendered.contains("Endpoint = <redacted-host>:51820"));
    assert!(rendered.contains("AllowedIPs = 10.73.42.2/32"));
    assert!(!rendered.contains(&raw_public));
    assert!(!rendered.contains(&raw_preshared));
    assert!(!rendered.contains("branch-42.example.test"));
    assert!(!debug.contains(&raw_public));
    assert!(!debug.contains(&raw_preshared));
}
