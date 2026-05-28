//! Background dispatcher loop with exponential backoff.

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::sleep;

use crate::telemetry::consent::ConsentState;
use crate::telemetry::store::{TelemetryStore, StoreError};
use crate::telemetry::transport::{self, TransportError};

const TICK_INTERVAL_SECS: u64 = 60;
const BATCH_SIZE: usize = 50;

/// Main dispatcher loop. Runs forever in background task.
pub async fn run_loop(
    store: Arc<TelemetryStore>,
    consent: Arc<RwLock<ConsentState>>,
    endpoint: String,
    machine_id: String,
    app_version: String,
) {
    let mut consecutive_failures = 0;

    loop {
        sleep(Duration::from_secs(TICK_INTERVAL_SECS)).await;

        // Check consent
        if !consent.read().await.is_enabled() {
            continue;
        }

        // TODO: Check network connectivity (for now assume online)

        // Get machine token from stronghold
        let machine_token = match get_machine_token().await {
            Ok(token) => token,
            Err(e) => {
                log::warn!("Telemetry: failed to get machine token: {}", e);
                continue;
            }
        };

        let now_ms = chrono::Utc::now().timestamp_millis();

        match dispatch_batch(&store, &endpoint, &machine_token, &machine_id, &app_version, now_ms).await {
            Ok(sent_count) => {
                if sent_count > 0 {
                    log::debug!("Telemetry: sent {} events", sent_count);
                    consecutive_failures = 0;
                }
            }
            Err(e) => {
                log::warn!("Telemetry: dispatch failed: {}", e);
                consecutive_failures += 1;

                if consecutive_failures >= 5 {
                    log::warn!("Telemetry: 5 consecutive failures, sleeping 5 min");
                    sleep(Duration::from_secs(300)).await;
                    consecutive_failures = 0;
                }
            }
        }
    }
}

/// Dispatch one batch. Returns number of events sent.
async fn dispatch_batch(
    store: &TelemetryStore,
    endpoint: &str,
    machine_token: &str,
    machine_id: &str,
    app_version: &str,
    now_ms: i64,
) -> Result<usize, DispatchError> {
    let batch = store.take_batch(BATCH_SIZE, now_ms)?;

    if batch.is_empty() {
        return Ok(0);
    }

    let ids: Vec<i64> = batch.iter().map(|e| e.id).collect();
    let events: Vec<serde_json::Value> = batch
        .iter()
        .filter_map(|e| serde_json::from_str(&e.payload).ok())
        .collect();

    match transport::post_events(endpoint, machine_token, machine_id, app_version, events).await {
        Ok(_) => {
            store.delete_batch(&ids)?;
            Ok(ids.len())
        }
        Err(TransportError::Auth) => {
            log::warn!("Telemetry: auth failed, pausing");
            Err(DispatchError::Auth)
        }
        Err(TransportError::Network(msg)) => {
            let delay_ms = exponential_backoff(batch[0].attempts);
            store.reschedule_batch(&ids, delay_ms)?;
            Err(DispatchError::Network(msg))
        }
        Err(TransportError::Server(msg)) => {
            store.reschedule_batch(&ids, 60_000)?; // Retry in 1 min
            Err(DispatchError::Server(msg))
        }
    }
}

/// One-shot flush (for app shutdown).
pub async fn flush_once(
    store: &TelemetryStore,
    endpoint: &str,
    machine_id: &str,
    app_version: &str,
) -> Result<(), DispatchError> {
    let machine_token = get_machine_token().await?;
    let now_ms = chrono::Utc::now().timestamp_millis();

    dispatch_batch(store, endpoint, &machine_token, machine_id, app_version, now_ms).await?;

    Ok(())
}

/// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (cap at 60s).
fn exponential_backoff(attempts: i32) -> i64 {
    let delay_secs = 2_i64.pow(attempts.min(5) as u32);
    (delay_secs.min(60) * 1000) as i64
}

/// Get machine token from stronghold (placeholder — actual impl uses tauri-plugin-stronghold).
async fn get_machine_token() -> Result<String, DispatchError> {
    // TODO: Wire to tauri-plugin-stronghold
    // For now, return a placeholder
    Ok("placeholder_token".to_string())
}

#[derive(thiserror::Error, Debug)]
pub enum DispatchError {
    #[error("Store error: {0}")]
    Store(#[from] StoreError),
    #[error("Auth error")]
    Auth,
    #[error("Network error: {0}")]
    Network(String),
    #[error("Server error: {0}")]
    Server(String),
    #[error("Token error: {0}")]
    Token(String),
}
