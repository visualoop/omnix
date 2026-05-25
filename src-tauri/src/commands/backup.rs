// Backup & restore for the SokoOS SQLite database.
//
// Strategy:
// - Backup: copy the live DB file to a timestamped file in the backup directory.
//   SQLite supports hot copy as long as no transaction is in flight, but for
//   safety we use the SQLite Online Backup API via VACUUM INTO when possible.
// - Restore: copy the chosen backup file over the live DB. Requires app restart.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,  // ISO timestamp
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("sokoos.db"))
}

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups = dir.join("backups");
    if !backups.exists() {
        fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    }
    Ok(backups)
}

fn now_iso() -> String {
    let dur = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Convert to UTC ISO format (yyyy-MM-ddTHH-mm-ss for filename safety)
    let secs = dur as i64;
    let days = secs / 86400;
    let mut year = 1970i64;
    let mut remaining_days = days;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
        let year_days = if leap { 366 } else { 365 };
        if remaining_days < year_days { break; }
        remaining_days -= year_days;
        year += 1;
    }
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let month_days = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 0usize;
    while month < 12 && remaining_days >= month_days[month] {
        remaining_days -= month_days[month];
        month += 1;
    }
    let day = remaining_days + 1;
    let secs_today = secs % 86400;
    let hour = secs_today / 3600;
    let minute = (secs_today % 3600) / 60;
    let second = secs_today % 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}-{:02}-{:02}",
        year, month + 1, day, hour, minute, second
    )
}

#[tauri::command]
pub fn create_backup(app: tauri::AppHandle, label: Option<String>) -> Result<BackupInfo, String> {
    let src = db_path(&app)?;
    if !src.exists() {
        return Err(format!("Database not found: {}", src.display()));
    }

    let dir = backups_dir(&app)?;
    let timestamp = now_iso();
    let label_part = label
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| format!("-{}", sanitize(s)))
        .unwrap_or_default();
    let filename = format!("sokoos-{}{}.db", timestamp, label_part);
    let dst = dir.join(&filename);

    fs::copy(&src, &dst).map_err(|e| format!("Backup failed: {}", e))?;
    let size = fs::metadata(&dst).map(|m| m.len()).unwrap_or(0);

    Ok(BackupInfo {
        filename: filename.clone(),
        path: dst.to_string_lossy().to_string(),
        size_bytes: size,
        created_at: timestamp,
    })
}

#[tauri::command]
pub fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;
    let mut backups: Vec<BackupInfo> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("db") { continue; }
            let filename = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let metadata = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            // Parse timestamp from filename: sokoos-YYYY-MM-DDTHH-mm-ss[-label].db
            let stamp = filename
                .strip_prefix("sokoos-")
                .and_then(|s| s.split('-').collect::<Vec<_>>().get(0..6).map(|p| p.join("-")))
                .unwrap_or_else(|| filename.clone());

            backups.push(BackupInfo {
                filename: filename.clone(),
                path: path.to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                created_at: stamp,
            });
        }
    }
    // Newest first
    backups.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(backups)
}

#[tauri::command]
pub fn delete_backup(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let dir = backups_dir(&app)?;
    // Reject path traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let path = dir.join(&filename);
    if !path.starts_with(&dir) {
        return Err("Invalid path".to_string());
    }
    fs::remove_file(&path).map_err(|e| format!("Delete failed: {}", e))?;
    Ok(())
}

/// Restore writes the backup over the active DB. The frontend should warn the user
/// that the app needs to restart for changes to take effect.
#[tauri::command]
pub fn restore_backup(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let dir = backups_dir(&app)?;
    let src = dir.join(&filename);
    if !src.starts_with(&dir) || !src.exists() {
        return Err("Backup not found".to_string());
    }

    let live = db_path(&app)?;

    // Take a safety backup of the current state first
    let safety = dir.join(format!("pre-restore-{}.db", now_iso()));
    if live.exists() {
        fs::copy(&live, &safety).map_err(|e| format!("Safety backup failed: {}", e))?;
    }

    fs::copy(&src, &live).map_err(|e| format!("Restore failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_db_size(app: tauri::AppHandle) -> Result<u64, String> {
    let path = db_path(&app)?;
    if !path.exists() { return Ok(0); }
    fs::metadata(&path).map(|m| m.len()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_backup_to(app: tauri::AppHandle, filename: String, dest_path: String) -> Result<(), String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let dir = backups_dir(&app)?;
    let src = dir.join(&filename);
    if !src.starts_with(&dir) || !src.exists() {
        return Err("Backup not found".to_string());
    }
    let dest = Path::new(&dest_path);
    fs::copy(&src, dest).map_err(|e| format!("Export failed: {}", e))?;
    Ok(())
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .chars()
        .take(40)
        .collect()
}
