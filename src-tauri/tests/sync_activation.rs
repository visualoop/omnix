use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{Duration, Utc};
use omnix_lib::network::{build_router, ServerState};
use omnix_lib::sync_activation::{
    apply_verified_envelope, create_registered_projection_snapshot, install_capture_triggers,
    pending_wire_envelopes, promote_captured_mutations, restore_registered_projection_snapshot,
    DomainMutationPayload, EnvelopeSigner, RsaPssSigner, SnapshotCipher, SyncActivationError,
    SyncCoordinator, SyncResult, SyncTransport, WireEnvelope, WireReceipt,
};
use parking_lot::RwLock;
use rand::rngs::OsRng;
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde_json::json;
use sha2::Digest;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use uuid::Uuid;

const BRANCH: &str = "branch-westlands";
const HQ_BRANCH: &str = "branch-hq";

struct Fixture {
    branch: SqlitePool,
    hq: SqlitePool,
    branch_signer: Arc<RsaPssSigner>,
    hq_signer: Arc<RsaPssSigner>,
    branch_node: String,
    hq_node: String,
}

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE branches (id TEXT PRIMARY KEY);
         CREATE TABLE users (id TEXT PRIMARY KEY);
         CREATE TABLE audit_log (
           id TEXT PRIMARY KEY, user_id TEXT, permission_key TEXT NOT NULL,
           action TEXT NOT NULL, outcome TEXT NOT NULL, risk_level TEXT NOT NULL,
           branch_id TEXT, entity_type TEXT, entity_id TEXT, metadata TEXT,
           created_at TEXT NOT NULL
         );
         CREATE TABLE sales (
           id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id),
           total REAL NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL
         );
         INSERT INTO branches(id) VALUES ('branch-westlands'), ('branch-hq');
         CREATE TABLE stock_transfers (
           id TEXT PRIMARY KEY, from_branch_id TEXT NOT NULL REFERENCES branches(id),
           to_branch_id TEXT NOT NULL REFERENCES branches(id), status TEXT NOT NULL
         );
         CREATE TABLE stock_transfer_items (
           id TEXT PRIMARY KEY, transfer_id TEXT NOT NULL REFERENCES stock_transfers(id),
           quantity_sent REAL NOT NULL
         );
         CREATE TABLE bookings (
           id TEXT PRIMARY KEY, branch_id TEXT REFERENCES branches(id)
         );
         CREATE TABLE guest_folios (
           id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id),
           folio_number TEXT NOT NULL, status TEXT NOT NULL
         );
         CREATE TABLE folio_charges (
           id TEXT PRIMARY KEY, folio_id TEXT NOT NULL REFERENCES guest_folios(id),
           amount REAL NOT NULL
         );
         CREATE TABLE folio_payments (
           id TEXT PRIMARY KEY, folio_id TEXT NOT NULL REFERENCES guest_folios(id),
           amount REAL NOT NULL
         );",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::raw_sql(include_str!("../migrations/099_sync_mesh.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../migrations/104_sync_activation.sql"))
        .execute(&pool)
        .await
        .unwrap();
    pool
}

fn signer(key_id: &str) -> (Arc<RsaPssSigner>, String) {
    let private = RsaPrivateKey::new(&mut OsRng, 1024).unwrap();
    let public = RsaPublicKey::from(&private).to_public_key_der().unwrap();
    let pem = private.to_pkcs8_pem(LineEnding::LF).unwrap();
    (
        Arc::new(RsaPssSigner::from_pkcs8_pem(key_id, pem.as_str()).unwrap()),
        BASE64.encode(public.as_bytes()),
    )
}

