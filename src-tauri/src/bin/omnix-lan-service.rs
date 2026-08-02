//! omnix-lan-service — Windows service binary that runs the LAN server
//! independently of the Tauri UI.
//!
//! Registered by the Tauri app via install_windows_service(); Windows then
//! starts + stops it via services.msc / sc.exe / Task Manager.
//!
//! What it does:
//!   1. On start: open %APPDATA%\co.ke.omnix.app\omnix.db, read the persisted
//!      network mode + port + business name from the `settings` table.
//!   2. If mode == 'master', bind the axum LAN server on the configured port.
//!   3. Handle service control events (Stop, Shutdown, Interrogate).
//!   4. On stop, send shutdown to the server task + report Stopped to SCM.
//!
//! On non-Windows the binary compiles to a stub so `cargo build` works
//! everywhere without conditional target hacks.

#[cfg(not(windows))]
fn main() {
    eprintln!("omnix-lan-service is Windows-only. This is a stub on non-Windows platforms.");
}

#[cfg(windows)]
fn main() -> windows_service::Result<()> {
    windows_impl::run()
}

#[cfg(windows)]
mod windows_impl {
    use std::ffi::OsString;
    use std::sync::mpsc;
    use std::time::Duration;

    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::service_dispatcher;
    use windows_service::{define_windows_service, Result};

    const SERVICE_NAME: &str = "OmnixLAN";
    const SERVICE_TYPE: ServiceType = ServiceType::OWN_PROCESS;

    define_windows_service!(ffi_service_main, service_main);

    pub fn run() -> Result<()> {
        service_dispatcher::start(SERVICE_NAME, ffi_service_main)
    }

    fn service_main(_arguments: Vec<OsString>) {
        if let Err(e) = run_service() {
            eprintln!("service failed: {}", e);
        }
    }

    fn run_service() -> Result<()> {
        let (shutdown_tx, shutdown_rx) = mpsc::channel();

        let event_handler = move |control: ServiceControl| -> ServiceControlHandlerResult {
            match control {
                ServiceControl::Stop | ServiceControl::Shutdown => {
                    let _ = shutdown_tx.send(());
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

        status_handle.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Running,
            controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;

        // Start the LAN server in a Tokio runtime we own.
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        let server_handle = runtime.spawn(async {
            if let Err(e) = start_lan_server_headless().await {
                eprintln!("[omnix-lan-service] LAN server exited with error: {}", e);
            }
        });

        // Block until the SCM signals stop.
        loop {
            match shutdown_rx.recv_timeout(Duration::from_secs(60)) {
                Ok(_) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        // Graceful shutdown: abort the server task + wait a moment for it
        // to release the socket, then tell SCM we're stopped.
        server_handle.abort();
        runtime.block_on(async {
            tokio::time::sleep(Duration::from_millis(300)).await;
        });

        status_handle.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;

        Ok(())
    }

    async fn start_lan_server_headless() -> std::result::Result<(), String> {
        use sqlx::sqlite::SqlitePoolOptions;

        // Use the desktop application's stable Tauri identity. The old service
        // path (`com.omnix.pos`) was a separate database and could not redeem
        // grants issued by the desktop app.
        let app_data = std::env::var("APPDATA").map_err(|e| format!("APPDATA env: {}", e))?;
        let app_dir = std::path::Path::new(&app_data).join(omnix_lib::APP_IDENTIFIER);
        let db_path = app_dir.join("omnix.db");
        if !db_path.exists() {
            return Err(format!(
                "omnix.db not found at {} — open the app once as a user to initialise it",
                db_path.display()
            ));
        }

        let url = format!("sqlite:{}", db_path.display());
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
            .map_err(|e| format!("open db: {}", e))?;
        omnix_lib::install_sync_capture(&pool)
            .await
            .map_err(|e| format!("activate sync capture: {e}"))?;

        // Read config from the settings + business tables.
        let port_row: Option<String> =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = 'network.server_port'")
                .fetch_optional(&pool)
                .await
                .map_err(|e| format!("query port: {}", e))?;
        let port: u16 = port_row.and_then(|s| s.parse::<u16>().ok()).unwrap_or(8765);

        let mode: String = sqlx::query_scalar::<_, String>(
            "SELECT value FROM settings WHERE key = 'network.mode'",
        )
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("query mode: {}", e))?
        .unwrap_or_else(|| "standalone".to_string());

        let business_name: String =
            sqlx::query_scalar::<_, String>("SELECT name FROM business LIMIT 1")
                .fetch_optional(&pool)
                .await
                .map_err(|e| format!("query business: {}", e))?
                .unwrap_or_else(|| "Omnix".to_string());
        if mode != "master" {
            eprintln!(
                "[omnix-lan-service] mode is '{}', not 'master' — idling. Change to master in the app to start serving.",
                mode
            );
            // Idle forever so SCM keeps showing Running until Stop.
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        }

        eprintln!(
            "[omnix-lan-service] starting LAN server on port {} (business: {})",
            port, business_name
        );

        let sync = omnix_lib::sync_activation::coordinator_from_environment(pool.clone())
            .await
            .map_err(|error| format!("configure branch sync: {error}"))?;
        if let Some(coordinator) = sync.clone() {
            omnix_lib::sync_activation::start_dispatcher(coordinator);
        }
        let server_state = omnix_lib::network::ServerState {
            pool: pool.clone(),
            business_name: std::sync::Arc::new(parking_lot::RwLock::new(business_name.clone())),
            sync,
        };
        let handle = omnix_lib::network::start_server(server_state, port)
            .await
            .map_err(|e| format!("bind server: {}", e))?;
        let read_only_port = port
            .checked_add(1)
            .ok_or_else(|| "paired-device port leaves no read-only browser port".to_string())?;
        let advertised_ip = local_ip_address::local_ip()
            .unwrap_or_else(|_| std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST));
        let tls_config = omnix_lib::network::lan_tls::LanTlsConfig::from_environment(
            app_dir.join("lan-tls"),
            advertised_ip,
        );
        let advertised_host = tls_config.advertised_hostname();
        let url_host = if advertised_host.contains(':') {
            format!("[{advertised_host}]")
        } else {
            advertised_host
        };
        let origin = format!("https://{url_host}:{read_only_port}");
        let read_only_state =
            omnix_lib::network::read_only_web::ReadOnlyWebState::new(pool, origin, business_name);
        let read_only_handle =
            omnix_lib::network::start_read_only_server(read_only_state, read_only_port, tls_config)
                .await
                .map_err(|e| format!("bind read-only browser server: {e}"))?;

        // Keep both listeners running until this task is aborted by the SCM stop path.
        // Their handles own the shutdown senders; dropping them wakes each server.
        std::mem::forget(handle);
        std::mem::forget(read_only_handle);
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
    }
}
