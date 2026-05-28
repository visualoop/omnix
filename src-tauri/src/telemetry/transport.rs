//! HTTPS transport with retry logic.

use reqwest::{Client, StatusCode};
use serde::Serialize;
use std::time::Duration;

#[derive(thiserror::Error, Debug)]
pub enum TransportError {
    #[error("Authentication failed (401)")]
    Auth,
    #[error("Network error: {0}")]
    Network(String),
    #[error("Server error: {0}")]
    Server(String),
}

#[derive(Debug, Clone, Serialize)]
struct TelemetryBatch {
    events: Vec<serde_json::Value>,
    machine_id: String,
    app_version: String,
}

pub async fn post_events(
    endpoint: &str,
    machine_token: &str,
    machine_id: &str,
    app_version: &str,
    events: Vec<serde_json::Value>,
) -> Result<(), TransportError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| TransportError::Network(e.to_string()))?;

    let batch = TelemetryBatch {
        events,
        machine_id: machine_id.to_string(),
        app_version: app_version.to_string(),
    };

    let url = format!("{}/api/telemetry/events", endpoint);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", machine_token))
        .header("X-Omnix-Machine-Id", machine_id)
        .header("X-Omnix-App-Version", app_version)
        .json(&batch)
        .send()
        .await
        .map_err(|e| TransportError::Network(e.to_string()))?;

    match response.status() {
        StatusCode::OK | StatusCode::CREATED => Ok(()),
        StatusCode::UNAUTHORIZED => Err(TransportError::Auth),
        status if status.is_client_error() => {
            Err(TransportError::Server(format!("Client error: {}", status)))
        }
        status if status.is_server_error() => {
            Err(TransportError::Server(format!("Server error: {}", status)))
        }
        status => Err(TransportError::Server(format!("Unexpected status: {}", status))),
    }
}