async fn fixture() -> Fixture {
    let branch = database().await;
    let hq = database().await;
    let branch_node = Uuid::new_v4().to_string();
    let hq_node = Uuid::new_v4().to_string();
    let (branch_signer, branch_public) = signer("branch-signing-key");
    let (hq_signer, hq_public) = signer("hq-signing-key");
    for pool in [&branch, &hq] {
        sqlx::query(
            "INSERT INTO sync_nodes (
               id, branch_id, display_name, role, signing_key_id,
               signing_public_key, signing_algorithm, key_status, created_at
             ) VALUES (?1, ?2, 'Westlands hub', 'branch', 'branch-signing-key',
                       ?3, 'rsa-pss-sha256', 'active', ?4),
                      (?5, ?6, 'HQ hub', 'hq', 'hq-signing-key',
                       ?7, 'rsa-pss-sha256', 'active', ?4)",
        )
        .bind(&branch_node)
        .bind(BRANCH)
        .bind(&branch_public)
        .bind(Utc::now().to_rfc3339())
        .bind(&hq_node)
        .bind(HQ_BRANCH)
        .bind(&hq_public)
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO sync_epochs (
               branch_id, hq_epoch, branch_epoch, changed_by_node_id, changed_at, reason
             ) VALUES (?1, 1, 1, ?2, ?3, 'initial activation')",
        )
        .bind(BRANCH)
        .bind(&hq_node)
        .bind(Utc::now().to_rfc3339())
        .execute(pool)
        .await
        .unwrap();
    }
    let route_time = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO sync_branch_routes (
           branch_id, local_node_id, destination_node_id, enabled, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 1, ?4, ?4)",
    )
    .bind(BRANCH)
    .bind(&branch_node)
    .bind(&hq_node)
    .bind(&route_time)
    .execute(&branch)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO sync_peer_routes (
           destination_node_id, transport_kind, endpoint_url, enabled, updated_at
         ) VALUES (?1, 'lan_http', 'http://127.0.0.1:9', 1, ?2)",
    )
    .bind(&hq_node)
    .bind(&route_time)
    .execute(&branch)
    .await
    .unwrap();
    install_capture_triggers(&branch).await.unwrap();
    Fixture {
        branch,
        hq,
        branch_signer,
        hq_signer,
        branch_node,
        hq_node,
    }
}

async fn insert_sale(pool: &SqlitePool, id: &str, total: f64) {
    sqlx::query(
        "INSERT INTO sales(id, branch_id, total, status, updated_at)
         VALUES (?1, ?2, ?3, 'completed', ?4)",
    )
    .bind(id)
    .bind(BRANCH)
    .bind(total)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn business_audit_and_outbox_are_atomic_and_rollback_together() {
    let f = fixture().await;
    let rolled_back = Uuid::new_v4().to_string();
    let mut tx = f.branch.begin().await.unwrap();
    sqlx::query(
        "INSERT INTO sales(id, branch_id, total, status, updated_at)
         VALUES (?1, ?2, 10, 'completed', ?3)",
    )
    .bind(&rolled_back)
    .bind(BRANCH)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.rollback().await.unwrap();
    for table in ["sales", "audit_log", "sync_domain_outbox"] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(&f.branch)
            .await
            .unwrap();
        assert_eq!(count, 0, "{table} escaped rollback");
    }

    let committed = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &committed, 25.0).await;
    let tuple: (i64, i64, i64) = sqlx::query_as(
        "SELECT
           (SELECT COUNT(*) FROM sales),
           (SELECT COUNT(*) FROM audit_log WHERE action = 'sync.capture.upsert'),
           (SELECT COUNT(*) FROM sync_domain_outbox WHERE state = 'pending')",
    )
    .fetch_one(&f.branch)
    .await
    .unwrap();
    assert_eq!(tuple, (1, 1, 1));
}

#[tokio::test]
async fn two_ended_transfers_and_walk_in_folios_capture_only_for_local_branch() {
    let f = fixture().await;
    let transfer_id = Uuid::new_v4().to_string();
    let item_id = Uuid::new_v4().to_string();
    let folio_id = Uuid::new_v4().to_string();
    let charge_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO stock_transfers (id, from_branch_id, to_branch_id, status)
         VALUES (?1, ?2, ?3, 'in_transit')",
    )
    .bind(&transfer_id)
    .bind(HQ_BRANCH)
    .bind(BRANCH)
    .execute(&f.branch)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO stock_transfer_items (id, transfer_id, quantity_sent)
         VALUES (?1, ?2, 3)",
    )
    .bind(&item_id)
    .bind(&transfer_id)
    .execute(&f.branch)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO guest_folios (id, booking_id, folio_number, status)
         VALUES (?1, NULL, ?2, 'open')",
    )
    .bind(&folio_id)
    .bind(format!("W-{BRANCH}-0001"))
    .execute(&f.branch)
    .await
    .unwrap();
    sqlx::query("INSERT INTO folio_charges (id, folio_id, amount) VALUES (?1, ?2, 45)")
        .bind(&charge_id)
        .bind(&folio_id)
        .execute(&f.branch)
        .await
        .unwrap();

    // A legacy walk-in with no booking and no branch prefix remains local but
    // cannot be attributed, so replication capture fails closed.
    sqlx::query(
        "INSERT INTO guest_folios (id, booking_id, folio_number, status)
         VALUES (?1, NULL, 'legacy-untagged', 'open')",
    )
    .bind(Uuid::new_v4().to_string())
    .execute(&f.branch)
    .await
    .unwrap();

    let captures: Vec<(String, String)> = sqlx::query_as(
        "SELECT entity_type, branch_id FROM sync_domain_outbox ORDER BY captured_at, entity_type",
    )
    .fetch_all(&f.branch)
    .await
    .unwrap();
    assert_eq!(captures.len(), 4);
    assert!(captures.iter().all(|(_, branch)| branch == BRANCH));
    for expected in [
        "stock_transfers",
        "stock_transfer_items",
        "guest_folios",
        "folio_charges",
    ] {
        assert!(captures.iter().any(|(entity, _)| entity == expected));
    }
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_log")
            .fetch_one(&f.branch)
            .await
            .unwrap(),
        4
    );
}

