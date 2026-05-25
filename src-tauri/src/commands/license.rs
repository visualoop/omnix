// License-related Tauri commands

use crate::license::{
    format_fingerprint, get_machine_fingerprint, verify_license_key, LicensePayload,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub valid: bool,
    pub payload: Option<LicensePayload>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MachineInfo {
    pub fingerprint: String,
    pub formatted: String,
}

#[tauri::command]
pub fn get_machine_info() -> MachineInfo {
    let fp = get_machine_fingerprint();
    MachineInfo {
        formatted: format_fingerprint(&fp),
        fingerprint: fp,
    }
}

#[tauri::command]
pub fn verify_license(key: String) -> LicenseInfo {
    match verify_license_key(&key) {
        Ok(verified) => LicenseInfo {
            valid: true,
            payload: Some(verified.payload),
            error: None,
        },
        Err(e) => LicenseInfo {
            valid: false,
            payload: None,
            error: Some(e.to_string()),
        },
    }
}
