// Peripheral device commands (cash drawer, weight scale).
// For now these are stubs — real drivers will be wired later, per device.

#[tauri::command]
pub async fn open_cash_drawer(connection_string: String) -> Result<(), String> {
    // TODO: real USB / serial driver. For now: log the request so the audit rule
    // finds a real handler and the app doesn't crash.
    log::info!("open_cash_drawer requested for {}", connection_string);
    Err("cash drawer driver not yet implemented (use printer_kick driver for now)".to_string())
}

#[tauri::command]
pub async fn read_weight_scale(connection_string: String) -> Result<f64, String> {
    // TODO: real scale driver (USB HID / serial). Returns kg.
    log::info!("read_weight_scale requested for {}", connection_string);
    Err("weight scale driver not yet implemented".to_string())
}