#[tokio::test]
async fn out_of_order_and_duplicate_delivery_converge_and_advance_cursor() {
    let f = fixture().await;
    let sale_id = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &sale_id, 10.0).await;
    for total in [20.0, 30.0] {
        sqlx::query("UPDATE sales SET total = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&sale_id)
            .bind(total)
            .bind(Utc::now().to_rfc3339())
            .execute(&f.branch)
            .await
            .unwrap();
    }
    assert_eq!(
        promote_captured_mutations(&f.branch, f.branch_signer.as_ref(), Utc::now())
            .await
            .unwrap(),
        3
    );
    let events = pending_wire_envelopes(&f.branch).await.unwrap();
    assert_eq!(events.len(), 3);
    for event in events.iter().rev() {
        apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), event, Utc::now())
            .await
            .unwrap();
    }
    let state: (i64, String) = sqlx::query_as(
        "SELECT source_sequence, row_json FROM sync_entity_state
         WHERE branch_id = ?1 AND entity_type = 'sales' AND entity_id = ?2",
    )
    .bind(BRANCH)
    .bind(&sale_id)
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(state.0, 3);
    let row: serde_json::Value = serde_json::from_str(&state.1).unwrap();
    assert_eq!(row["total"], 30.0);
    let cursor: i64 = sqlx::query_scalar(
        "SELECT contiguous_sequence FROM sync_cursors
         WHERE receiver_node_id = ?1 AND source_node_id = ?2 AND branch_id = ?3",
    )
    .bind(&f.hq_node)
    .bind(&f.branch_node)
    .bind(BRANCH)
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(cursor, 3);

    let first = apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &events[2], Utc::now())
        .await
        .unwrap();
    let second = apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &events[2], Utc::now())
        .await
        .unwrap();
    assert_eq!(first.receipt_sha256, second.receipt_sha256);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM sync_inbox")
            .fetch_one(&f.hq)
            .await
            .unwrap(),
        3
    );
}

#[tokio::test]
async fn stale_future_epoch_digest_and_signature_faults_fail_closed() {
    let f = fixture().await;
    insert_sale(&f.branch, &Uuid::new_v4().to_string(), 42.0).await;
    promote_captured_mutations(&f.branch, f.branch_signer.as_ref(), Utc::now())
        .await
        .unwrap();
    let event = pending_wire_envelopes(&f.branch).await.unwrap().remove(0);

    for epoch in [0, 2] {
        let mut fenced = event.clone();
        fenced.hq_epoch = epoch;
        assert!(matches!(
            apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &fenced, Utc::now()).await,
            Err(SyncActivationError::EpochFenced)
        ));
    }
    let mut bad_digest = event.clone();
    bad_digest.payload[0] ^= 1;
    assert!(matches!(
        apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &bad_digest, Utc::now()).await,
        Err(SyncActivationError::InvalidEnvelope("payload digest"))
    ));
    let mut bad_signature = event;
    bad_signature.signature[0] ^= 1;
    assert!(matches!(
        apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &bad_signature, Utc::now()).await,
        Err(SyncActivationError::SignatureInvalid)
    ));
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM sync_inbox")
            .fetch_one(&f.hq)
            .await
            .unwrap(),
        0
    );
}

