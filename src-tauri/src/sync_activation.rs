//! Active offline branch synchronization.
//!
//! Operational writes still enter SQLite through `tauri-plugin-sql`, so durable
//! SQLite triggers are the only complete mutation boundary today. The triggers
//! installed here append an audit row and a `sync_domain_outbox` row inside the
//! caller's transaction. This service promotes those pointers to signed 099
//! envelopes, dispatches them through an abstract transport, and applies only
//! verified remote state to the HQ projection.

use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, SecondsFormat, Utc};
use rand::rngs::OsRng;
use rsa::pkcs8::{DecodePrivateKey, DecodePublicKey};
use rsa::{Pss, RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{FromRow, Row, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::sync::{
    self, CaptureEvent, CompleteInbox, InboxIdentity, InboxStart, LeaseRequest, LeaseToken,
    OutboxReceipt, RejectInbox, RetryOutbox, StoredReceipt,
};

pub const SYNC_HTTP_PATH: &str = "/api/sync/v1/events";
const PAYLOAD_MEDIA_TYPE: &str = "application/vnd.omnix.domain-mutation+json";
const MAX_CAPTURE_ATTEMPTS: i64 = 8;
const MAX_OUTBOX_ATTEMPTS: i64 = 8;
const RECEIPT_TIMEOUT_SECONDS: i64 = 30;
const EVENT_TTL_DAYS: i64 = 30;
const CAPTURE_LEASE_SECONDS: i64 = 60;

#[derive(Debug, thiserror::Error)]
pub enum SyncActivationError {
    #[error("sync storage is unavailable")]
    Sql(#[from] sqlx::Error),
    #[error("sync queue transition failed: {0}")]
    SyncDb(#[from] sync::SyncDbError),
    #[error("sync serialization failed")]
    Json(#[from] serde_json::Error),
    #[error("invalid sync envelope: {0}")]
    InvalidEnvelope(&'static str),
    #[error("sync authorization denied")]
    AuthorizationDenied,
    #[error("sync epoch fenced")]
    EpochFenced,
    #[error("sync signature verification failed")]
    SignatureInvalid,
    #[error("sync signing failed")]
    SigningFailed,
    #[error("sync transport failed: {0}")]
    Transport(String),
    #[error("sync route is not configured")]
    MissingRoute,
    #[error("sync key is not active")]
    KeyInactive,
    #[error("sync conflict: {0}")]
    Conflict(&'static str),
    #[error("snapshot recovery failed: {0}")]
    Recovery(&'static str),
    #[error("snapshot I/O failed")]
    Io(#[from] std::io::Error),
}

pub type SyncResult<T> = Result<T, SyncActivationError>;

/// Signing keys are supplied from OS-protected custody. Implementations must
/// never reconstruct private material from SQLite values.
pub trait EnvelopeSigner: Send + Sync {
    fn key_id(&self) -> &str;
    fn sign(&self, canonical_bytes: &[u8]) -> SyncResult<Vec<u8>>;
}

/// RSA-PSS signer whose private key exists only in process memory.
pub struct RsaPssSigner {
    key_id: String,
    private_key: RsaPrivateKey,
}

impl RsaPssSigner {
    pub fn from_pkcs8_pem(key_id: impl Into<String>, pem: &str) -> SyncResult<Self> {
        let private_key =
            RsaPrivateKey::from_pkcs8_pem(pem).map_err(|_| SyncActivationError::SigningFailed)?;
        Ok(Self {
            key_id: key_id.into(),
            private_key,
        })
    }

    /// Least-privilege file fallback for platforms without an integrated key
    /// provider. On Unix the file must not be accessible by group/other users.
    pub fn from_restricted_file(key_id: impl Into<String>, path: &Path) -> SyncResult<Self> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(path)?.permissions().mode() & 0o777;
            if mode & 0o077 != 0 {
                return Err(SyncActivationError::SigningFailed);
            }
        }
        let pem = std::fs::read_to_string(path)?;
        Self::from_pkcs8_pem(key_id, &pem)
    }
}

impl EnvelopeSigner for RsaPssSigner {
    fn key_id(&self) -> &str {
        &self.key_id
    }

    fn sign(&self, canonical_bytes: &[u8]) -> SyncResult<Vec<u8>> {
        let digest = Sha256::digest(canonical_bytes);
        self.private_key
            .sign_with_rng(&mut OsRng, Pss::new::<Sha256>(), &digest)
            .map_err(|_| SyncActivationError::SigningFailed)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DomainMutationPayload {
    pub capture_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub row: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WireEnvelope {
    pub protocol_version: u16,
    pub event_id: String,
    pub source_node_id: String,
    pub destination_node_id: String,
    pub branch_id: String,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub payload_media_type: String,
    pub payload_schema_version: i64,
    pub payload: Vec<u8>,
    pub payload_sha256: Vec<u8>,
    pub signing_key_id: String,
    pub signature_algorithm: String,
    pub emitted_at: String,
    pub expires_at: Option<String>,
    pub signature: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WireReceipt {
    pub event_id: String,
    pub receiver_node_id: String,
    pub hq_epoch: i64,
    pub branch_epoch: i64,
    pub source_sequence: i64,
    pub contiguous_sequence: i64,
    pub outcome: String,
    pub conflict_class: Option<String>,
    pub recorded_at: String,
    pub receipt_sha256: Vec<u8>,
    pub signing_key_id: String,
    pub signature_algorithm: String,
    pub signature: Vec<u8>,
}

pub trait SyncTransport: Send + Sync {
    fn send<'a>(
        &'a self,
        endpoint_url: &'a str,
        envelope: &'a WireEnvelope,
    ) -> Pin<Box<dyn Future<Output = SyncResult<WireReceipt>> + Send + 'a>>;
}

#[derive(Clone)]
pub struct LanHttpTransport {
    client: reqwest::Client,
}

impl LanHttpTransport {
    pub fn new() -> SyncResult<Self> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(35))
            .build()
            .map_err(|error| SyncActivationError::Transport(error.to_string()))?;
        Ok(Self { client })
    }
}

impl SyncTransport for LanHttpTransport {
    fn send<'a>(
        &'a self,
        endpoint_url: &'a str,
        envelope: &'a WireEnvelope,
    ) -> Pin<Box<dyn Future<Output = SyncResult<WireReceipt>> + Send + 'a>> {
        Box::pin(async move {
            let url = format!("{}{}", endpoint_url.trim_end_matches('/'), SYNC_HTTP_PATH);
            let response = self
                .client
                .post(url)
                .json(envelope)
                .send()
                .await
                .map_err(|error| SyncActivationError::Transport(error.to_string()))?;
            if !response.status().is_success() {
                return Err(SyncActivationError::Transport(format!(
                    "peer returned HTTP {}",
                    response.status()
                )));
            }
            response
                .json::<WireReceipt>()
                .await
                .map_err(|error| SyncActivationError::Transport(error.to_string()))
        })
    }
}

#[derive(Clone)]
pub struct SyncCoordinator {
    pool: SqlitePool,
    signer: Arc<dyn EnvelopeSigner>,
    transport: Arc<dyn SyncTransport>,
}

impl SyncCoordinator {
    pub fn new(
        pool: SqlitePool,
        signer: Arc<dyn EnvelopeSigner>,
        transport: Arc<dyn SyncTransport>,
    ) -> Self {
        Self {
            pool,
            signer,
            transport,
        }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn dispatch_once(&self, now: DateTime<Utc>) -> SyncResult<DispatchReport> {
        let promoted = promote_captured_mutations(&self.pool, self.signer.as_ref(), now).await?;
        let mut report = DispatchReport {
            promoted,
            ..DispatchReport::default()
        };
        let destinations = due_destinations(&self.pool).await?;
        for destination in destinations {
            let endpoint = peer_endpoint(&self.pool, &destination).await?;
            let owner_node_id = local_dispatcher_node(&self.pool, &destination).await?;
            let now_text = timestamp(now);
            let lease_until = timestamp(now + chrono::Duration::seconds(CAPTURE_LEASE_SECONDS));
            let leased = sync::lease_outbox(
                &self.pool,
                &LeaseRequest {
                    owner_node_id: &owner_node_id,
                    destination_node_id: Some(&destination),
                    now: &now_text,
                    lease_expires_at: &lease_until,
                    limit: 64,
                },
            )
            .await?;
            for item in leased {
                report.leased += 1;
                let lease = LeaseToken {
                    event_id: &item.event.event_id,
                    owner_node_id: &owner_node_id,
                    generation: item.lease_generation,
                };
                let envelope = wire_from_outbox(&item.event)?;
                match self.transport.send(&endpoint, &envelope).await {
                    Ok(receipt) => {
                        let sent_at = timestamp(Utc::now());
                        let deadline = timestamp(
                            Utc::now() + chrono::Duration::seconds(RECEIPT_TIMEOUT_SECONDS),
                        );
                        sync::mark_outbox_sent(&self.pool, &lease, &sent_at, &deadline).await?;
                        verify_wire_receipt(&self.pool, &envelope, &receipt).await?;
                        if receipt.outcome == "rejected" {
                            let failed_at = timestamp(Utc::now());
                            let class = receipt
                                .conflict_class
                                .as_deref()
                                .unwrap_or("remote_conflict");
                            let dead_letter_id = Uuid::new_v4().to_string();
                            sync::retry_or_dead_letter_outbox(
                                &self.pool,
                                &RetryOutbox {
                                    lease,
                                    error_class: class,
                                    diagnostic: "peer rejected a verified domain event",
                                    retry_at: &failed_at,
                                    retryable: false,
                                    max_attempts: MAX_OUTBOX_ATTEMPTS,
                                    dead_letter_id: &dead_letter_id,
                                },
                            )
                            .await?;
                            report.dead_lettered += 1;
                        } else {
                            sync::acknowledge_outbox(
                                &self.pool,
                                &OutboxReceipt {
                                    lease,
                                    receiver_node_id: &receipt.receiver_node_id,
                                    receipt_hq_epoch: receipt.hq_epoch,
                                    receipt_branch_epoch: receipt.branch_epoch,
                                    source_sequence: receipt.source_sequence,
                                    contiguous_sequence: receipt.contiguous_sequence,
                                    outcome: &receipt.outcome,
                                    receipt_sha256: &receipt.receipt_sha256,
                                    recorded_at: &receipt.recorded_at,
                                },
                            )
                            .await?;
                            report.delivered += 1;
                        }
                    }
                    Err(error) => {
                        let retry_at = timestamp(
                            Utc::now()
                                + chrono::Duration::seconds(2_i64.pow(item.attempt.min(10) as u32)),
                        );
                        let diagnostic = bounded_diagnostic(&error.to_string());
                        let dead_letter_id = Uuid::new_v4().to_string();
                        let retried = sync::retry_or_dead_letter_outbox(
                            &self.pool,
                            &RetryOutbox {
                                lease,
                                error_class: "transport_unavailable",
                                diagnostic: &diagnostic,
                                retry_at: &retry_at,
                                retryable: true,
                                max_attempts: MAX_OUTBOX_ATTEMPTS,
                                dead_letter_id: &dead_letter_id,
                            },
                        )
                        .await?;
                        if retried {
                            report.retried += 1;
                        } else {
                            report.dead_lettered += 1;
                        }
                    }
                }
            }
        }
        Ok(report)
    }

    pub async fn receive(&self, envelope: &WireEnvelope) -> SyncResult<WireReceipt> {
        apply_verified_envelope(&self.pool, self.signer.as_ref(), envelope, Utc::now()).await
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DispatchReport {
    pub promoted: usize,
    pub leased: usize,
    pub delivered: usize,
    pub retried: usize,
    pub dead_lettered: usize,
}

#[derive(Clone, Copy)]
struct CaptureSpec {
    entity_type: &'static str,
    table: &'static str,
    branch_new: &'static str,
    branch_old: &'static str,
}

/// Build the active coordinator when at least one branch route is enabled.
/// The private key path comes from process environment/OS service configuration,
/// never SQLite or frontend IPC. Nodes and public keys remain database metadata.
pub async fn coordinator_from_environment(
    pool: SqlitePool,
) -> SyncResult<Option<Arc<SyncCoordinator>>> {
    let signing_key_ids: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT n.signing_key_id
         FROM sync_branch_routes r
         JOIN sync_nodes n ON n.id = r.local_node_id
         WHERE r.enabled = 1 AND n.key_status IN ('active','rotation_pending')
         ORDER BY n.signing_key_id",
    )
    .fetch_all(&pool)
    .await?;
    if signing_key_ids.is_empty() {
        return Ok(None);
    }
    if signing_key_ids.len() != 1 {
        return Err(SyncActivationError::Conflict(
            "one process cannot dispatch multiple signing identities",
        ));
    }
    let key_path = std::env::var_os("OMNIX_SYNC_PRIVATE_KEY_PATH")
        .map(PathBuf::from)
        .ok_or(SyncActivationError::SigningFailed)?;
    let signer = Arc::new(RsaPssSigner::from_restricted_file(
        signing_key_ids[0].clone(),
        &key_path,
    )?);
    let transport = Arc::new(LanHttpTransport::new()?);
    Ok(Some(Arc::new(SyncCoordinator::new(
        pool,
        transport_signer(signer),
        transport,
    ))))
}

fn transport_signer(signer: Arc<RsaPssSigner>) -> Arc<dyn EnvelopeSigner> {
    signer
}

/// Runs promotion and delivery continuously. Durable capture/outbox leases make
/// an abrupt process stop safe; the next process generation reclaims them.
pub fn start_dispatcher(coordinator: Arc<SyncCoordinator>) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if let Err(error) = coordinator.dispatch_once(Utc::now()).await {
                log::warn!("branch sync dispatch cycle failed: {error}");
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    })
}

// Fixed, reviewed identifiers only. Child facts inherit the operational branch
// from their parent exactly as required by BRANCH_CONTEXT_OWNERSHIP.md.
const CAPTURE_SPECS: &[CaptureSpec] = &[
    direct("sales"), direct("expenses"), direct("cash_register"),
    direct("petty_cash"), direct("customer_payments"), direct("supplier_payments"),
    direct("sale_returns"), direct("purchase_orders"), direct("stock_takes"),
    direct("batches"), direct("attendance"), direct("payroll_runs"),
    direct("quotations"), direct("invoices"), direct("recurring_invoice_templates"),
    direct("credit_notes"), direct("bank_accounts"), direct("bank_transactions"),
    direct("shrinkage"), direct("laybys"), direct("special_orders"),
    direct("dining_areas"), direct("dining_tables"), direct("kitchen_stations"),
    direct("menu_items"), direct("hospitality_orders"), direct("room_types"),
    direct("rooms"), direct("rate_plans"), direct("bookings"),
    direct("hospitality_wastage"), direct("service_charge_rules"),
    direct("service_periods"), direct("salon_appointments"),
    direct("delivery_notes"), direct("equipment_units"), direct("service_jobs"),
    direct("rental_agreements"), direct("cold_chain_units"), direct("fixed_assets"),
    direct("warehouse_bins"),
    child("stock_transfers", "(SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND r.branch_id IN (NEW.from_branch_id, NEW.to_branch_id) ORDER BY CASE WHEN r.branch_id = NEW.from_branch_id THEN 0 ELSE 1 END LIMIT 1)", "(SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND r.branch_id IN (OLD.from_branch_id, OLD.to_branch_id) ORDER BY CASE WHEN r.branch_id = OLD.from_branch_id THEN 0 ELSE 1 END LIMIT 1)"),
    child("stock_transfer_items", "(SELECT r.branch_id FROM stock_transfers t JOIN sync_branch_routes r ON r.enabled = 1 AND r.branch_id IN (t.from_branch_id, t.to_branch_id) WHERE t.id = NEW.transfer_id ORDER BY CASE WHEN r.branch_id = t.from_branch_id THEN 0 ELSE 1 END LIMIT 1)", "(SELECT r.branch_id FROM stock_transfers t JOIN sync_branch_routes r ON r.enabled = 1 AND r.branch_id IN (t.from_branch_id, t.to_branch_id) WHERE t.id = OLD.transfer_id ORDER BY CASE WHEN r.branch_id = t.from_branch_id THEN 0 ELSE 1 END LIMIT 1)"),
    child("sale_items", "(SELECT branch_id FROM sales WHERE id = NEW.sale_id)", "(SELECT branch_id FROM sales WHERE id = OLD.sale_id)"),
    child("payments", "(SELECT branch_id FROM sales WHERE id = NEW.sale_id)", "(SELECT branch_id FROM sales WHERE id = OLD.sale_id)"),
    child("purchase_order_items", "(SELECT branch_id FROM purchase_orders WHERE id = NEW.po_id)", "(SELECT branch_id FROM purchase_orders WHERE id = OLD.po_id)"),
    child("goods_receipts", "(SELECT branch_id FROM purchase_orders WHERE id = NEW.po_id)", "(SELECT branch_id FROM purchase_orders WHERE id = OLD.po_id)"),
    child("goods_receipt_items", "(SELECT po.branch_id FROM goods_receipts gr JOIN purchase_orders po ON po.id = gr.po_id WHERE gr.id = NEW.grn_id)", "(SELECT po.branch_id FROM goods_receipts gr JOIN purchase_orders po ON po.id = gr.po_id WHERE gr.id = OLD.grn_id)"),
    child("sale_return_items", "(SELECT branch_id FROM sale_returns WHERE id = NEW.return_id)", "(SELECT branch_id FROM sale_returns WHERE id = OLD.return_id)"),
    child("stock_take_items", "(SELECT branch_id FROM stock_takes WHERE id = NEW.stock_take_id)", "(SELECT branch_id FROM stock_takes WHERE id = OLD.stock_take_id)"),
    child("quotation_items", "(SELECT branch_id FROM quotations WHERE id = NEW.quotation_id)", "(SELECT branch_id FROM quotations WHERE id = OLD.quotation_id)"),
    child("invoice_items", "(SELECT branch_id FROM invoices WHERE id = NEW.invoice_id)", "(SELECT branch_id FROM invoices WHERE id = OLD.invoice_id)"),
    child("invoice_payments", "(SELECT branch_id FROM invoices WHERE id = NEW.invoice_id)", "(SELECT branch_id FROM invoices WHERE id = OLD.invoice_id)"),
    child("recurring_invoice_items", "(SELECT branch_id FROM recurring_invoice_templates WHERE id = NEW.template_id)", "(SELECT branch_id FROM recurring_invoice_templates WHERE id = OLD.template_id)"),
    child("credit_note_items", "(SELECT branch_id FROM credit_notes WHERE id = NEW.credit_note_id)", "(SELECT branch_id FROM credit_notes WHERE id = OLD.credit_note_id)"),
    child("payslips", "(SELECT branch_id FROM payroll_runs WHERE id = NEW.payroll_run_id)", "(SELECT branch_id FROM payroll_runs WHERE id = OLD.payroll_run_id)"),
    child("layby_items", "(SELECT branch_id FROM laybys WHERE id = NEW.layby_id)", "(SELECT branch_id FROM laybys WHERE id = OLD.layby_id)"),
    child("layby_payments", "(SELECT branch_id FROM laybys WHERE id = NEW.layby_id)", "(SELECT branch_id FROM laybys WHERE id = OLD.layby_id)"),
    child("hospitality_order_items", "(SELECT branch_id FROM hospitality_orders WHERE id = NEW.order_id)", "(SELECT branch_id FROM hospitality_orders WHERE id = OLD.order_id)"),
    child("hospitality_order_item_modifiers", "(SELECT o.branch_id FROM hospitality_order_items i JOIN hospitality_orders o ON o.id = i.order_id WHERE i.id = NEW.order_item_id)", "(SELECT o.branch_id FROM hospitality_order_items i JOIN hospitality_orders o ON o.id = i.order_id WHERE i.id = OLD.order_item_id)"),
    child("guest_folios", "COALESCE((SELECT branch_id FROM bookings WHERE id = NEW.booking_id), (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(NEW.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1))", "COALESCE((SELECT branch_id FROM bookings WHERE id = OLD.booking_id), (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(OLD.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1))"),
    child("folio_charges", "(SELECT COALESCE(b.branch_id, (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(f.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1)) FROM guest_folios f LEFT JOIN bookings b ON b.id = f.booking_id WHERE f.id = NEW.folio_id)", "(SELECT COALESCE(b.branch_id, (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(f.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1)) FROM guest_folios f LEFT JOIN bookings b ON b.id = f.booking_id WHERE f.id = OLD.folio_id)"),
    child("folio_payments", "(SELECT COALESCE(b.branch_id, (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(f.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1)) FROM guest_folios f LEFT JOIN bookings b ON b.id = f.booking_id WHERE f.id = NEW.folio_id)", "(SELECT COALESCE(b.branch_id, (SELECT r.branch_id FROM sync_branch_routes r WHERE r.enabled = 1 AND instr(f.folio_number, 'W-' || r.branch_id || '-') = 1 ORDER BY length(r.branch_id) DESC LIMIT 1)) FROM guest_folios f LEFT JOIN bookings b ON b.id = f.booking_id WHERE f.id = OLD.folio_id)"),
    child("salon_appointment_services", "(SELECT branch_id FROM salon_appointments WHERE id = NEW.appointment_id)", "(SELECT branch_id FROM salon_appointments WHERE id = OLD.appointment_id)"),
    child("salon_commissions", "(SELECT branch_id FROM salon_appointments WHERE id = NEW.appointment_id)", "(SELECT branch_id FROM salon_appointments WHERE id = OLD.appointment_id)"),
    child("delivery_note_items", "(SELECT branch_id FROM delivery_notes WHERE id = NEW.delivery_note_id)", "(SELECT branch_id FROM delivery_notes WHERE id = OLD.delivery_note_id)"),
    child("service_job_parts", "(SELECT branch_id FROM service_jobs WHERE id = NEW.job_id)", "(SELECT branch_id FROM service_jobs WHERE id = OLD.job_id)"),
    child("service_job_labour", "(SELECT branch_id FROM service_jobs WHERE id = NEW.job_id)", "(SELECT branch_id FROM service_jobs WHERE id = OLD.job_id)"),
    child("rental_items", "(SELECT branch_id FROM rental_agreements WHERE id = NEW.agreement_id)", "(SELECT branch_id FROM rental_agreements WHERE id = OLD.agreement_id)"),
    child("cold_chain_logs", "(SELECT branch_id FROM cold_chain_units WHERE id = NEW.unit_id)", "(SELECT branch_id FROM cold_chain_units WHERE id = OLD.unit_id)"),
    direct("tip_distributions"),
    child("reservations", "COALESCE((SELECT branch_id FROM dining_tables WHERE id = NEW.table_id), (SELECT branch_id FROM rooms WHERE id = NEW.room_id))", "COALESCE((SELECT branch_id FROM dining_tables WHERE id = OLD.table_id), (SELECT branch_id FROM rooms WHERE id = OLD.room_id))"),
    child("service_period_sessions", "(SELECT branch_id FROM service_periods WHERE id = NEW.period_id)", "(SELECT branch_id FROM service_periods WHERE id = OLD.period_id)"),
    child("service_charge_allocations", "COALESCE((SELECT branch_id FROM sales WHERE id = NEW.sale_id), (SELECT branch_id FROM hospitality_orders WHERE id = NEW.order_id))", "COALESCE((SELECT branch_id FROM sales WHERE id = OLD.sale_id), (SELECT branch_id FROM hospitality_orders WHERE id = OLD.order_id))"),
    child("room_status_log", "(SELECT branch_id FROM rooms WHERE id = NEW.room_id)", "(SELECT branch_id FROM rooms WHERE id = OLD.room_id)"),
    child("housekeeping_tasks", "(SELECT branch_id FROM rooms WHERE id = NEW.room_id)", "(SELECT branch_id FROM rooms WHERE id = OLD.room_id)"),
    child("depreciation_entries", "(SELECT branch_id FROM fixed_assets WHERE id = NEW.asset_id)", "(SELECT branch_id FROM fixed_assets WHERE id = OLD.asset_id)"),
    child("bank_statement_imports", "(SELECT branch_id FROM bank_accounts WHERE id = NEW.account_id)", "(SELECT branch_id FROM bank_accounts WHERE id = OLD.account_id)"),
    child("bank_statement_lines", "(SELECT a.branch_id FROM bank_statement_imports i JOIN bank_accounts a ON a.id = i.account_id WHERE i.id = NEW.import_id)", "(SELECT a.branch_id FROM bank_statement_imports i JOIN bank_accounts a ON a.id = i.account_id WHERE i.id = OLD.import_id)"),
    child("etims_invoices", "(SELECT branch_id FROM sales WHERE id = NEW.sale_id)", "(SELECT branch_id FROM sales WHERE id = OLD.sale_id)"),
    child("insurance_claims", "(SELECT branch_id FROM sales WHERE id = NEW.sale_id)", "(SELECT branch_id FROM sales WHERE id = OLD.sale_id)"),
    child("insurance_claim_items", "(SELECT s.branch_id FROM insurance_claims c JOIN sales s ON s.id = c.sale_id WHERE c.id = NEW.claim_id)", "(SELECT s.branch_id FROM insurance_claims c JOIN sales s ON s.id = c.sale_id WHERE c.id = OLD.claim_id)"),
    child("sha_claim_queue", "(SELECT s.branch_id FROM insurance_claims c JOIN sales s ON s.id = c.sale_id WHERE c.id = NEW.claim_id)", "(SELECT s.branch_id FROM insurance_claims c JOIN sales s ON s.id = c.sale_id WHERE c.id = OLD.claim_id)"),
    child("prescriptions", "(SELECT branch_id FROM sales WHERE id = NEW.sale_id)", "(SELECT branch_id FROM sales WHERE id = OLD.sale_id)"),
    child("prescription_items", "(SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = NEW.prescription_id)", "(SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = OLD.prescription_id)"),
    child("controlled_log", "COALESCE((SELECT branch_id FROM batches WHERE id = NEW.batch_id), (SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = NEW.prescription_id))", "COALESCE((SELECT branch_id FROM batches WHERE id = OLD.batch_id), (SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = OLD.prescription_id))"),
    child("controlled_disposals", "(SELECT branch_id FROM batches WHERE id = NEW.batch_id)", "(SELECT branch_id FROM batches WHERE id = OLD.batch_id)"),
    child("refill_reminders", "(SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = NEW.prescription_id)", "(SELECT s.branch_id FROM prescriptions p JOIN sales s ON s.id = p.sale_id WHERE p.id = OLD.prescription_id)"),
    child("cold_chain_analyses", "(SELECT branch_id FROM cold_chain_units WHERE id = NEW.unit_id)", "(SELECT branch_id FROM cold_chain_units WHERE id = OLD.unit_id)"),
    child("stock_movements", "COALESCE((SELECT branch_id FROM batches WHERE id = NEW.batch_id), (SELECT branch_id FROM sales WHERE id = NEW.reference_id), (SELECT po.branch_id FROM goods_receipts gr JOIN purchase_orders po ON po.id = gr.po_id WHERE gr.id = NEW.reference_id), (SELECT branch_id FROM sale_returns WHERE id = NEW.reference_id), (SELECT branch_id FROM stock_takes WHERE id = NEW.reference_id), (SELECT branch_id FROM shrinkage WHERE id = NEW.reference_id), (SELECT branch_id FROM service_jobs WHERE id = NEW.reference_id), (SELECT branch_id FROM salon_appointments WHERE id = NEW.reference_id), (SELECT r.branch_id FROM stock_transfers t JOIN sync_branch_routes r ON r.enabled = 1 AND r.branch_id IN (t.from_branch_id, t.to_branch_id) WHERE t.id = NEW.reference_id ORDER BY CASE WHEN r.branch_id = t.from_branch_id THEN 0 ELSE 1 END LIMIT 1))", "COALESCE((SELECT branch_id FROM batches WHERE id = OLD.batch_id), (SELECT branch_id FROM sales WHERE id = OLD.reference_id), (SELECT po.branch_id FROM goods_receipts gr JOIN purchase_orders po ON po.id = gr.po_id WHERE gr.id = OLD.reference_id), (SELECT branch_id FROM sale_returns WHERE id = OLD.reference_id), (SELECT branch_id FROM stock_takes WHERE id = OLD.reference_id), (SELECT branch_id FROM shrinkage WHERE id = OLD.reference_id), (SELECT branch_id FROM service_jobs WHERE id = OLD.reference_id), (SELECT branch_id FROM salon_appointments WHERE id = OLD.reference_id), (SELECT r.branch_id FROM stock_transfers t JOIN sync_branch_routes r ON r.enabled = 1 AND r.branch_id IN (t.from_branch_id, t.to_branch_id) WHERE t.id = OLD.reference_id ORDER BY CASE WHEN r.branch_id = t.from_branch_id THEN 0 ELSE 1 END LIMIT 1))"),
];

const fn direct(table: &'static str) -> CaptureSpec {
    CaptureSpec {
        entity_type: table,
        table,
        branch_new: "NEW.branch_id",
        branch_old: "OLD.branch_id",
    }
}

const fn child(
    table: &'static str,
    branch_new: &'static str,
    branch_old: &'static str,
) -> CaptureSpec {
    CaptureSpec {
        entity_type: table,
        table,
        branch_new,
        branch_old,
    }
}

/// Installs persistent idempotent triggers after migrations have completed.
pub async fn install_capture_triggers(pool: &SqlitePool) -> SyncResult<usize> {
    let mut installed = 0;
    for spec in CAPTURE_SPECS {
        let exists: Option<(i64,)> =
            sqlx::query_as("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?1")
                .bind(spec.table)
                .fetch_optional(pool)
                .await?;
        if exists.is_none() {
            continue;
        }
        for (suffix, timing, row, branch, operation) in [
            ("insert", "AFTER INSERT", "NEW", spec.branch_new, "upsert"),
            ("update", "AFTER UPDATE", "NEW", spec.branch_new, "upsert"),
            ("delete", "BEFORE DELETE", "OLD", spec.branch_old, "delete"),
        ] {
            let trigger_name = format!("sync_capture_{}_{}", spec.table, suffix);
            let sql = capture_trigger_sql(
                &trigger_name,
                timing,
                spec.table,
                spec.entity_type,
                row,
                branch,
                operation,
            );
            sqlx::raw_sql(&sql).execute(pool).await?;
            installed += 1;
        }
    }
    Ok(installed)
}

fn capture_trigger_sql(
    trigger_name: &str,
    timing: &str,
    table: &str,
    entity_type: &str,
    row: &str,
    branch: &str,
    operation: &str,
) -> String {
    let capture_uuid = sqlite_uuid_v4();
    let audit_uuid = sqlite_uuid_v4();
    format!(
        "CREATE TRIGGER IF NOT EXISTS {trigger_name} {timing} ON {table}\n\
         WHEN EXISTS (SELECT 1 FROM sync_branch_routes r WHERE r.branch_id = {branch} AND r.enabled = 1)\n\
         BEGIN\n\
           INSERT INTO sync_domain_outbox (capture_id, branch_id, entity_type, entity_id, operation, captured_at, updated_at)\n\
           VALUES ({capture_uuid}, {branch}, '{entity_type}', CAST({row}.id AS TEXT), '{operation}', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));\n\
           INSERT INTO audit_log (id, user_id, permission_key, action, outcome, risk_level, branch_id, entity_type, entity_id, metadata, created_at)\n\
           VALUES ({audit_uuid}, NULL, 'sync.capture', 'sync.capture.{operation}', 'allowed', 'normal', {branch}, '{entity_type}', CAST({row}.id AS TEXT), json_object('source','sqlite-trigger'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));\n\
         END;"
    )
}

fn sqlite_uuid_v4() -> &'static str {
    "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))"
}

#[derive(Debug, FromRow)]
struct CapturedMutation {
    capture_id: String,
    branch_id: String,
    entity_type: String,
    entity_id: String,
    operation: String,
    local_node_id: String,
    destination_node_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
}

pub async fn promote_captured_mutations(
    pool: &SqlitePool,
    signer: &dyn EnvelopeSigner,
    now: DateTime<Utc>,
) -> SyncResult<usize> {
    let mut promoted = 0;
    for _ in 0..256 {
        let Some(capture) = claim_capture(pool, signer.key_id(), now).await? else {
            break;
        };
        match promote_capture(pool, signer, &capture, now).await {
            Ok(()) => promoted += 1,
            Err(error) => {
                fail_capture(pool, &capture.capture_id, &error, now).await?;
            }
        }
    }
    Ok(promoted)
}

async fn claim_capture(
    pool: &SqlitePool,
    signing_key_id: &str,
    now: DateTime<Utc>,
) -> SyncResult<Option<CapturedMutation>> {
    let now_text = timestamp(now);
    let lease_until = timestamp(now + chrono::Duration::seconds(CAPTURE_LEASE_SECONDS));
    let row = sqlx::query_as::<_, CapturedMutation>(
        "UPDATE sync_domain_outbox
         SET state = 'leased', lease_owner = ?1, lease_generation = lease_generation + 1,
             lease_expires_at = ?2, attempts = attempts + 1, updated_at = ?3
         WHERE capture_id = (
             SELECT c.capture_id
             FROM sync_domain_outbox c
             JOIN sync_branch_routes r ON r.branch_id = c.branch_id AND r.enabled = 1
             JOIN sync_nodes n ON n.id = r.local_node_id
             JOIN sync_epochs e ON e.branch_id = c.branch_id
             WHERE (c.state = 'pending' OR (c.state = 'leased' AND c.lease_expires_at <= ?3))
               AND n.signing_key_id = ?1 AND n.key_status IN ('active','rotation_pending')
             ORDER BY c.captured_at, c.capture_id LIMIT 1
         )
         RETURNING capture_id, branch_id, entity_type, entity_id, operation,
           (SELECT local_node_id FROM sync_branch_routes WHERE branch_id = sync_domain_outbox.branch_id) AS local_node_id,
           (SELECT destination_node_id FROM sync_branch_routes WHERE branch_id = sync_domain_outbox.branch_id) AS destination_node_id,
           (SELECT hq_epoch FROM sync_epochs WHERE branch_id = sync_domain_outbox.branch_id) AS hq_epoch,
           (SELECT branch_epoch FROM sync_epochs WHERE branch_id = sync_domain_outbox.branch_id) AS branch_epoch",
    )
    .bind(signing_key_id)
    .bind(lease_until)
    .bind(now_text)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

async fn promote_capture(
    pool: &SqlitePool,
    signer: &dyn EnvelopeSigner,
    capture: &CapturedMutation,
    now: DateTime<Utc>,
) -> SyncResult<()> {
    let mut tx = pool.begin().await?;
    let row = if capture.operation == "delete" {
        None
    } else {
        materialize_entity_in_tx(&mut tx, &capture.entity_type, &capture.entity_id).await?
    };
    let operation = if row.is_some() { "upsert" } else { "delete" };
    let payload = serde_json::to_vec(&DomainMutationPayload {
        capture_id: capture.capture_id.clone(),
        entity_type: capture.entity_type.clone(),
        entity_id: capture.entity_id.clone(),
        operation: operation.to_string(),
        row,
    })?;
    if payload.len() > crate::sync_contracts::MAX_PAYLOAD_BYTES as usize {
        return Err(SyncActivationError::InvalidEnvelope("payload too large"));
    }
    let now_text = timestamp(now);
    let sequence = sync::peek_next_sequence_in_tx(
        &mut tx,
        &capture.local_node_id,
        &capture.branch_id,
        capture.hq_epoch,
        capture.branch_epoch,
        &now_text,
    )
    .await?;
    let mut envelope = WireEnvelope {
        protocol_version: crate::sync_contracts::PROTOCOL_VERSION,
        event_id: Uuid::new_v4().to_string(),
        source_node_id: capture.local_node_id.clone(),
        destination_node_id: capture.destination_node_id.clone(),
        branch_id: capture.branch_id.clone(),
        hq_epoch: capture.hq_epoch,
        branch_epoch: capture.branch_epoch,
        source_sequence: sequence,
        entity_type: capture.entity_type.clone(),
        entity_id: capture.entity_id.clone(),
        operation: operation.to_string(),
        payload_media_type: PAYLOAD_MEDIA_TYPE.to_string(),
        payload_schema_version: 1,
        payload_sha256: Sha256::digest(&payload).to_vec(),
        payload,
        signing_key_id: signer.key_id().to_string(),
        signature_algorithm: "rsa-pss-sha256".to_string(),
        emitted_at: now_text.clone(),
        expires_at: Some(timestamp(now + chrono::Duration::days(EVENT_TTL_DAYS))),
        signature: Vec::new(),
    };
    envelope.signature = signer.sign(&canonical_envelope_bytes(&envelope))?;
    sync::capture_event_in_tx(
        &mut tx,
        &CaptureEvent {
            event_id: &envelope.event_id,
            source_node_id: &envelope.source_node_id,
            destination_node_id: Some(&envelope.destination_node_id),
            branch_id: &envelope.branch_id,
            hq_epoch: envelope.hq_epoch,
            branch_epoch: envelope.branch_epoch,
            source_sequence: envelope.source_sequence,
            protocol_version: i64::from(envelope.protocol_version),
            entity_type: &envelope.entity_type,
            entity_id: &envelope.entity_id,
            operation: &envelope.operation,
            payload_media_type: &envelope.payload_media_type,
            payload_schema_version: envelope.payload_schema_version,
            payload: &envelope.payload,
            payload_sha256: &envelope.payload_sha256,
            signing_key_id: &envelope.signing_key_id,
            signature_algorithm: &envelope.signature_algorithm,
            signature: &envelope.signature,
            emitted_at: &envelope.emitted_at,
            expires_at: envelope.expires_at.as_deref(),
            now: &now_text,
        },
    )
    .await?;
    let changed = sqlx::query(
        "UPDATE sync_domain_outbox
         SET state = 'promoted', promoted_event_id = ?2, lease_expires_at = NULL,
             updated_at = ?3, last_error = NULL
         WHERE capture_id = ?1 AND state = 'leased' AND lease_owner = ?4",
    )
    .bind(&capture.capture_id)
    .bind(&envelope.event_id)
    .bind(&now_text)
    .bind(signer.key_id())
    .execute(&mut *tx)
    .await?;
    if changed.rows_affected() != 1 {
        return Err(SyncActivationError::Conflict("capture lease lost"));
    }
    tx.commit().await?;
    Ok(())
}

async fn fail_capture(
    pool: &SqlitePool,
    capture_id: &str,
    error: &SyncActivationError,
    now: DateTime<Utc>,
) -> SyncResult<()> {
    sqlx::query(
        "UPDATE sync_domain_outbox
         SET state = CASE WHEN attempts >= ?2 THEN 'dead_lettered' ELSE 'pending' END,
             lease_expires_at = NULL, last_error = ?3, updated_at = ?4
         WHERE capture_id = ?1 AND state = 'leased'",
    )
    .bind(capture_id)
    .bind(MAX_CAPTURE_ATTEMPTS)
    .bind(bounded_diagnostic(&error.to_string()))
    .bind(timestamp(now))
    .execute(pool)
    .await?;
    Ok(())
}

async fn materialize_entity_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    entity_type: &str,
    entity_id: &str,
) -> SyncResult<Option<Value>> {
    let table = CAPTURE_SPECS
        .iter()
        .find(|spec| spec.entity_type == entity_type)
        .map(|spec| spec.table)
        .ok_or(SyncActivationError::InvalidEnvelope("unknown entity type"))?;
    let pragma = format!("PRAGMA table_info(\"{table}\")");
    let columns = sqlx::query(&pragma).fetch_all(&mut **tx).await?;
    if columns.is_empty() {
        return Err(SyncActivationError::InvalidEnvelope("unknown entity table"));
    }
    let mut arguments = Vec::with_capacity(columns.len() * 2);
    for column in columns {
        let name: String = column.try_get("name")?;
        let declared_type: String = column.try_get("type")?;
        arguments.push(format!("'{}'", name.replace('\'', "''")));
        if declared_type.to_ascii_uppercase().contains("BLOB") {
            arguments.push(format!(
                "CASE WHEN \"{name}\" IS NULL THEN NULL ELSE hex(\"{name}\") END"
            ));
        } else {
            arguments.push(format!("\"{name}\""));
        }
    }
    let query = format!(
        "SELECT json_object({}) FROM \"{table}\" WHERE CAST(id AS TEXT) = ?1 LIMIT 1",
        arguments.join(",")
    );
    let json: Option<String> = sqlx::query_scalar(&query)
        .bind(entity_id)
        .fetch_optional(&mut **tx)
        .await?;
    json.map(|value| serde_json::from_str(&value))
        .transpose()
        .map_err(Into::into)
}

#[derive(Debug, FromRow)]
struct NodeAuthorization {
    branch_id: String,
    role: String,
    signing_key_id: String,
    signing_public_key: String,
    signing_algorithm: String,
    key_status: String,
    deleted_at: Option<String>,
}

pub async fn apply_verified_envelope(
    pool: &SqlitePool,
    receiver_signer: &dyn EnvelopeSigner,
    envelope: &WireEnvelope,
    now: DateTime<Utc>,
) -> SyncResult<WireReceipt> {
    verify_envelope_before_payload(pool, envelope, now).await?;
    let payload: DomainMutationPayload = serde_json::from_slice(&envelope.payload)?;
    if payload.entity_type != envelope.entity_type
        || payload.entity_id != envelope.entity_id
        || payload.operation != envelope.operation
        || payload.capture_id.len() != 36
    {
        return Err(SyncActivationError::InvalidEnvelope(
            "payload metadata mismatch",
        ));
    }
    match (&payload.operation[..], payload.row.as_ref()) {
        ("upsert", Some(Value::Object(_))) | ("delete", None) => {}
        _ => {
            return Err(SyncActivationError::InvalidEnvelope(
                "invalid mutation payload",
            ))
        }
    }

    let received_at = timestamp(now);
    let mut tx = pool.begin().await?;
    let recovery_fenced: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM sync_recovery_fences
         WHERE branch_id = ?1 AND read_only = 1 AND released_at IS NULL",
    )
    .bind(&envelope.branch_id)
    .fetch_optional(&mut *tx)
    .await?;
    if recovery_fenced.is_some() {
        return Err(SyncActivationError::EpochFenced);
    }
    match sync::begin_inbox_apply_in_tx(
        &mut tx,
        &InboxIdentity {
            event_id: &envelope.event_id,
            source_node_id: &envelope.source_node_id,
            receiver_node_id: &envelope.destination_node_id,
            branch_id: &envelope.branch_id,
            hq_epoch: envelope.hq_epoch,
            branch_epoch: envelope.branch_epoch,
            source_sequence: envelope.source_sequence,
            payload_sha256: &envelope.payload_sha256,
            received_at: &received_at,
        },
    )
    .await?
    {
        InboxStart::Duplicate(receipt) => {
            tx.rollback().await?;
            return sign_stored_receipt(receiver_signer, receipt);
        }
        InboxStart::Apply => {}
    }

    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT source_node_id, source_sequence FROM sync_entity_state
         WHERE branch_id = ?1 AND entity_type = ?2 AND entity_id = ?3",
    )
    .bind(&envelope.branch_id)
    .bind(&envelope.entity_type)
    .bind(&envelope.entity_id)
    .fetch_optional(&mut *tx)
    .await?;
    if existing
        .as_ref()
        .is_some_and(|(source, _)| source != &envelope.source_node_id)
    {
        let contiguous = sync::preview_contiguous_sequence_in_tx(
            &mut tx,
            &envelope.destination_node_id,
            &envelope.source_node_id,
            &envelope.branch_id,
            envelope.hq_epoch,
            envelope.branch_epoch,
            envelope.source_sequence,
        )
        .await?;
        let class = "concurrent_update";
        let digest = receipt_digest(
            &envelope.event_id,
            &envelope.destination_node_id,
            envelope.hq_epoch,
            envelope.branch_epoch,
            envelope.source_sequence,
            contiguous,
            "rejected",
            Some(class),
            &received_at,
        );
        let conflict_id = Uuid::new_v4().to_string();
        let dead_letter_id = Uuid::new_v4().to_string();
        let stored = sync::reject_inbox_apply_in_tx(
            &mut tx,
            &RejectInbox {
                event_id: &envelope.event_id,
                receiver_node_id: &envelope.destination_node_id,
                source_node_id: &envelope.source_node_id,
                branch_id: &envelope.branch_id,
                hq_epoch: envelope.hq_epoch,
                branch_epoch: envelope.branch_epoch,
                source_sequence: envelope.source_sequence,
                entity_type: &envelope.entity_type,
                entity_id: &envelope.entity_id,
                conflict_id: &conflict_id,
                conflict_class: class,
                detail: "entity has another authoritative source",
                dead_letter_id: &dead_letter_id,
                payload_sha256: &envelope.payload_sha256,
                receipt_sha256: &digest,
                at: &received_at,
            },
        )
        .await?;
        tx.commit().await?;
        return sign_stored_receipt(receiver_signer, stored);
    }

    let row_json = payload
        .row
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    sqlx::query(
        "INSERT INTO sync_entity_state (
             branch_id, entity_type, entity_id, source_node_id, hq_epoch,
             branch_epoch, source_sequence, event_id, row_json, deleted, applied_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT (branch_id, entity_type, entity_id) DO UPDATE SET
             hq_epoch = excluded.hq_epoch,
             branch_epoch = excluded.branch_epoch,
             source_sequence = excluded.source_sequence,
             event_id = excluded.event_id,
             row_json = excluded.row_json,
             deleted = excluded.deleted,
             applied_at = excluded.applied_at
         WHERE sync_entity_state.source_node_id = excluded.source_node_id
           AND sync_entity_state.source_sequence < excluded.source_sequence",
    )
    .bind(&envelope.branch_id)
    .bind(&envelope.entity_type)
    .bind(&envelope.entity_id)
    .bind(&envelope.source_node_id)
    .bind(envelope.hq_epoch)
    .bind(envelope.branch_epoch)
    .bind(envelope.source_sequence)
    .bind(&envelope.event_id)
    .bind(row_json)
    .bind(i64::from(payload.operation == "delete"))
    .bind(&received_at)
    .execute(&mut *tx)
    .await?;

    let contiguous = sync::preview_contiguous_sequence_in_tx(
        &mut tx,
        &envelope.destination_node_id,
        &envelope.source_node_id,
        &envelope.branch_id,
        envelope.hq_epoch,
        envelope.branch_epoch,
        envelope.source_sequence,
    )
    .await?;
    let receipt_digest = receipt_digest(
        &envelope.event_id,
        &envelope.destination_node_id,
        envelope.hq_epoch,
        envelope.branch_epoch,
        envelope.source_sequence,
        contiguous,
        "applied",
        None,
        &received_at,
    );
    let stored = sync::complete_inbox_apply_in_tx(
        &mut tx,
        &CompleteInbox {
            event_id: &envelope.event_id,
            receiver_node_id: &envelope.destination_node_id,
            source_node_id: &envelope.source_node_id,
            branch_id: &envelope.branch_id,
            hq_epoch: envelope.hq_epoch,
            branch_epoch: envelope.branch_epoch,
            source_sequence: envelope.source_sequence,
            application_result: if existing
                .is_some_and(|(_, sequence)| sequence >= envelope.source_sequence)
            {
                "superseded"
            } else {
                "applied"
            },
            receipt_sha256: &receipt_digest,
            validated_at: &received_at,
            applied_at: &received_at,
            recorded_at: &received_at,
        },
    )
    .await?;
    sqlx::query(
        "INSERT INTO audit_log (
             id, permission_key, action, outcome, risk_level, branch_id,
             entity_type, entity_id, metadata, created_at
         ) VALUES (?1, 'sync.apply', 'sync.apply.verified', 'allowed', 'normal',
                   ?2, ?3, ?4, json_object('eventId', ?5, 'sourceNodeId', ?6), ?7)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&envelope.branch_id)
    .bind(&envelope.entity_type)
    .bind(&envelope.entity_id)
    .bind(&envelope.event_id)
    .bind(&envelope.source_node_id)
    .bind(&received_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    sign_stored_receipt(receiver_signer, stored)
}

async fn verify_envelope_before_payload(
    pool: &SqlitePool,
    envelope: &WireEnvelope,
    now: DateTime<Utc>,
) -> SyncResult<()> {
    if envelope.protocol_version != crate::sync_contracts::PROTOCOL_VERSION
        || envelope.payload.len() > crate::sync_contracts::MAX_PAYLOAD_BYTES as usize
        || Uuid::parse_str(&envelope.event_id)
            .ok()
            .filter(|id| id.get_version_num() == 4)
            .is_none()
        || envelope.source_sequence < 1
        || envelope.payload_sha256.len() != 32
        || envelope.signature.len() < 64
        || envelope.signature_algorithm != "rsa-pss-sha256"
        || envelope.payload_media_type != PAYLOAD_MEDIA_TYPE
        || envelope.payload_schema_version != 1
    {
        return Err(SyncActivationError::InvalidEnvelope("shape"));
    }
    if Sha256::digest(&envelope.payload).as_slice() != envelope.payload_sha256 {
        return Err(SyncActivationError::InvalidEnvelope("payload digest"));
    }
    let emitted = parse_timestamp(&envelope.emitted_at)?;
    if emitted > now + chrono::Duration::minutes(5) {
        return Err(SyncActivationError::InvalidEnvelope("future event"));
    }
    if let Some(expires) = envelope.expires_at.as_deref() {
        if parse_timestamp(expires)? <= now {
            return Err(SyncActivationError::InvalidEnvelope("expired event"));
        }
    }

    let source = load_node(pool, &envelope.source_node_id).await?;
    let receiver = load_node(pool, &envelope.destination_node_id).await?;
    if source.deleted_at.is_some()
        || receiver.deleted_at.is_some()
        || !matches!(source.key_status.as_str(), "active" | "rotation_pending")
        || source.signing_key_id != envelope.signing_key_id
        || source.signing_algorithm != envelope.signature_algorithm
        || source.branch_id != envelope.branch_id
    {
        return Err(SyncActivationError::AuthorizationDenied);
    }
    let topology_allowed = (source.role == "branch" && receiver.role == "hq")
        || (source.role == "hq"
            && receiver.role == "branch"
            && receiver.branch_id == envelope.branch_id);
    if !topology_allowed {
        return Err(SyncActivationError::AuthorizationDenied);
    }
    let fence: Option<(i64, i64)> =
        sqlx::query_as("SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1")
            .bind(&envelope.branch_id)
            .fetch_optional(pool)
            .await?;
    if fence != Some((envelope.hq_epoch, envelope.branch_epoch)) {
        return Err(SyncActivationError::EpochFenced);
    }
    verify_signature(
        &source.signing_public_key,
        &canonical_envelope_bytes(envelope),
        &envelope.signature,
    )
}

async fn load_node(pool: &SqlitePool, node_id: &str) -> SyncResult<NodeAuthorization> {
    sqlx::query_as::<_, NodeAuthorization>(
        "SELECT branch_id, role, signing_key_id, signing_public_key,
                signing_algorithm, key_status, deleted_at
         FROM sync_nodes WHERE id = ?1",
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SyncActivationError::AuthorizationDenied)
}

fn verify_signature(public_key_b64: &str, bytes: &[u8], signature: &[u8]) -> SyncResult<()> {
    let der = BASE64
        .decode(public_key_b64)
        .map_err(|_| SyncActivationError::SignatureInvalid)?;
    let key = RsaPublicKey::from_public_key_der(&der)
        .map_err(|_| SyncActivationError::SignatureInvalid)?;
    key.verify(Pss::new::<Sha256>(), &Sha256::digest(bytes), signature)
        .map_err(|_| SyncActivationError::SignatureInvalid)
}

fn sign_stored_receipt(
    signer: &dyn EnvelopeSigner,
    stored: StoredReceipt,
) -> SyncResult<WireReceipt> {
    let mut receipt = WireReceipt {
        event_id: stored.event_id,
        receiver_node_id: stored.receiver_node_id,
        hq_epoch: stored.hq_epoch,
        branch_epoch: stored.branch_epoch,
        source_sequence: stored.source_sequence,
        contiguous_sequence: stored.contiguous_sequence,
        outcome: stored.outcome,
        conflict_class: stored.conflict_class,
        recorded_at: stored.recorded_at,
        receipt_sha256: stored.receipt_sha256,
        signing_key_id: signer.key_id().to_string(),
        signature_algorithm: "rsa-pss-sha256".to_string(),
        signature: Vec::new(),
    };
    receipt.signature = signer.sign(&canonical_receipt_bytes(&receipt))?;
    Ok(receipt)
}

pub async fn verify_wire_receipt(
    pool: &SqlitePool,
    envelope: &WireEnvelope,
    receipt: &WireReceipt,
) -> SyncResult<()> {
    if receipt.event_id != envelope.event_id
        || receipt.receiver_node_id != envelope.destination_node_id
        || receipt.hq_epoch != envelope.hq_epoch
        || receipt.branch_epoch != envelope.branch_epoch
        || receipt.source_sequence != envelope.source_sequence
        || !matches!(
            receipt.outcome.as_str(),
            "applied" | "duplicate" | "rejected"
        )
        || (receipt.outcome == "rejected") != receipt.conflict_class.is_some()
        || receipt.receipt_sha256.len() != 32
    {
        return Err(SyncActivationError::InvalidEnvelope("receipt identity"));
    }
    let expected = receipt_digest(
        &receipt.event_id,
        &receipt.receiver_node_id,
        receipt.hq_epoch,
        receipt.branch_epoch,
        receipt.source_sequence,
        receipt.contiguous_sequence,
        &receipt.outcome,
        receipt.conflict_class.as_deref(),
        &receipt.recorded_at,
    );
    if expected != receipt.receipt_sha256 {
        return Err(SyncActivationError::InvalidEnvelope("receipt digest"));
    }
    let node = load_node(pool, &receipt.receiver_node_id).await?;
    if node.signing_key_id != receipt.signing_key_id
        || node.signing_algorithm != receipt.signature_algorithm
        || !matches!(node.key_status.as_str(), "active" | "rotation_pending")
    {
        return Err(SyncActivationError::KeyInactive);
    }
    verify_signature(
        &node.signing_public_key,
        &canonical_receipt_bytes(receipt),
        &receipt.signature,
    )
}

fn receipt_digest(
    event_id: &str,
    receiver_node_id: &str,
    hq_epoch: i64,
    branch_epoch: i64,
    source_sequence: i64,
    contiguous_sequence: i64,
    outcome: &str,
    conflict_class: Option<&str>,
    recorded_at: &str,
) -> Vec<u8> {
    let fields = [
        event_id.to_string(),
        receiver_node_id.to_string(),
        hq_epoch.to_string(),
        branch_epoch.to_string(),
        source_sequence.to_string(),
        contiguous_sequence.to_string(),
        outcome.to_string(),
        conflict_class.unwrap_or("").to_string(),
        recorded_at.to_string(),
    ];
    Sha256::digest(canonical_fields(b"omnix-sync-receipt-v1\0", &fields)).to_vec()
}

pub fn canonical_envelope_bytes(envelope: &WireEnvelope) -> Vec<u8> {
    let fields = vec![
        envelope.protocol_version.to_string(),
        envelope.event_id.clone(),
        envelope.source_node_id.clone(),
        envelope.destination_node_id.clone(),
        envelope.branch_id.clone(),
        envelope.hq_epoch.to_string(),
        envelope.branch_epoch.to_string(),
        envelope.source_sequence.to_string(),
        envelope.entity_type.clone(),
        envelope.entity_id.clone(),
        envelope.operation.clone(),
        envelope.payload_media_type.clone(),
        envelope.payload_schema_version.to_string(),
        hex::encode(&envelope.payload_sha256),
        envelope.signing_key_id.clone(),
        envelope.signature_algorithm.clone(),
        envelope.emitted_at.clone(),
        envelope.expires_at.clone().unwrap_or_default(),
    ];
    canonical_fields(b"omnix-sync-envelope-v1\0", &fields)
}

pub fn canonical_receipt_bytes(receipt: &WireReceipt) -> Vec<u8> {
    let fields = vec![
        receipt.event_id.clone(),
        receipt.receiver_node_id.clone(),
        receipt.hq_epoch.to_string(),
        receipt.branch_epoch.to_string(),
        receipt.source_sequence.to_string(),
        receipt.contiguous_sequence.to_string(),
        receipt.outcome.clone(),
        receipt.conflict_class.clone().unwrap_or_default(),
        receipt.recorded_at.clone(),
        hex::encode(&receipt.receipt_sha256),
        receipt.signing_key_id.clone(),
        receipt.signature_algorithm.clone(),
    ];
    canonical_fields(b"omnix-sync-receipt-signature-v1\0", &fields)
}

fn canonical_fields(domain: &[u8], fields: &[String]) -> Vec<u8> {
    let mut bytes = domain.to_vec();
    for field in fields {
        bytes.extend_from_slice(&(field.len() as u64).to_be_bytes());
        bytes.extend_from_slice(field.as_bytes());
    }
    bytes
}

fn wire_from_outbox(event: &sync::OutboxEvent) -> SyncResult<WireEnvelope> {
    let destination_node_id = event
        .destination_node_id
        .clone()
        .ok_or(SyncActivationError::MissingRoute)?;
    Ok(WireEnvelope {
        protocol_version: u16::try_from(event.protocol_version)
            .map_err(|_| SyncActivationError::InvalidEnvelope("protocol version"))?,
        event_id: event.event_id.clone(),
        source_node_id: event.source_node_id.clone(),
        destination_node_id,
        branch_id: event.branch_id.clone(),
        hq_epoch: event.hq_epoch,
        branch_epoch: event.branch_epoch,
        source_sequence: event.source_sequence,
        entity_type: event.entity_type.clone(),
        entity_id: event.entity_id.clone(),
        operation: event.operation.clone(),
        payload_media_type: event.payload_media_type.clone(),
        payload_schema_version: event.payload_schema_version,
        payload: event.payload.clone(),
        payload_sha256: event.payload_sha256.clone(),
        signing_key_id: event.signing_key_id.clone(),
        signature_algorithm: event.signature_algorithm.clone(),
        emitted_at: event.emitted_at.clone(),
        expires_at: event.expires_at.clone(),
        signature: event.signature.clone(),
    })
}

/// Returns promoted, non-terminal envelopes in source order. Payloads remain
/// bounded by the protocol schema and signatures contain no private material.
pub async fn pending_wire_envelopes(pool: &SqlitePool) -> SyncResult<Vec<WireEnvelope>> {
    let events = sqlx::query_as::<_, sync::OutboxEvent>(
        "SELECT event_id, source_node_id, destination_node_id, branch_id,
                hq_epoch, branch_epoch, source_sequence, protocol_version,
                entity_type, entity_id, operation, payload_media_type,
                payload_schema_version, payload, payload_sha256,
                signing_key_id, signature_algorithm, signature, emitted_at, expires_at
         FROM sync_outbox
         WHERE state IN ('pending','leased','awaiting_receipt')
         ORDER BY source_sequence LIMIT 1024",
    )
    .fetch_all(pool)
    .await?;
    events.iter().map(wire_from_outbox).collect()
}

async fn due_destinations(pool: &SqlitePool) -> SyncResult<Vec<String>> {
    Ok(sqlx::query_scalar(
        "SELECT DISTINCT destination_node_id FROM sync_outbox
         WHERE destination_node_id IS NOT NULL
           AND state IN ('pending','leased','awaiting_receipt')
         ORDER BY destination_node_id",
    )
    .fetch_all(pool)
    .await?)
}

async fn peer_endpoint(pool: &SqlitePool, destination: &str) -> SyncResult<String> {
    sqlx::query_scalar(
        "SELECT endpoint_url FROM sync_peer_routes
         WHERE destination_node_id = ?1 AND enabled = 1 AND transport_kind = 'lan_http'",
    )
    .bind(destination)
    .fetch_optional(pool)
    .await?
    .ok_or(SyncActivationError::MissingRoute)
}

async fn local_dispatcher_node(pool: &SqlitePool, destination: &str) -> SyncResult<String> {
    sqlx::query_scalar(
        "SELECT local_node_id FROM sync_branch_routes
         WHERE destination_node_id = ?1 AND enabled = 1 ORDER BY branch_id LIMIT 1",
    )
    .bind(destination)
    .fetch_optional(pool)
    .await?
    .ok_or(SyncActivationError::MissingRoute)
}

fn timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn parse_timestamp(value: &str) -> SyncResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| SyncActivationError::InvalidEnvelope("timestamp"))
}

fn bounded_diagnostic(value: &str) -> String {
    value.chars().take(4096).collect()
}

// Snapshot recovery intentionally operates on the replicated branch projection,
// not the authoritative branch database. The caller supplies encryption from
// OS-protected custody; plaintext is never persisted.
pub trait SnapshotCipher: Send + Sync {
    fn encrypt(&self, plaintext: &[u8]) -> SyncResult<Vec<u8>>;
    fn decrypt(&self, ciphertext: &[u8]) -> SyncResult<Vec<u8>>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProjectionSnapshot {
    schema_version: i64,
    branch_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
    rows: Vec<SnapshotRow>,
    cursors: Vec<SnapshotCursorRow>,
}

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
struct SnapshotRow {
    branch_id: String,
    entity_type: String,
    entity_id: String,
    source_node_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
    source_sequence: i64,
    event_id: String,
    row_json: Option<String>,
    deleted: i64,
    applied_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
struct SnapshotCursorRow {
    receiver_node_id: String,
    source_node_id: String,
    branch_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
    contiguous_sequence: i64,
    updated_at: String,
}

pub async fn create_projection_snapshot(
    pool: &SqlitePool,
    cipher: &dyn SnapshotCipher,
    branch_id: &str,
    storage_path: &Path,
) -> SyncResult<Vec<u8>> {
    let fence: (i64, i64) =
        sqlx::query_as("SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1")
            .bind(branch_id)
            .fetch_optional(pool)
            .await?
            .ok_or(SyncActivationError::EpochFenced)?;
    let rows = sqlx::query_as::<_, SnapshotRow>(
        "SELECT branch_id, entity_type, entity_id, source_node_id, hq_epoch,
                branch_epoch, source_sequence, event_id, row_json, deleted, applied_at
         FROM sync_entity_state WHERE branch_id = ?1 ORDER BY entity_type, entity_id",
    )
    .bind(branch_id)
    .fetch_all(pool)
    .await?;
    let cursors = sqlx::query_as::<_, SnapshotCursorRow>(
        "SELECT receiver_node_id, source_node_id, branch_id, hq_epoch, branch_epoch,
                contiguous_sequence, updated_at
         FROM sync_cursors WHERE branch_id = ?1 ORDER BY source_node_id",
    )
    .bind(branch_id)
    .fetch_all(pool)
    .await?;
    let plaintext = serde_json::to_vec(&ProjectionSnapshot {
        schema_version: 1,
        branch_id: branch_id.to_string(),
        hq_epoch: fence.0,
        branch_epoch: fence.1,
        rows,
        cursors,
    })?;
    let ciphertext = cipher.encrypt(&plaintext)?;
    let temporary = temporary_snapshot_path(storage_path);
    std::fs::write(&temporary, &ciphertext)?;
    std::fs::rename(temporary, storage_path)?;
    Ok(Sha256::digest(&ciphertext).to_vec())
}

pub async fn restore_projection_snapshot(
    pool: &SqlitePool,
    cipher: &dyn SnapshotCipher,
    branch_id: &str,
    storage_path: &Path,
    expected_sha256: &[u8],
    encrypted_backup_path: &Path,
) -> SyncResult<()> {
    let ciphertext = std::fs::read(storage_path)?;
    if Sha256::digest(&ciphertext).as_slice() != expected_sha256 {
        return Err(SyncActivationError::Recovery("snapshot digest mismatch"));
    }
    let snapshot: ProjectionSnapshot = serde_json::from_slice(&cipher.decrypt(&ciphertext)?)?;
    let fence: (i64, i64) =
        sqlx::query_as("SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1")
            .bind(branch_id)
            .fetch_optional(pool)
            .await?
            .ok_or(SyncActivationError::EpochFenced)?;
    if snapshot.schema_version != 1
        || snapshot.branch_id != branch_id
        || (snapshot.hq_epoch, snapshot.branch_epoch) != fence
    {
        return Err(SyncActivationError::Recovery("snapshot target mismatch"));
    }
    create_projection_snapshot(pool, cipher, branch_id, encrypted_backup_path).await?;
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM sync_entity_state WHERE branch_id = ?1")
        .bind(branch_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sync_cursors WHERE branch_id = ?1")
        .bind(branch_id)
        .execute(&mut *tx)
        .await?;
    for row in snapshot.rows {
        sqlx::query("INSERT INTO sync_entity_state VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)")
            .bind(row.branch_id)
            .bind(row.entity_type)
            .bind(row.entity_id)
            .bind(row.source_node_id)
            .bind(row.hq_epoch)
            .bind(row.branch_epoch)
            .bind(row.source_sequence)
            .bind(row.event_id)
            .bind(row.row_json)
            .bind(row.deleted)
            .bind(row.applied_at)
            .execute(&mut *tx)
            .await?;
    }
    for cursor in snapshot.cursors {
        sqlx::query("INSERT INTO sync_cursors VALUES (?1,?2,?3,?4,?5,?6,?7)")
            .bind(cursor.receiver_node_id)
            .bind(cursor.source_node_id)
            .bind(cursor.branch_id)
            .bind(cursor.hq_epoch)
            .bind(cursor.branch_epoch)
            .bind(cursor.contiguous_sequence)
            .bind(cursor.updated_at)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

fn temporary_snapshot_path(path: &Path) -> PathBuf {
    let mut temporary = path.as_os_str().to_os_string();
    temporary.push(format!(".{}.tmp", Uuid::new_v4()));
    PathBuf::from(temporary)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegisteredSnapshot {
    pub snapshot_id: String,
    pub sha256: Vec<u8>,
}

#[derive(Debug, FromRow)]
struct StoredSnapshotMetadata {
    id: String,
    branch_id: String,
    created_by_node_id: String,
    hq_epoch: i64,
    branch_epoch: i64,
    schema_version: i64,
    byte_length: i64,
    chunk_count: i64,
    sha256: Vec<u8>,
    signature_key_id: String,
    signature: Vec<u8>,
    storage_ref: String,
    created_at: String,
}

/// Encrypts a projection snapshot, signs its immutable metadata with externally
/// held key material, and records replay cursors only after the file is durable.
pub async fn create_registered_projection_snapshot(
    pool: &SqlitePool,
    cipher: &dyn SnapshotCipher,
    signer: &dyn EnvelopeSigner,
    branch_id: &str,
    created_by_node_id: &str,
    storage_path: &Path,
    now: DateTime<Utc>,
) -> SyncResult<RegisteredSnapshot> {
    let creator: Option<(String, String)> = sqlx::query_as(
        "SELECT signing_key_id, key_status FROM sync_nodes
         WHERE id = ?1 AND deleted_at IS NULL",
    )
    .bind(created_by_node_id)
    .fetch_optional(pool)
    .await?;
    if !matches!(creator, Some((ref key_id, ref status))
        if key_id == signer.key_id() && matches!(status.as_str(), "active" | "rotation_pending"))
    {
        return Err(SyncActivationError::AuthorizationDenied);
    }
    let sha256 = create_projection_snapshot(pool, cipher, branch_id, storage_path).await?;
    let (hq_epoch, branch_epoch): (i64, i64) =
        sqlx::query_as("SELECT hq_epoch, branch_epoch FROM sync_epochs WHERE branch_id = ?1")
            .bind(branch_id)
            .fetch_optional(pool)
            .await?
            .ok_or(SyncActivationError::EpochFenced)?;
    let cursor_rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT source_node_id, contiguous_sequence FROM sync_cursors
         WHERE branch_id = ?1 ORDER BY source_node_id",
    )
    .bind(branch_id)
    .fetch_all(pool)
    .await?;
    let cursors = cursor_rows
        .iter()
        .map(
            |(source_node_id, contiguous_sequence)| sync::SnapshotCursor {
                source_node_id,
                contiguous_sequence: *contiguous_sequence,
            },
        )
        .collect::<Vec<_>>();
    let snapshot_id = Uuid::new_v4().to_string();
    let created_at = timestamp(now);
    let byte_length = i64::try_from(std::fs::metadata(storage_path)?.len())
        .map_err(|_| SyncActivationError::Recovery("snapshot is too large"))?;
    let storage_ref = storage_path
        .to_str()
        .ok_or(SyncActivationError::Recovery("snapshot path is not UTF-8"))?;
    let signature_bytes = canonical_snapshot_metadata_bytes(
        &snapshot_id,
        branch_id,
        created_by_node_id,
        hq_epoch,
        branch_epoch,
        1,
        byte_length,
        1,
        &sha256,
        signer.key_id(),
        storage_ref,
        &created_at,
    );
    let signature = signer.sign(&signature_bytes)?;
    sync::record_snapshot_metadata(
        pool,
        &sync::SnapshotMetadata {
            id: &snapshot_id,
            branch_id,
            created_by_node_id,
            hq_epoch,
            branch_epoch,
            schema_version: 1,
            byte_length,
            chunk_count: 1,
            sha256: &sha256,
            signature_key_id: signer.key_id(),
            signature: &signature,
            storage_ref,
            created_at: &created_at,
            cursors: &cursors,
        },
    )
    .await?;
    Ok(RegisteredSnapshot {
        snapshot_id,
        sha256,
    })
}

/// Verifies registered snapshot metadata before decryption, fences the affected
/// projection, creates an encrypted pre-restore backup, restores rows/cursors,
/// and records every recovery transition. Authoritative branch tables are never
/// replaced by this workflow.
pub async fn restore_registered_projection_snapshot(
    pool: &SqlitePool,
    cipher: &dyn SnapshotCipher,
    snapshot_id: &str,
    requested_by_node_id: &str,
    encrypted_backup_path: &Path,
    now: DateTime<Utc>,
) -> SyncResult<String> {
    let snapshot = sqlx::query_as::<_, StoredSnapshotMetadata>(
        "SELECT id, branch_id, created_by_node_id, hq_epoch, branch_epoch,
                schema_version, byte_length, chunk_count, sha256,
                signature_key_id, signature, storage_ref, created_at
         FROM sync_snapshots WHERE id = ?1 AND state = 'ready'",
    )
    .bind(snapshot_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SyncActivationError::Recovery("snapshot is not ready"))?;
    let (public_key, key_status, signing_key_id): (String, String, String) = sqlx::query_as(
        "SELECT signing_public_key, key_status, signing_key_id
         FROM sync_nodes WHERE id = ?1 AND deleted_at IS NULL",
    )
    .bind(&snapshot.created_by_node_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SyncActivationError::AuthorizationDenied)?;
    if !matches!(key_status.as_str(), "active" | "rotation_pending")
        || signing_key_id != snapshot.signature_key_id
    {
        return Err(SyncActivationError::KeyInactive);
    }
    verify_signature(
        &public_key,
        &canonical_snapshot_metadata_bytes(
            &snapshot.id,
            &snapshot.branch_id,
            &snapshot.created_by_node_id,
            snapshot.hq_epoch,
            snapshot.branch_epoch,
            snapshot.schema_version,
            snapshot.byte_length,
            snapshot.chunk_count,
            &snapshot.sha256,
            &snapshot.signature_key_id,
            &snapshot.storage_ref,
            &snapshot.created_at,
        ),
        &snapshot.signature,
    )?;
    let recovery_id = Uuid::new_v4().to_string();
    let at = timestamp(now);
    let backup_ref = encrypted_backup_path
        .to_str()
        .ok_or(SyncActivationError::Recovery("backup path is not UTF-8"))?;
    sync::request_recovery(
        pool,
        &sync::RecoveryMetadata {
            id: &recovery_id,
            snapshot_id: &snapshot.id,
            requested_by_node_id,
            target_branch_id: &snapshot.branch_id,
            target_hq_epoch: snapshot.hq_epoch,
            target_branch_epoch: snapshot.branch_epoch,
            mode: "replace_from_snapshot",
            pre_restore_backup_ref: Some(backup_ref),
            requested_at: &at,
        },
    )
    .await?;
    audit_recovery_transition(pool, &recovery_id, &snapshot.branch_id, "requested", &at).await?;
    sync::update_recovery_state(
        pool,
        &recovery_id,
        "requested",
        "snapshot_verified",
        &at,
        None,
    )
    .await?;
    audit_recovery_transition(
        pool,
        &recovery_id,
        &snapshot.branch_id,
        "snapshot_verified",
        &at,
    )
    .await?;
    sqlx::query(
        "INSERT INTO sync_recovery_fences
             (branch_id, recovery_id, read_only, fenced_at)
         VALUES (?1, ?2, 1, ?3)",
    )
    .bind(&snapshot.branch_id)
    .bind(&recovery_id)
    .bind(&at)
    .execute(pool)
    .await?;

    let restore_result = restore_projection_snapshot(
        pool,
        cipher,
        &snapshot.branch_id,
        Path::new(&snapshot.storage_ref),
        &snapshot.sha256,
        encrypted_backup_path,
    )
    .await;
    if let Err(error) = restore_result {
        let failure = bounded_diagnostic(&error.to_string());
        sync::update_recovery_state(
            pool,
            &recovery_id,
            "snapshot_verified",
            "aborted",
            &timestamp(Utc::now()),
            Some(&failure),
        )
        .await?;
        release_recovery_fence(pool, &snapshot.branch_id, &recovery_id, Utc::now()).await?;
        audit_recovery_transition(
            pool,
            &recovery_id,
            &snapshot.branch_id,
            "aborted",
            &timestamp(Utc::now()),
        )
        .await?;
        return Err(error);
    }

    for (expected, next) in [
        ("snapshot_verified", "snapshot_restored"),
        ("snapshot_restored", "replaying"),
        ("replaying", "complete"),
    ] {
        let transition_at = timestamp(Utc::now());
        sync::update_recovery_state(pool, &recovery_id, expected, next, &transition_at, None)
            .await?;
        audit_recovery_transition(
            pool,
            &recovery_id,
            &snapshot.branch_id,
            next,
            &transition_at,
        )
        .await?;
    }
    release_recovery_fence(pool, &snapshot.branch_id, &recovery_id, Utc::now()).await?;
    Ok(recovery_id)
}

fn canonical_snapshot_metadata_bytes(
    snapshot_id: &str,
    branch_id: &str,
    created_by_node_id: &str,
    hq_epoch: i64,
    branch_epoch: i64,
    schema_version: i64,
    byte_length: i64,
    chunk_count: i64,
    sha256: &[u8],
    signature_key_id: &str,
    storage_ref: &str,
    created_at: &str,
) -> Vec<u8> {
    canonical_fields(
        b"omnix-sync-snapshot-metadata-v1\0",
        &[
            snapshot_id.to_string(),
            branch_id.to_string(),
            created_by_node_id.to_string(),
            hq_epoch.to_string(),
            branch_epoch.to_string(),
            schema_version.to_string(),
            byte_length.to_string(),
            chunk_count.to_string(),
            hex::encode(sha256),
            signature_key_id.to_string(),
            storage_ref.to_string(),
            created_at.to_string(),
        ],
    )
}

async fn audit_recovery_transition(
    pool: &SqlitePool,
    recovery_id: &str,
    branch_id: &str,
    state: &str,
    at: &str,
) -> SyncResult<()> {
    sqlx::query(
        "INSERT INTO audit_log (
             id, user_id, permission_key, action, outcome, risk_level,
             branch_id, entity_type, entity_id, metadata, created_at
         ) VALUES (?1, NULL, 'sync.recovery', ?2, 'allowed', 'high',
                   ?3, 'sync_recovery', ?4, ?5, ?6)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(format!("sync.recovery.{state}"))
    .bind(branch_id)
    .bind(recovery_id)
    .bind(serde_json::json!({ "state": state }).to_string())
    .bind(at)
    .execute(pool)
    .await?;
    Ok(())
}

async fn release_recovery_fence(
    pool: &SqlitePool,
    branch_id: &str,
    recovery_id: &str,
    now: DateTime<Utc>,
) -> SyncResult<()> {
    let released = sqlx::query(
        "UPDATE sync_recovery_fences
         SET read_only = 0, released_at = ?3
         WHERE branch_id = ?1 AND recovery_id = ?2 AND read_only = 1",
    )
    .bind(branch_id)
    .bind(recovery_id)
    .bind(timestamp(now))
    .execute(pool)
    .await?;
    if released.rows_affected() != 1 {
        return Err(SyncActivationError::Recovery("recovery fence was lost"));
    }
    Ok(())
}
