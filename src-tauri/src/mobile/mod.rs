//! Android-only Tauri bridge for the reviewed `omnix-mobile` Kotlin overlay.
//! This module is intentionally not registered from coordinator-owned `lib.rs` yet.

use serde_json::Value;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

pub(crate) struct AndroidMobile<R: Runtime>(PluginHandle<R>);

pub(crate) fn run_mobile<R: Runtime>(
    state: State<'_, AndroidMobile<R>>,
    native_command: &'static str,
    payload: Value,
) -> Result<Value, String> {
    state
        .0
        .run_mobile_plugin(native_command, payload)
        .map_err(|error| error.to_string())
}

fn run<R: Runtime>(
    state: State<'_, AndroidMobile<R>>,
    native_command: &'static str,
    payload: Option<Value>,
) -> Result<Value, String> {
    run_mobile(
        state,
        native_command,
        payload.unwrap_or_else(|| Value::Object(Default::default())),
    )
}

macro_rules! forward_command {
    ($rust_name:ident, $native_name:literal) => {
        #[tauri::command]
        fn $rust_name<R: Runtime>(
            _app: AppHandle<R>,
            state: State<'_, AndroidMobile<R>>,
            payload: Option<Value>,
        ) -> Result<Value, String> {
            run(state, $native_name, payload)
        }
    };
}

forward_command!(secure_storage_availability, "secureStorageAvailability");
forward_command!(secure_storage_get, "secureStorageGet");
forward_command!(secure_storage_set, "secureStorageSet");
forward_command!(secure_storage_remove, "secureStorageRemove");
forward_command!(biometric_availability, "biometricAvailability");
forward_command!(biometric_permission, "biometricPermission");
forward_command!(biometric_request_permission, "biometricRequestPermission");
forward_command!(biometric_authenticate, "biometricAuthenticate");
forward_command!(scanner_availability, "scannerAvailability");
forward_command!(scanner_permission, "scannerPermission");
forward_command!(scanner_request_permission, "scannerRequestPermission");
forward_command!(scanner_scan, "scannerScan");
forward_command!(scanner_cancel, "scannerCancel");
forward_command!(share_availability, "shareAvailability");
forward_command!(share_permission, "sharePermission");
forward_command!(share_request_permission, "shareRequestPermission");
forward_command!(share, "share");
forward_command!(notification_availability, "notificationAvailability");
forward_command!(notification_permission, "notificationPermission");
forward_command!(
    notification_request_permission,
    "notificationRequestPermission"
);
forward_command!(notification_post, "notificationPost");
forward_command!(notification_cancel, "notificationCancel");
forward_command!(mesh_availability, "meshAvailability");
forward_command!(mesh_status, "meshStatus");
forward_command!(mesh_start, "meshStart");
forward_command!(mesh_stop, "meshStop");
forward_command!(lifecycle_current_state, "lifecycleCurrentState");
forward_command!(lifecycle_complete_back, "lifecycleCompleteBack");
forward_command!(apk_update_availability, "apkUpdateAvailability");
forward_command!(apk_update_status, "apkUpdateStatus");
forward_command!(apk_update_stage, "apkUpdateStage");
forward_command!(apk_update_install, "apkUpdateInstall");
forward_command!(apk_update_cancel, "apkUpdateCancel");

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("omnix-mobile")
        .invoke_handler(tauri::generate_handler![
            secure_storage_availability,
            secure_storage_get,
            secure_storage_set,
            secure_storage_remove,
            biometric_availability,
            biometric_permission,
            biometric_request_permission,
            biometric_authenticate,
            scanner_availability,
            scanner_permission,
            scanner_request_permission,
            scanner_scan,
            scanner_cancel,
            share_availability,
            share_permission,
            share_request_permission,
            share,
            notification_availability,
            notification_permission,
            notification_request_permission,
            notification_post,
            notification_cancel,
            mesh_availability,
            mesh_status,
            mesh_start,
            mesh_stop,
            lifecycle_current_state,
            lifecycle_complete_back,
            apk_update_availability,
            apk_update_status,
            apk_update_stage,
            apk_update_install,
            apk_update_cancel,
        ])
        .setup(|app: &AppHandle<R>, api| {
            let handle =
                api.register_android_plugin("co.ke.omnix.app.mobile", "OmnixMobilePlugin")?;
            app.manage(AndroidMobile(handle));
            Ok(())
        })
        .build()
}