struct RejectingTransport;
impl SyncTransport for RejectingTransport {
    fn send<'a>(
        &'a self,
        _: &'a str,
        _: &'a WireEnvelope,
    ) -> Pin<Box<dyn Future<Output = SyncResult<WireReceipt>> + Send + 'a>> {
        Box::pin(async { Err(SyncActivationError::Transport("injected outage".into())) })
    }
}

struct LoopbackTransport {
    receiver: Arc<SyncCoordinator>,
    duplicate: bool,
    failures: AtomicUsize,
}
impl SyncTransport for LoopbackTransport {
    fn send<'a>(
        &'a self,
        _: &'a str,
        envelope: &'a WireEnvelope,
    ) -> Pin<Box<dyn Future<Output = SyncResult<WireReceipt>> + Send + 'a>> {
        Box::pin(async move {
            if self
                .failures
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |left| {
                    left.checked_sub(1)
                })
                .is_ok()
            {
                return Err(SyncActivationError::Transport(
                    "injected packet loss".into(),
                ));
            }
            let receipt = self.receiver.receive(envelope).await?;
            if self.duplicate {
                return self.receiver.receive(envelope).await;
            }
            Ok(receipt)
        })
    }
}

#[tokio::test]
async fn lan_http_endpoint_applies_signed_events_and_rejects_tampering() {
    let f = fixture().await;
    let sale_id = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &sale_id, 91.0).await;
    promote_captured_mutations(&f.branch, f.branch_signer.as_ref(), Utc::now())
        .await
        .unwrap();
    let envelope = pending_wire_envelopes(&f.branch).await.unwrap().remove(0);
    let receiver = Arc::new(SyncCoordinator::new(
        f.hq.clone(),
        f.hq_signer.clone(),
        Arc::new(RejectingTransport),
    ));
    let app = build_router(ServerState {
        pool: f.hq.clone(),
        business_name: Arc::new(RwLock::new("HQ".to_string())),
        sync: Some(receiver),
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let endpoint = format!(
        "http://{address}{}",
        omnix_lib::sync_activation::SYNC_HTTP_PATH
    );
    let client = reqwest::Client::new();

    let first = client.post(&endpoint).json(&envelope).send().await.unwrap();
    assert_eq!(first.status(), reqwest::StatusCode::OK);
    let first_receipt: WireReceipt = first.json().await.unwrap();
    let duplicate = client.post(&endpoint).json(&envelope).send().await.unwrap();
    assert_eq!(duplicate.status(), reqwest::StatusCode::OK);
    let duplicate_receipt: WireReceipt = duplicate.json().await.unwrap();
    assert_eq!(
        first_receipt.receipt_sha256,
        duplicate_receipt.receipt_sha256
    );
    assert_eq!(first_receipt.outcome, duplicate_receipt.outcome);
    assert_eq!(
        first_receipt.contiguous_sequence,
        duplicate_receipt.contiguous_sequence
    );

    let mut tampered = envelope;
    tampered.signature[0] ^= 0x01;
    let rejected = client.post(&endpoint).json(&tampered).send().await.unwrap();
    assert_eq!(rejected.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sync_entity_state
             WHERE branch_id = ?1 AND entity_type = 'sales' AND entity_id = ?2",
        )
        .bind(BRANCH)
        .bind(&sale_id)
        .fetch_one(&f.hq)
        .await
        .unwrap(),
        1
    );
    server.abort();
}

