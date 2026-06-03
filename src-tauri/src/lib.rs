mod commands;
mod db;
mod license;
mod network;
// mod telemetry; // Phase 10 — activate when website/telemetry endpoint is live

use tauri_plugin_sql::{Migration, MigrationKind};

/// Wrap a fatal startup error, write it to a crash log, show a MessageBox,
/// and exit cleanly — instead of the normal Rust panic that silently kills
/// a windows-subsystem GUI binary.
fn report_fatal(err: &str) {
    let log_path = std::env::var("LOCALAPPDATA")
        .ok()
        .map(|p| std::path::PathBuf::from(p).join("omnix").join("crash.log"));

    let timestamp = chrono::Utc::now().to_rfc3339();
    let entry = format!(
        "[{}] FATAL: {}\n\nbacktrace:\n{}\n\n---\n",
        timestamp,
        err,
        std::backtrace::Backtrace::capture(),
    );

    if let Some(path) = &log_path {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .and_then(|mut f| std::io::Write::write_all(&mut f, entry.as_bytes()));
    }

    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        unsafe extern "system" {
            fn MessageBoxW(
                hwnd: *mut std::ffi::c_void,
                text: *const u16,
                caption: *const u16,
                u_type: u32,
            ) -> i32;
        }
        let title: Vec<u16> = OsStr::new("Omnix — Startup Error")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let body_str = format!(
            "{}\n\nA crash log was saved to:\n%LOCALAPPDATA%\\omnix\\crash.log\n\nPlease send that file to support.",
            err,
        );
        let body: Vec<u16> = OsStr::new(&body_str)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            MessageBoxW(std::ptr::null_mut(), body.as_ptr(), title.as_ptr(), 0x10);
        }
    }
}

