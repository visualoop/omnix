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
        // sc.exe needs an elevated token (OpenSCManager write access) or it
        // fails with "Access is denied". A plain Command spawn inherits the
        // app's non-elevated token, so we write the sc commands to a batch
        // file and launch it elevated via PowerShell Start-Process -Verb RunAs
        // (single UAC prompt), then verify the result with a (non-elevated)
        // query.
        let bat = format!(
            "@echo off\r\n\
             sc create OmnixLAN binPath= \"{exe}\" start= auto DisplayName= \"Omnix LAN Server\"\r\n\
             sc failure OmnixLAN reset= 86400 actions= restart/5000/restart/5000/restart/30000\r\n\
             sc start OmnixLAN\r\n",
            exe = exe
        );
        let tmp = std::env::temp_dir().join("omnix-install-lan.bat");
        std::fs::write(&tmp, bat).map_err(|e| format!("write install script: {}", e))?;

        let run = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &format!(
                    "Start-Process -FilePath '{}' -Verb RunAs -Wait -WindowStyle Hidden",
                    tmp.display()
                ),
            ])
            .status()
            .map_err(|e| format!("elevate (powershell): {}", e))?;
        let _ = std::fs::remove_file(&tmp);
        if !run.success() {
            // Non-zero here usually means the user declined the UAC prompt.
            return Err("Elevation was cancelled or failed — installing a Windows service needs administrator rights.".to_string());
        }

        // Verify — the elevated process ran detached, so confirm via query.
        let q = std::process::Command::new("sc.exe")
            .args(["query", "OmnixLAN"])
            .output()
            .map_err(|e| format!("sc.exe query: {}", e))?;
        let qout = String::from_utf8_lossy(&q.stdout);
        if qout.contains("does not exist") || !q.status.success() {
            return Err("Service did not install — administrator rights are required (approve the UAC prompt).".to_string());
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
        // Elevated stop + delete (SCM write access needs admin), same
        // batch-and-RunAs approach as install.
        let bat = "@echo off\r\nsc stop OmnixLAN\r\nsc delete OmnixLAN\r\n";
        let tmp = std::env::temp_dir().join("omnix-uninstall-lan.bat");
        std::fs::write(&tmp, bat).map_err(|e| format!("write uninstall script: {}", e))?;
        let run = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &format!(
                    "Start-Process -FilePath '{}' -Verb RunAs -Wait -WindowStyle Hidden",
                    tmp.display()
                ),
            ])
            .status()
            .map_err(|e| format!("elevate (powershell): {}", e))?;
        let _ = std::fs::remove_file(&tmp);
        if !run.success() {
            return Err("Elevation was cancelled — removing a Windows service needs administrator rights.".to_string());
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
