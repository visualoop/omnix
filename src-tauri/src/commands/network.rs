// Tauri commands for LAN multi-device server control + pairing.

use crate::network::{discover_servers, random_pairing_code, start_server, DiscoveredServer, ServerHandle, ServerState};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePoolOptions;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

pub struct NetworkState {
    pub server: Mutex<Option<ServerHandle>>,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            server: Mutex::new(None),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub url: Option<String>,
    pub mdns_active: bool,
}

fn db_url(app: &tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path: PathBuf = dir.join("omnix.db");
    Ok(format!("sqlite:{}", path.display()))
}

#[tauri::command]
pub async fn start_lan_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<NetworkState>>,
    port: u16,
    business_name: String,
) -> Result<ServerStatus, String> {
    // Already running?
    if state.server.lock().is_some() {
        return Err("Server already running".to_string());
    }

    let url = db_url(&app)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| format!("Failed to open DB: {}", e))?;

    let server_state = ServerState {
        pool,
        business_name: Arc::new(parking_lot::RwLock::new(business_name)),
    };

    let handle = start_server(server_state, port).await?;
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let public_url = format!("http://{}:{}", local_ip, handle.addr.port());
    let mdns = handle.mdns_handle.is_some();

    *state.server.lock() = Some(handle);

    Ok(ServerStatus {
        running: true,
        url: Some(public_url),
        mdns_active: mdns,
    })
}

#[tauri::command]
pub async fn stop_lan_server(state: tauri::State<'_, Arc<NetworkState>>) -> Result<(), String> {
    let handle = state.server.lock().take();
    if let Some(h) = handle {
        if let Some(daemon) = h.mdns_handle {
            let _ = daemon.shutdown();
        }
        let _ = h.shutdown_tx.send(());
    }
    Ok(())
}

#[tauri::command]
pub fn lan_server_status(state: tauri::State<'_, Arc<NetworkState>>) -> ServerStatus {
    let server = state.server.lock();
    match &*server {
        Some(h) => {
            let local_ip = local_ip_address::local_ip()
                .map(|ip| ip.to_string())
                .unwrap_or_else(|_| "127.0.0.1".to_string());
            ServerStatus {
                running: true,
                url: Some(format!("http://{}:{}", local_ip, h.addr.port())),
                mdns_active: h.mdns_handle.is_some(),
            }
        }
        None => ServerStatus {
            running: false,
            url: None,
            mdns_active: false,
        },
    }
}

#[derive(Debug, Serialize)]
pub struct PairingCodeInfo {
    pub code: String,
    pub expires_at: String,
}

/// Generate a 6-digit pairing code (valid 5 minutes)
#[tauri::command]
pub async fn generate_pairing_code(app: tauri::AppHandle) -> Result<PairingCodeInfo, String> {
    let url = db_url(&app)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .map_err(|e| e.to_string())?;

    let code = random_pairing_code();

    sqlx::query(
        "INSERT INTO pairing_codes (code, expires_at) VALUES (?1, datetime('now', '+5 minutes'))",
    )
    .bind(&code)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    pool.close().await;

    Ok(PairingCodeInfo {
        code,
        expires_at: "5 minutes".to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PairedDevice {
    pub token: String,
    pub device_name: String,
    pub device_fingerprint: Option<String>,
    pub created_at: String,
    pub last_seen_at: Option<String>,
    pub revoked: i64,
}

#[tauri::command]
pub async fn list_paired_devices(app: tauri::AppHandle) -> Result<Vec<PairedDevice>, String> {
    let url = db_url(&app)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, Option<String>, String, Option<String>, i64)> = sqlx::query_as(
        "SELECT token, device_name, device_fingerprint, created_at, last_seen_at, revoked
         FROM api_tokens ORDER BY created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    pool.close().await;

    Ok(rows
        .into_iter()
        .map(|(token, device_name, device_fingerprint, created_at, last_seen_at, revoked)| {
            PairedDevice {
                token: format!("{}...", &token[..8.min(token.len())]),  // Don't leak full token
                device_name,
                device_fingerprint,
                created_at,
                last_seen_at,
                revoked,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn revoke_paired_device(
    app: tauri::AppHandle,
    token_prefix: String,
) -> Result<(), String> {
    let url = db_url(&app)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE api_tokens SET revoked = 1 WHERE token LIKE ?1 || '%'")
        .bind(&token_prefix.replace("...", ""))
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    pool.close().await;
    Ok(())
}

#[tauri::command]
pub fn discover_lan_servers(timeout_ms: Option<u64>) -> Result<Vec<DiscoveredServer>, String> {
    discover_servers(timeout_ms.unwrap_or(2000))
}
