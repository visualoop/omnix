//! Windows Service install / uninstall / status commands.
//!
//! Called by the Tauri UI on Settings → Network → "Install as Windows service".
//! Shell out to `sc.exe` for install/remove/start/stop/query — that way we
//! reuse Windows' native service tooling and users can also manage the
//! service from `services.msc` if they want.
//!
//! Install requires admin — the exe will trigger a UAC prompt. Callers
//! should tell the user this in the dialog before clicking.

use serde::Serialize;

#[cfg(windows)]
fn service_exe_path() -> Result<String, String> {
    // We're installed alongside the main omnix.exe. Sibling: omnix-lan-service.exe
    let current = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
    let parent = current.parent().ok_or_else(|| "no parent dir".to_string())?;
    let target = parent.join("omnix-lan-service.exe");
    if !target.exists() {
        return Err(format!(
            "omnix-lan-service.exe not found at {} — reinstall Omnix",
            target.display()
        ));
    }
    Ok(target.display().to_string())
}

#[cfg(not(windows))]
fn service_exe_path() -> Result<String, String> {
    Err("Windows service is only available on Windows".to_string())
}

/// Install the LAN service. Requires admin — triggers UAC.
#[tauri::command]
pub async fn install_windows_service() -> Result<String, String> {
    #[cfg(not(windows))]
    {
        return Err("Windows service is only available on Windows".to_string());
    }
    #[cfg(windows)]
    {
        let exe = service_exe_path()?;
        // sc create OmnixLAN binPath="..." start=auto DisplayName="Omnix LAN Server"
        let output = std::process::Command::new("sc.exe")
            .args([
                "create",
                "OmnixLAN",
                &format!("binPath= \"{}\"", exe),
                "start=",
                "auto",
                "DisplayName=",
                "Omnix LAN Server",
            ])
            .output()
            .map_err(|e| format!("sc.exe create: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!(
                "sc create failed (status {}): stderr={} stdout={}",
                output.status, stderr, stdout
            ));
        }

        // Configure auto-restart on failure (services.msc → Recovery)
        // Restart after 5s on first + second failure, then 30s.
        let _ = std::process::Command::new("sc.exe")
            .args([
                "failure",
                "OmnixLAN",
                "reset=",
                "86400",
                "actions=",
                "restart/5000/restart/5000/restart/30000",
            ])
            .output();

        // Start it now
        let start = std::process::Command::new("sc.exe")
            .args(["start", "OmnixLAN"])
            .output()
            .map_err(|e| format!("sc.exe start: {}", e))?;
        if !start.status.success() {
            let stderr = String::from_utf8_lossy(&start.stderr);
            return Err(format!(
                "Service installed but failed to start: {}",
                stderr
            ));
        }
        Ok("Installed + started".to_string())
    }
}

/// Stop + remove the LAN service. Requires admin.
#[tauri::command]
pub async fn uninstall_windows_service() -> Result<String, String> {
    #[cfg(not(windows))]
    {
        return Err("Windows service is only available on Windows".to_string());
    }
    #[cfg(windows)]
    {
        // Stop first (best-effort)
        let _ = std::process::Command::new("sc.exe")
            .args(["stop", "OmnixLAN"])
            .output();

        let output = std::process::Command::new("sc.exe")
            .args(["delete", "OmnixLAN"])
            .output()
            .map_err(|e| format!("sc.exe delete: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("sc delete failed: {}", stderr));
        }
        Ok("Uninstalled".to_string())
    }
}

#[derive(Debug, Serialize)]
pub struct ServiceInfo {
    pub installed: bool,
    pub running: bool,
    pub status: String,
}

/// Query the service state. Never fails — returns installed=false when the
/// service doesn't exist, running=false when it's stopped, running=true when
/// it's up.
#[tauri::command]
pub async fn windows_service_status() -> Result<ServiceInfo, String> {
    #[cfg(not(windows))]
    {
        return Ok(ServiceInfo {
            installed: false,
            running: false,
            status: "not_windows".to_string(),
        });
    }
    #[cfg(windows)]
    {
        let output = std::process::Command::new("sc.exe")
            .args(["query", "OmnixLAN"])
            .output()
            .map_err(|e| format!("sc.exe query: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        // "The specified service does not exist as an installed service" → not installed
        if !output.status.success() || stdout.contains("does not exist") {
            return Ok(ServiceInfo {
                installed: false,
                running: false,
                status: "not_installed".to_string(),
            });
        }
        // STATE : 4  RUNNING   /   1  STOPPED   /   2  START_PENDING …
        let running = stdout.contains("RUNNING");
        let status = if running { "running" } else { "stopped" };
        Ok(ServiceInfo {
            installed: true,
            running,
            status: status.to_string(),
        })
    }
}
