//! Heartbeat collector — 30-min health rollups.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

use crate::telemetry::{Severity, Telemetry};

const HEARTBEAT_INTERVAL_SECS: u64 = 1800; // 30 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    pub session_id: String,
    pub interval_minutes: u32,
    pub active_module: String,
    pub branch_count: u32,
    pub user_count: u32,
    pub products_count: u32,
    pub sales_count_24h: u32,
    pub lan_peer_count: u32,
    pub integration_status: IntegrationStatus,
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationStatus {
    pub etims_configured: bool,
    pub mpesa_configured: bool,
    pub sha_configured: bool,
    pub paystack_configured: bool,
}

/// Start the heartbeat loop (call once at app start).
pub fn start_heartbeat_loop<T: Telemetry + 'static>(
    telemetry: Arc<T>,
    session_id: String,
) {
    tokio::spawn(async move {
        loop {
            sleep(Duration::from_secs(HEARTBEAT_INTERVAL_SECS)).await;

            let heartbeat = collect_heartbeat(&session_id).await;
            telemetry.emit("heartbeat", Severity::Info, &heartbeat);
        }
    });
}

/// Collect heartbeat data from the app's SQLite database.
/// TODO: Wire to actual database queries.
async fn collect_heartbeat(session_id: &str) -> Heartbeat {
    // Placeholder implementation — replace with actual DB queries
    Heartbeat {
        session_id: session_id.to_string(),
        interval_minutes: 30,
        active_module: "core".to_string(),
        branch_count: 1,
        user_count: 1,
        products_count: 0,
        sales_count_24h: 0,
        lan_peer_count: 0,
        integration_status: IntegrationStatus {
            etims_configured: false,
            mpesa_configured: false,
            sha_configured: false,
            paystack_configured: false,
        },
        last_sync_at: None,
    }
}
