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

#[derive(Debug, Serialize, Deserialize)]
pub struct ModuleEntitlement {
    pub entitled: bool,
    pub modules: Vec<String>,
    pub error: Option<String>,
}

/// Backend-authoritative module gate. Re-verifies the RSA signature on the
/// license key (so it can't be spoofed from the JS side) and checks whether
/// `module` is among the licensed modules. `core` is always entitled.
///
/// Module-scoped commands should call this before mutating data, passing the
/// stored license key + the module the command belongs to.
#[tauri::command]
pub fn verify_module_entitled(key: String, module: String) -> ModuleEntitlement {
    if module == "core" {
        return ModuleEntitlement { entitled: true, modules: vec!["core".into()], error: None };
    }
    match verify_license_key(&key) {
        Ok(verified) => {
            let modules = verified.payload.effective_modules();
            ModuleEntitlement {
                entitled: modules.iter().any(|m| m == &module),
                modules,
                error: None,
            }
        }
        Err(e) => ModuleEntitlement {
            entitled: false,
            modules: vec![],
            error: Some(e.to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Real v2 key: modules=["hardware"], max_devices=2 (matches license/mod.rs VALID_V2_KEY).
    const HW_KEY: &str = "OMNIX-eyJraWQiOiJPTU5JWC0yMDI2LVlLN1ctWk5XOCIsIm5hbWUiOiJIYXJkd2FyZSBUZXN0IiwiZW1haWwiOiJod0BpbnRlZ3JhdGlvbi5sb2NhbCIsImlzc3VlZCI6IjIwMjYtMDYtMDEiLCJtYWludF9leHAiOiIyMDI3LTA2LTAxIiwidHlwZSI6InBlcnBldHVhbCIsImZlYXQiOlsiZXRpbXMiLCJpbnN1cmFuY2UiLCJsYW4iLCJyZXBvcnRzIl0sIm1vZHVsZXMiOlsiaGFyZHdhcmUiXSwibWF4X2RldmljZXMiOjIsInZlciI6Mn0.BE3vglO7KfMEu0Dx8WuZjugcS45dwprcNVapnGRDuI5sK_P5ok5LLWstCdqGiYdUOzdZJoVyBZ9SsFsG-jZ9kYlOqFVfb9kOFJ08lLMkXifmxotFmi7drv_pQV5vpEt4XaS1AH7XKugsKMSe6yGqsDGBeqR-CHn7x8amKuaLG_KxKVvWy-DvTWL_rTM4fDkTeYAGw7nnLwLojgP_t-vXTkY51utomhxQbRa-o0FoNYmuMRwnvbCSZYVnPcErtIjM1cIMAgW2CPz61A6LzX9Hk75rL-jVKmy_TQJhL0AnUQxaDTGBgmizOZm-_Onp-ACsAhdEahATuknLICCRVWIx_g";

    #[test]
    fn entitled_for_licensed_module() {
        let r = verify_module_entitled(HW_KEY.to_string(), "hardware".to_string());
        assert!(r.entitled);
        assert!(r.modules.contains(&"hardware".to_string()));
    }

    #[test]
    fn not_entitled_for_unlicensed_module() {
        let r = verify_module_entitled(HW_KEY.to_string(), "hospitality".to_string());
        assert!(!r.entitled);
    }

    #[test]
    fn core_always_entitled_even_with_garbage_key() {
        let r = verify_module_entitled("not-a-key".to_string(), "core".to_string());
        assert!(r.entitled);
    }

    #[test]
    fn invalid_key_denies_module() {
        let r = verify_module_entitled("not-a-key".to_string(), "hardware".to_string());
        assert!(!r.entitled);
        assert!(r.error.is_some());
    }
}
