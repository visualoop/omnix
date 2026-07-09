mod commands;
mod db;
mod license;
pub mod network;
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
    let identifier = "co.ke.omnix.app";
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
        Migration {
            version: 38,
            description: "Sales service charge amount",
            sql: include_str!("../migrations/038_sales_service_charge.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 39,
            description: "Module sale bridge: sale_id FKs on laybys / special_orders / folio_payments",
            sql: include_str!("../migrations/039_module_sale_bridge.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 40,
            description: "Menu kind: products.kind + sale_items.menu_item_id (hospitality recipes)",
            sql: include_str!("../migrations/040_menu_kind.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 41,
            description: "Sales source tracking: sales.source_type + source_id",
            sql: include_str!("../migrations/041_sales_source.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 42,
            description: "AI integration: providers, features, cache, calls, settings",
            sql: include_str!("../migrations/042_ai.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 43,
            description: "AI assistant: register assistant_chat feature for streaming concierge",
            sql: include_str!("../migrations/043_ai_assistant.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 44,
            description: "AI chat history: ai_conversations + ai_messages for resume + scroll-back",
            sql: include_str!("../migrations/044_ai_chat_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 45,
            description: "PO lifecycle hardening: currency + exchange rate + approval workflow + 3-way match tolerance + reverse-GRN audit fields",
            sql: include_str!("../migrations/045_po_lifecycle.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 46,
            description: "Multi-license per machine: local_licenses table + backfill from legacy `license`",
            sql: include_str!("../migrations/046_local_licenses.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 47,
            description: "Link prescriptions → customers (FK + index) so the Patients tab can show per-patient history",
            sql: include_str!("../migrations/047_prescription_customer_link.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 48,
            description: "Manual M-Pesa: paybill/till columns on payment_providers + mpesa-manual provider row",
            sql: include_str!("../migrations/048_manual_mpesa.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 49,
            description: "Sales daily rollup + churn-table timestamp indexes for long-term scale",
            sql: include_str!("../migrations/049_sales_rollup.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 50,
            description: "Void support: voided_at on payments + etims_invoices so voids reverse money + tax",
            sql: include_str!("../migrations/050_void_support.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 51,
            description: "AI write-action ledger (ai_actions) + ask_data/action_proposer features",
            sql: include_str!("../migrations/051_ai_actions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 52,
            description: "Seed M-Pesa payment methods",
            sql: include_str!("../migrations/052_seed_mpesa_methods.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 53,
            description: "Sale returns impact — refunded_amount + trigger",
            sql: include_str!("../migrations/053_sale_returns_impact.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 54,
            description: "eTIMS credit note support",
            sql: include_str!("../migrations/054_etims_credit_note.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 55,
            description: "Two-factor authentication table",
            sql: include_str!("../migrations/055_two_factor.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 56,
            description: "Form drafts (autosave) — invoice-new, PO, stock-take",
            sql: include_str!("../migrations/056_form_drafts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 57,
            description: "Notifications table (expiry, low stock, unpaid invoices, refills)",
            sql: include_str!("../migrations/057_notifications.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 58,
            description: "Offline queue for LAN clients when master unreachable",
            sql: include_str!("../migrations/058_offline_queue.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 59,
            description: "General Ledger — chart of accounts + journal entries + lines",
            sql: include_str!("../migrations/059_general_ledger.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 60,
            description: "Reservations (tables + rooms)",
            sql: include_str!("../migrations/060_reservations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 61,
            description: "Peripherals registry (cash drawer, scale, kitchen printer, card reader)",
            sql: include_str!("../migrations/061_peripherals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 62,
            description: "Financial years + accounting periods (period close)",
            sql: include_str!("../migrations/062_period_close.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 63,
            description: "Debit notes + supplier returns + supplier return items",
            sql: include_str!("../migrations/063_debit_notes_supplier_returns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 64,
            description: "Approval workflows (rules + requests) for POs and expenses",
            sql: include_str!("../migrations/064_approvals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 65,
            description: "Inventory extensions: bundles, serials, cycle counts, damages, reorder suggestions",
            sql: include_str!("../migrations/065_inventory_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 66,
            description: "Sales+pricing: customer groups, coupons, gift cards, discount rules, sales targets, commissions",
            sql: include_str!("../migrations/066_sales_pricing_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 67,
            description: "Platform: customer comms, fixed assets, multi-currency, recalls, room status, change history, report builder, password policies+PIN",
            sql: include_str!("../migrations/067_platform_extensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 68,
            description: "Product lead_time_days + last_ordered_at columns",
            sql: include_str!("../migrations/068_product_lead_time.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 69,
            description: "Medium batch A: cost centres, landed cost, recurring expenses, multi-warehouse bins, assembly BOM",
            sql: include_str!("../migrations/069_medium_batch_a.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 70,
            description: "Medium batch B: portion control, bar inventory, waiter stations, split/merge, group bookings, compounded scripts, delivery, contractor holds",
            sql: include_str!("../migrations/070_medium_batch_b.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 71,
            description: "Medium batch C: anomaly log, report scheduling, custom fields, data quality flags",
            sql: include_str!("../migrations/071_medium_batch_c.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 72,
            description: "Low tier: rental, loyalty tiers, signed audit chain, plugin registry, OTA channels, self-checkout, NFC readers",
            sql: include_str!("../migrations/072_low_tier.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 73,
            description: "Hardware quote columns — patch 018/031 quotations collision",
            sql: include_str!("../migrations/073_hardware_quote_columns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 74,
            description: "Unified audit_log_unified VIEW for the /audit feed",
            sql: include_str!("../migrations/074_audit_log_view.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 75,
            description: "Menu-item photos + allergens (KDS + order tiles show images)",
            sql: include_str!("../migrations/075_menu_photos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 76,
            description: "Party size + folio + room link on hospitality orders",
            sql: include_str!("../migrations/076_hospitality_party_folio.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 77,
            description: "Soft-86 for menu items with expiry (temporary out-of-stock)",
            sql: include_str!("../migrations/077_menu_86s.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 78,
            description: "Visual recipe canvas layout persistence",
            sql: include_str!("../migrations/078_recipe_canvas.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 79,
            description: "Units of measure with dimensions + Kenya-oriented seeds",
            sql: include_str!("../migrations/079_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 80,
            description: "Guest AHRA fields (national_id, email, nationality, notes) + indexes",
            sql: include_str!("../migrations/080_guest_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 82,
            description: "Service periods + sessions (lunch/dinner shifts)",
            sql: include_str!("../migrations/082_service_periods.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 83,
            description: "Walk-in folios (nullable booking_id + direct guest_id link)",
            sql: include_str!("../migrations/083_walkin_folios.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 84,
            description: "Pharmacy drug_class + is_antimicrobial tags on pharmacy_products",
            sql: include_str!("../migrations/084_pharmacy_drug_class.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 85,
            description: "Pharmacy license expiry tracker (premises + pharmacist + PPB)",
            sql: include_str!("../migrations/085_pharmacy_licenses.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 86,
            description: "Pharmacy v47: SHA claim queue, DHA e-scripts, cold-chain RCA, counselling, PPB submissions",
            sql: include_str!("../migrations/086_pharmacy_v47.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 87,
            description: "Retail pricing convergence (price_lists + product_prices), loyalty GL flag, layby reservation",
            sql: include_str!("../migrations/087_retail_pricing_convergence.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 88,
            description: "Delivery note source_quotation_id link (generate delivery notes from accepted quotes)",
            sql: include_str!("../migrations/088_delivery_note_source.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 89,
            description: "Customers address column",
            sql: include_str!("../migrations/089_customer_address.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 90,
            description: "Controlled-substance witnessed-destruction disposal records",
            sql: include_str!("../migrations/090_controlled_disposals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 91,
            description: "Equipment units registry + product serial/warranty/specs fields",
            sql: include_str!("../migrations/091_equipment_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 92,
            description: "Service jobs + parts + labour (equipment workshop)",
            sql: include_str!("../migrations/092_service_jobs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 93,
            description: "Rental items linked to equipment units + meter readings",
            sql: include_str!("../migrations/093_rental_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 94,
            description: "Salon / Spa module (services, staff, appointments, commissions)",
            sql: include_str!("../migrations/094_salon.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 95,
            description: "Salon back-bar product consumption mapping",
            sql: include_str!("../migrations/095_salon_backbar.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 96,
            description: "Salon prepaid packages / memberships",
            sql: include_str!("../migrations/096_salon_packages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 97,
            description: "Salon bookable resources (rooms/chairs)",
            sql: include_str!("../migrations/097_salon_resources.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(std::sync::Arc::new(commands::NetworkState::default()))
        .manage(std::sync::Arc::new(commands::CloudBackupSession::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // persisted-scope MUST come after fs per the plugin docs. It
        // remembers which paths the user picked via the dialog plugin
        // so the asset:// protocol keeps serving them across restarts
        // (e.g. customer-display playlist files sitting on D:/ which
        // isn't in the static scope inside tauri.conf.json).
        .plugin(tauri_plugin_persisted_scope::init())
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

                // ── System tray (v0.35.4) ────────────────────────────
                // The LAN server lives in this process. If the shop owner
                // closes the window, the tray keeps the process alive so
                // clients keep hitting the master.
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;
                use tauri::Manager;

                let show_i = MenuItem::with_id(app, "show", "Open Omnix", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit (stop LAN server)", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .tooltip("Omnix — LAN server running")
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        // Left-click restores the window
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app)?;

                // ── Close-to-tray: intercept the X and hide instead of quit ─
                let main_window = app.get_webview_window("main").expect("main window");
                let handle = app.handle().clone();
                let win_for_close = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Only intercept if LAN server is actually running.
                        // Standalone installs (no LAN) close normally.
                        let state = handle.state::<std::sync::Arc<commands::NetworkState>>();
                        let running = state.server.lock().is_some();
                        if running {
                            let _ = win_for_close.hide();
                            api.prevent_close();
                        }
                    }
                });
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
            commands::cloud_backup_set_session_key,
            commands::cloud_backup_clear_session_key,
            commands::cloud_backup_has_session_key,
            commands::cloud_backup_auto_upload,
            commands::apply_cloud_restore,
            commands::start_lan_server,
            commands::stop_lan_server,
            commands::lan_server_status,
            commands::generate_pairing_code,
            commands::list_paired_devices,
            commands::revoke_paired_device,
            commands::discover_lan_servers,
            commands::open_cash_drawer,
            commands::read_weight_scale,
            commands::install_windows_service,
            commands::uninstall_windows_service,
            commands::windows_service_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
