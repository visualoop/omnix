mod commands;
mod db;
mod license;
mod network;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
    ];

    tauri::Builder::default()
        .manage(std::sync::Arc::new(commands::NetworkState::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sokoos.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::hash_password,
            commands::verify_password,
            commands::get_machine_info,
            commands::verify_license,
            commands::create_backup,
            commands::list_backups,
            commands::delete_backup,
            commands::restore_backup,
            commands::get_db_size,
            commands::export_backup_to,
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