/// Ensure the SQLite database directory exists before tauri-plugin-sql
/// tries to open it. The plugin opens at $APPDATA/<identifier>/omnix.db
/// but does NOT create the parent directory itself.
fn ensure_app_data_dir() {
    let identifier = "ke.co.sokoos.app";
    if let Ok(appdata) = std::env::var("APPDATA") {
        let dir = std::path::PathBuf::from(&appdata).join(identifier);
        let _ = std::fs::create_dir_all(&dir);
    }
    if let Ok(localdata) = std::env::var("LOCALAPPDATA") {
        let dir = std::path::PathBuf::from(&localdata).join(identifier);
        let _ = std::fs::create_dir_all(&dir);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install panic hook so unwinding panics get logged + visible
    std::panic::set_hook(Box::new(|info| {
        let msg = format!(
            "Panic at {}:\n{}",
            info.location()
                .map(|l| format!("{}:{}", l.file(), l.line()))
                .unwrap_or_else(|| "unknown".to_string()),
            info,
        );
        report_fatal(&msg);
    }));

    // Pre-create AppData directory so SQL plugin can find/create the DB
    ensure_app_data_dir();

    // Catch any startup error and surface it
    let result = std::panic::catch_unwind(|| run_inner());
    if let Err(err) = result {
        let msg = if let Some(s) = err.downcast_ref::<String>() {
            s.clone()
        } else if let Some(s) = err.downcast_ref::<&str>() {
            s.to_string()
        } else {
            "Unknown startup error".to_string()
        };
        report_fatal(&msg);
        std::process::exit(1);
    }
}

fn run_inner() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create core tables",
            sql: include_str!("../migrations/001_core.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create inventory tables",
            sql: include_str!("../migrations/002_inventory.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create sales tables",
            sql: include_str!("../migrations/003_sales.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create pharmacy tables",
            sql: include_str!("../migrations/004_pharmacy.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create accounting tables",
            sql: include_str!("../migrations/005_accounting.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create payment provider tables",
            sql: include_str!("../migrations/006_payments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create etims tables",
            sql: include_str!("../migrations/007_etims.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "create insurance tables",
            sql: include_str!("../migrations/008_insurance.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "create license tables",
            sql: include_str!("../migrations/009_license.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create drug interactions tables",
            sql: include_str!("../migrations/010_interactions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create network tables",
            sql: include_str!("../migrations/011_network.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create ERP extension tables (PO, returns, stock take, patients)",
            sql: include_str!("../migrations/012_erp_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "create customer & supplier payment settlement tables",
            sql: include_str!("../migrations/013_payments_settlement.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "loyalty + doctors + substitutions + refills + promotions + petty cash",
            sql: include_str!("../migrations/014_pharmacy_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "local trial mode tracking",
            sql: include_str!("../migrations/015_trial_mode.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "multi-branch support + stock transfers",
            sql: include_str!("../migrations/016_branches.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "HR: employees, departments, attendance, leave, payroll",
            sql: include_str!("../migrations/017_hr.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "Quotations and invoicing",
            sql: include_str!("../migrations/018_invoicing.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "Banking, transactions, reconciliation",
            sql: include_str!("../migrations/019_banking.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "Pharmacy compliance: pharmacist licensing, PPB fields, allergies",
            sql: include_str!("../migrations/020_pharmacy_compliance.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "Retail: variants, brands, price lists, laybys, shrinkage, special orders",
            sql: include_str!("../migrations/021_retail.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "Recurring invoice templates and credit notes",
            sql: include_str!("../migrations/022_recurring_invoices.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "Cold chain temperature monitoring",
            sql: include_str!("../migrations/023_cold_chain.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "Tips and gratuities",
            sql: include_str!("../migrations/024_tips.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "Product unit-of-measure conversions (carton/box)",
            sql: include_str!("../migrations/025_product_uoms.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "Payment provider extensions (Daraja passkey, shortcode, insurance fields)",
            sql: include_str!("../migrations/026_payment_provider_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "License entitlements: modules, max_devices, activation token",
            sql: include_str!("../migrations/027_license_entitlements.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 28,
            description: "Single-module trial: module + server_registered columns",
            sql: include_str!("../migrations/028_trial_module.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 29,
            description: "Granular RBAC: roles, permissions, groups, scopes, overrides",
            sql: include_str!("../migrations/029_rbac.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 30,
            description: "Audit log for high/critical permission-gated actions",
            sql: include_str!("../migrations/030_audit_log.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 31,
            description: "Hardware module: quotations, delivery notes, accounts, commissions",
            sql: include_str!("../migrations/031_hardware.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 32,
            description: "Hospitality core: dining areas/tables, kitchen stations, menu",
            sql: include_str!("../migrations/032_hospitality_core.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 33,
            description: "Hospitality orders: order lifecycle + kitchen items",
            sql: include_str!("../migrations/033_hospitality_orders.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 34,
            description: "Hospitality service charge rules + allocations",
            sql: include_str!("../migrations/034_hospitality_service_charge.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 35,
            description: "Hospitality rooms: room types, rooms, rate plans, guests, bookings",
            sql: include_str!("../migrations/035_hospitality_rooms.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 36,
            description: "Hospitality folios: guest folios, charges, payments",
            sql: include_str!("../migrations/036_hospitality_folios.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 37,
            description: "Hospitality recipes, costing & wastage",
            sql: include_str!("../migrations/037_hospitality_recipes.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(std::sync::Arc::new(commands::NetworkState::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:omnix.db", migrations)
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    None,
                ))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::hash_password,
            commands::verify_password,
            commands::get_machine_info,
            commands::verify_license,
            commands::verify_module_entitled,
            commands::create_backup,
            commands::list_backups,
            commands::delete_backup,
            commands::restore_backup,
            commands::get_db_size,
            commands::cloud_backup_upload,
            commands::cloud_backup_list,
            commands::cloud_backup_restore,
            commands::start_lan_server,
            commands::stop_lan_server,
            commands::lan_server_status,
            commands::generate_pairing_code,
            commands::list_paired_devices,
            commands::revoke_paired_device,
            commands::discover_lan_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
