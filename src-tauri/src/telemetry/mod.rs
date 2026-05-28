//! Telemetry SDK for Omnix desktop app.
//!
//! Principles (per Plan 05):
//! 1. No business data leaves the device (no customer names, sale amounts, prescriptions)
//! 2. Opt-out at any time (Settings → Privacy toggle)
//! 3. Best-effort, never blocking (failures never affect user's work)
//! 4. Encrypted in transit, signed (HTTPS + machine token)
//! 5. Bounded local storage (queue capped at 1 MB)
//! 6. Inspectable (`omnix --telemetry-dump` prints queue)
//! 7. Geolocation is server-side only (we send IP, server does lat/long lookup)

pub mod consent;
pub mod dispatcher;
pub mod event;
pub mod heartbeat;
pub mod store;
pub mod transport;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Debug => "debug",
            Severity::Info => "info",
            Severity::Warn => "warn",
            Severity::Error => "error",
            Severity::Fatal => "fatal",
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum TelemetryError {
    #[error("Store error: {0}")]
    Store(#[from] store::StoreError),
    #[error("Transport error: {0}")]
    Transport(#[from] transport::TransportError),
    #[error("Consent error: {0}")]
    Consent(#[from] consent::ConsentError),
    #[error("Consent not given")]
    ConsentNotGiven,
}

/// Main telemetry interface. Fire-and-forget event emission.
pub trait Telemetry: Send + Sync {
    /// Emit an event. Always returns immediately. Errors are logged, not propagated.
    fn emit<T: Serialize>(&self, event_type: &str, severity: Severity, payload: &T);

    /// Enable/disable at runtime; persists to local config.
    fn set_enabled(&self, enabled: bool);

    /// Currently enabled (consented or trial-mode default).
    fn is_enabled(&self) -> bool;

    /// Force flush the queue. Useful before shutdown, app updates.
    fn flush(&self) -> impl std::future::Future<Output = Result<(), TelemetryError>> + Send;
}

/// Default implementation backed by SQLite queue + HTTPS dispatcher.
pub struct DefaultTelemetry {
    store: Arc<store::TelemetryStore>,
    consent: Arc<RwLock<consent::ConsentState>>,
    endpoint: String,
    machine_id: String,
    app_version: String,
}

impl DefaultTelemetry {
    pub fn new(
        app_data_dir: std::path::PathBuf,
        endpoint: String,
        machine_id: String,
        app_version: String,
    ) -> Result<Self, TelemetryError> {
        let store = Arc::new(store::TelemetryStore::new(app_data_dir)?);
        let consent = Arc::new(RwLock::new(consent::ConsentState::load()?));

        Ok(Self {
            store,
            consent,
            endpoint,
            machine_id,
            app_version,
        })
    }

    /// Start the background dispatcher loop (call once at app start).
    pub fn start_dispatcher(self: Arc<Self>) {
        tokio::spawn(async move {
            dispatcher::run_loop(
                self.store.clone(),
                self.consent.clone(),
                self.endpoint.clone(),
                self.machine_id.clone(),
                self.app_version.clone(),
            )
            .await;
        });
    }
}

impl Telemetry for DefaultTelemetry {
    fn emit<T: Serialize>(&self, event_type: &str, severity: Severity, payload: &T) {
        // Fire-and-forget: serialize, sanitize, enqueue. Never blocks caller.
        let payload_json = match serde_json::to_value(payload) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("Telemetry: failed to serialize event {}: {}", event_type, e);
                return;
            }
        };

        let sanitized = event::sanitize_payload(payload_json);
        let event = event::TelemetryEvent {
            event_type: event_type.to_string(),
            severity,
            payload: sanitized,
            enqueued_at: chrono::Utc::now(),
        };

        if let Err(e) = self.store.enqueue(event) {
            log::warn!("Telemetry: failed to enqueue event: {}", e);
        }
    }

    fn set_enabled(&self, enabled: bool) {
        let mut consent = self.consent.blocking_write();
        consent.set_enabled(enabled);
        if let Err(e) = consent.save() {
            log::error!("Telemetry: failed to save consent state: {}", e);
        }
    }

    fn is_enabled(&self) -> bool {
        self.consent.blocking_read().is_enabled()
    }

    async fn flush(&self) -> Result<(), TelemetryError> {
        if !self.is_enabled() {
            return Err(TelemetryError::ConsentNotGiven);
        }

        dispatcher::flush_once(
            &self.store,
            &self.endpoint,
            &self.machine_id,
            &self.app_version,
        )
        .await
        .map_err(|e| TelemetryError::Transport(transport::TransportError::Network(e.to_string())))
    }
}