#[tokio::test]
async fn dispatcher_recovers_from_fault_and_expired_crash_lease() {
    let f = fixture().await;
    let hq = Arc::new(SyncCoordinator::new(
        f.hq.clone(),
        f.hq_signer.clone(),
        Arc::new(RejectingTransport),
    ));
    let transport = Arc::new(LoopbackTransport {
        receiver: hq,
        duplicate: true,
        failures: AtomicUsize::new(1),
    });
    let branch = SyncCoordinator::new(f.branch.clone(), f.branch_signer.clone(), transport);
    let sale_id = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &sale_id, 77.0).await;
    let first = branch.dispatch_once(Utc::now()).await.unwrap();
    assert_eq!(first.retried, 1);
    sqlx::query("UPDATE sync_outbox SET not_before = ?1 WHERE state = 'pending'")
        .bind((Utc::now() - Duration::seconds(1)).to_rfc3339())
        .execute(&f.branch)
        .await
        .unwrap();

    // Simulate a dispatcher crash after leasing but before send. A later worker
    // must reclaim the expired durable generation and converge.
    sqlx::query("UPDATE sync_outbox SET state = 'leased' WHERE state = 'pending'")
        .execute(&f.branch)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO sync_outbox_leases (
           outbox_event_id, lease_owner_node_id, generation, acquired_at, expires_at
         ) SELECT event_id, ?1, 41, ?2, ?3 FROM sync_outbox WHERE 1 = 1
         ON CONFLICT(outbox_event_id) DO UPDATE SET
           lease_owner_node_id = excluded.lease_owner_node_id,
           generation = excluded.generation,
           acquired_at = excluded.acquired_at,
           expires_at = excluded.expires_at,
           released_at = NULL",
    )
    .bind(&f.branch_node)
    .bind((Utc::now() - Duration::minutes(2)).to_rfc3339())
    .bind((Utc::now() - Duration::minutes(1)).to_rfc3339())
    .execute(&f.branch)
    .await
    .unwrap();
    let recovered = branch.dispatch_once(Utc::now()).await.unwrap();
    assert_eq!(recovered.delivered, 1);
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT state FROM sync_outbox")
            .fetch_one(&f.branch)
            .await
            .unwrap(),
        "delivered"
    );
    let row: String = sqlx::query_scalar(
        "SELECT row_json FROM sync_entity_state
         WHERE branch_id = ?1 AND entity_type = 'sales' AND entity_id = ?2",
    )
    .bind(BRANCH)
    .bind(&sale_id)
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&row).unwrap()["total"],
        77.0
    );
}

#[tokio::test]
async fn conflicting_second_source_is_dead_lettered_with_stable_rejection() {
    let f = fixture().await;
    let sale_id = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &sale_id, 12.0).await;
    promote_captured_mutations(&f.branch, f.branch_signer.as_ref(), Utc::now())
        .await
        .unwrap();
    let event = pending_wire_envelopes(&f.branch).await.unwrap().remove(0);
    apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &event, Utc::now())
        .await
        .unwrap();

    let rogue_node = Uuid::new_v4().to_string();
    let (rogue_signer, rogue_public) = signer("rogue-key");
    sqlx::query(
        "INSERT INTO sync_nodes (
           id, branch_id, display_name, role, signing_key_id, signing_public_key,
           signing_algorithm, key_status, created_at
         ) VALUES (?1, ?2, 'Rogue replacement', 'branch', 'rogue-key', ?3,
                   'rsa-pss-sha256', 'active', ?4)",
    )
    .bind(&rogue_node)
    .bind(BRANCH)
    .bind(rogue_public)
    .bind(Utc::now().to_rfc3339())
    .execute(&f.hq)
    .await
    .unwrap();
    let payload = serde_json::to_vec(&DomainMutationPayload {
        capture_id: Uuid::new_v4().to_string(),
        entity_type: "sales".into(),
        entity_id: sale_id.clone(),
        operation: "upsert".into(),
        row: Some(json!({"id": sale_id, "total": 99.0})),
    })
    .unwrap();
    let mut rogue = WireEnvelope {
        event_id: Uuid::new_v4().to_string(),
        source_node_id: rogue_node,
        source_sequence: 1,
        payload_sha256: sha2::Sha256::digest(&payload).to_vec(),
        payload,
        signing_key_id: "rogue-key".into(),
        signature: Vec::new(),
        emitted_at: Utc::now().to_rfc3339(),
        expires_at: Some((Utc::now() + Duration::days(1)).to_rfc3339()),
        ..event
    };
    rogue.signature = rogue_signer
        .sign(&omnix_lib::sync_activation::canonical_envelope_bytes(
            &rogue,
        ))
        .unwrap();
    let rejected = apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &rogue, Utc::now())
        .await
        .unwrap();
    assert_eq!(rejected.outcome, "rejected");
    assert_eq!(
        rejected.conflict_class.as_deref(),
        Some("concurrent_update")
    );
    let counts: (i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM sync_conflicts),
                (SELECT COUNT(*) FROM sync_dead_letters WHERE direction = 'inbox')",
    )
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(counts, (1, 1));
}

struct XorCipher(u8);
impl SnapshotCipher for XorCipher {
    fn encrypt(&self, plaintext: &[u8]) -> SyncResult<Vec<u8>> {
        Ok(plaintext.iter().map(|byte| byte ^ self.0).collect())
    }
    fn decrypt(&self, ciphertext: &[u8]) -> SyncResult<Vec<u8>> {
        self.encrypt(ciphertext)
    }
}

#[tokio::test]
async fn encrypted_snapshot_recovery_restores_projection_and_replay_cursor() {
    let f = fixture().await;
    let sale_id = Uuid::new_v4().to_string();
    insert_sale(&f.branch, &sale_id, 55.0).await;
    promote_captured_mutations(&f.branch, f.branch_signer.as_ref(), Utc::now())
        .await
        .unwrap();
    let event = pending_wire_envelopes(&f.branch).await.unwrap().remove(0);
    apply_verified_envelope(&f.hq, f.hq_signer.as_ref(), &event, Utc::now())
        .await
        .unwrap();

    let root = std::env::temp_dir().join(format!("omnix-sync-test-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let snapshot = root.join("branch.snapshot.enc");
    let backup = root.join("pre-restore.snapshot.enc");
    let cipher = XorCipher(0xA5);
    let registered = create_registered_projection_snapshot(
        &f.hq,
        &cipher,
        f.hq_signer.as_ref(),
        BRANCH,
        &f.hq_node,
        &snapshot,
        Utc::now(),
    )
    .await
    .unwrap();
    assert!(!std::fs::read(&snapshot)
        .unwrap()
        .windows(BRANCH.len())
        .any(|window| window == BRANCH.as_bytes()));
    sqlx::query("DELETE FROM sync_entity_state WHERE branch_id = ?1")
        .bind(BRANCH)
        .execute(&f.hq)
        .await
        .unwrap();
    let recovery_id = restore_registered_projection_snapshot(
        &f.hq,
        &cipher,
        &registered.snapshot_id,
        &f.hq_node,
        &backup,
        Utc::now(),
    )
    .await
    .unwrap();
    assert!(backup.exists());
    let restored: (i64, i64) = sqlx::query_as(
        "SELECT
           (SELECT COUNT(*) FROM sync_entity_state WHERE branch_id = ?1),
           (SELECT contiguous_sequence FROM sync_cursors WHERE branch_id = ?1)",
    )
    .bind(BRANCH)
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(restored, (1, 1));
    let recovery: (String, i64, i64, i64) = sqlx::query_as(
        "SELECT r.state,
                (SELECT COUNT(*) FROM sync_snapshot_cursors WHERE snapshot_id = r.snapshot_id),
                (SELECT COUNT(*) FROM sync_recovery_fences
                 WHERE recovery_id = r.id AND read_only = 0 AND released_at IS NOT NULL),
                (SELECT COUNT(*) FROM audit_log
                 WHERE entity_type = 'sync_recovery' AND entity_id = r.id)
         FROM sync_recoveries r WHERE r.id = ?1",
    )
    .bind(&recovery_id)
    .fetch_one(&f.hq)
    .await
    .unwrap();
    assert_eq!(recovery, ("complete".to_string(), 1, 1, 5));
    std::fs::remove_dir_all(root).unwrap();
}

#[tokio::test]
async fn capture_triggers_install_on_the_complete_registered_schema() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    let migration_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let mut migrations = std::fs::read_dir(migration_dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("sql"))
        .collect::<Vec<_>>();
    migrations.sort();
    for path in migrations {
        let sql = std::fs::read_to_string(&path).unwrap();
        sqlx::raw_sql(&sql)
            .execute(&pool)
            .await
            .unwrap_or_else(|error| panic!("migration {} failed: {error}", path.display()));
    }
    let installed = install_capture_triggers(&pool).await.unwrap();
    let persisted: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_schema
         WHERE type = 'trigger' AND name LIKE 'sync_capture_%'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(persisted, installed as i64);
    assert!(installed > 100);
}

#[test]
fn migration_and_runtime_schema_never_define_private_key_columns() {
    let runtime_schema = include_str!("../migrations/104_sync_activation.sql").to_ascii_lowercase();
    let endpoint_schema =
        include_str!("../migrations/106_mesh_hub_endpoint.sql").to_ascii_lowercase();
    for schema in [&runtime_schema, &endpoint_schema] {
        assert!(!schema.contains("private_key text"));
        assert!(!schema.contains("preshared_key text"));
    }
    assert!(runtime_schema.contains("lan_http"));
    assert!(endpoint_schema.contains("mesh_endpoint_host"));
    assert!(Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("migrations/106_mesh_hub_endpoint.sql")
        .exists());
}
