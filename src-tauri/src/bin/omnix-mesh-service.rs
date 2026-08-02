//! `omnix-mesh-service` is both the narrow elevated installer helper and the
//! fixed WireGuard tunnel service host. It accepts only fixed operation names;
//! no service name, executable path, custody path, or tunnel name is supplied
//! by React or a peer.

#[cfg(not(windows))]
fn main() {
    eprintln!("omnix-mesh-service is Windows-only. This is a test stub.");
}

#[cfg(windows)]
fn main() {
    if let Err(error) = windows_impl::run() {
        eprintln!("omnix-mesh-service failed: {error}");
        std::process::exit(1);
    }
}

#[cfg(windows)]
mod windows_impl {
    use std::ffi::{c_char, c_void, CString, OsStr};
    use std::fs;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    use chrono::Utc;
    use omnix_lib::mesh_windows::dpapi;
    use omnix_lib::mesh_windows::{
        DesiredTunnelConfig, KeySlot, PrivateKeyMaterial, TunnelState, MESH_SERVICE_NAME,
    };
    use serde::{Deserialize, Serialize};
    use sha2::{Digest, Sha256};
    use uuid::Uuid;

    const INSTALL_FOLDER: &str = "Omnix\\Private Mesh";
    const DATA_FOLDER: &str = "Omnix\\Private Mesh";
    const HELPER_FILE: &str = "omnix-mesh-service.exe";
    const TUNNEL_DLL: &str = "tunnel.dll";
    const WIREGUARD_DLL: &str = "wireguard.dll";
    const DESIRED_FILE: &str = "desired-tunnel.json";
    const INBOX_FILE: &str = "desired-tunnel.inbox.json";
    const PUBLIC_STATE_FILE: &str = "state.json";
    const RUNTIME_CONFIG_FILE: &str = "omnix-mesh.conf";
    const TUNNEL_SHA256: Option<&str> = option_env!("OMNIX_TUNNEL_SHA256");
    const WIREGUARD_SHA256: Option<&str> = option_env!("OMNIX_WIREGUARD_SHA256");

    #[derive(Clone, Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct PublicKeyRecord {
        key_id: String,
        public_key: String,
        custody_ref: String,
        created_at: String,
    }

    #[derive(Clone, Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct PublicMeshState {
        schema_version: u16,
        state: TunnelState,
        current_key: Option<PublicKeyRecord>,
        next_key: Option<PublicKeyRecord>,
        last_error: Option<String>,
        updated_at: String,
    }

    impl Default for PublicMeshState {
        fn default() -> Self {
            Self {
                schema_version: 1,
                state: TunnelState::NotInstalled,
                current_key: None,
                next_key: None,
                last_error: None,
                updated_at: Utc::now().to_rfc3339(),
            }
        }
    }

    pub fn run() -> Result<(), String> {
        let operation = std::env::args().nth(1).unwrap_or_default();
        match operation.as_str() {
            "/install" => install(),
            "/apply" => apply(),
            "/rotate" => rotate(),
            "/promote-next-key" => promote_next_key(),
            "/revoke" => revoke(),
            "/uninstall" => uninstall(),
            "/service" => run_tunnel_service(),
            _ => Err("unsupported fixed mesh service operation".to_owned()),
        }
    }

    fn install() -> Result<(), String> {
        let stage = current_parent()?;
        verify_staged_artifacts(&stage)?;
        let install = install_dir()?;
        let data = data_dir()?;
        fs::create_dir_all(&install).map_err(display_error("create install directory"))?;
        fs::create_dir_all(&data).map_err(display_error("create data directory"))?;

        for file in [HELPER_FILE, TUNNEL_DLL, WIREGUARD_DLL] {
            fs::copy(stage.join(file), install.join(file))
                .map_err(display_error("stage mesh artifact"))?;
        }
        for file in [
            "THIRD_PARTY_NOTICES.md",
            "LICENSE-MIT-WIREGUARD-WINDOWS.txt",
        ] {
            let source = stage.join(file);
            if source.is_file() {
                fs::copy(source, install.join(file)).map_err(display_error("stage mesh notice"))?;
            }
        }
        lock_directory(&install)?;
        lock_directory(&data)?;
        let inbox = data.join(INBOX_FILE);
        fs::write(&inbox, []).map_err(display_error("create configuration inbox"))?;
        lock_file_for_inbox(&inbox)?;
        create_or_update_service(&install.join(HELPER_FILE))?;

        let mut state = read_state().unwrap_or_default();
        if state.current_key.is_none() {
            state.current_key = Some(provision_key(KeySlot::Current)?);
        }
        state.state = TunnelState::AwaitingEnrollment;
        state.last_error = None;
        write_state(&state)?;
        Ok(())
    }

    fn apply() -> Result<(), String> {
        let inbox = data_dir()?.join(INBOX_FILE);
        let bytes = fs::read(&inbox).map_err(display_error("read staged tunnel request"))?;
        let desired: DesiredTunnelConfig =
            serde_json::from_slice(&bytes).map_err(|_| "invalid tunnel request".to_owned())?;
        desired.validate().map_err(|error| error.to_string())?;
        let destination = data_dir()?.join(DESIRED_FILE);
        write_atomic(&destination, &bytes)?;
        lock_file_for_service(&destination)?;
        fs::write(&inbox, []).map_err(display_error("clear configuration inbox"))?;
        lock_file_for_inbox(&inbox)?;
        let _ = sc(&["stop", MESH_SERVICE_NAME], false);
        sc(&["start", MESH_SERVICE_NAME], true)?;
        Ok(())
    }

    fn rotate() -> Result<(), String> {
        let mut state = read_state()?;
        if matches!(
            state.state,
            TunnelState::Revoked | TunnelState::NotInstalled
        ) {
            return Err("revoked or uninstalled mesh credentials cannot rotate".to_owned());
        }
        state.next_key = Some(provision_key(KeySlot::Next)?);
        state.state = TunnelState::RotationPending;
        state.updated_at = Utc::now().to_rfc3339();
        write_state(&state)
    }

    fn promote_next_key() -> Result<(), String> {
        let mut state = read_state()?;
        let next = state
            .next_key
            .take()
            .ok_or_else(|| "no next key is provisioned".to_owned())?;
        let data = data_dir()?;
        let next_path = data.join(KeySlot::Next.custody_file_name());
        let current_path = data.join(KeySlot::Current.custody_file_name());
        let _ = fs::remove_file(&current_path);
        fs::rename(&next_path, &current_path).map_err(display_error("promote rotated key"))?;
        lock_file_for_service(&current_path)?;
        state.current_key = Some(PublicKeyRecord {
            custody_ref: KeySlot::Current.custody_reference(),
            ..next
        });
        state.state = TunnelState::Stopped;
        state.updated_at = Utc::now().to_rfc3339();
        write_state(&state)?;
        if data.join(DESIRED_FILE).is_file() {
            let _ = sc(&["stop", MESH_SERVICE_NAME], false);
            sc(&["start", MESH_SERVICE_NAME], true)?;
        }
        Ok(())
    }

    fn revoke() -> Result<(), String> {
        let _ = sc(&["stop", MESH_SERVICE_NAME], false);
        let data = data_dir()?;
        for file in [
            KeySlot::Current.custody_file_name(),
            KeySlot::Next.custody_file_name(),
            DESIRED_FILE,
            RUNTIME_CONFIG_FILE,
        ] {
            let _ = fs::remove_file(data.join(file));
        }
        let mut state = read_state().unwrap_or_default();
        state.state = TunnelState::Revoked;
        state.current_key = None;
        state.next_key = None;
        state.last_error = None;
        state.updated_at = Utc::now().to_rfc3339();
        write_state(&state)
    }

    fn uninstall() -> Result<(), String> {
        let _ = sc(&["stop", MESH_SERVICE_NAME], false);
        sc(&["delete", MESH_SERVICE_NAME], false)?;
        revoke()
    }

    fn run_tunnel_service() -> Result<(), String> {
        let data = data_dir()?;
        let desired: DesiredTunnelConfig = serde_json::from_slice(
            &fs::read(data.join(DESIRED_FILE))
                .map_err(display_error("read tunnel configuration"))?,
        )
        .map_err(|_| "invalid protected tunnel configuration".to_owned())?;
        desired.validate().map_err(|error| error.to_string())?;
        let custody_path = data.join(desired.key_slot.custody_file_name());
        let private = dpapi::unprotect(
            &fs::read(custody_path).map_err(display_error("read DPAPI key custody"))?,
        )
        .map_err(|error| error.to_string())?;
        let rendered = desired
            .render(&private)
            .map_err(|error| error.to_string())?;
        let runtime_path = data.join(RUNTIME_CONFIG_FILE);
        write_atomic(&runtime_path, rendered.as_bytes())?;
        lock_file_for_service(&runtime_path)?;

        let mut state = read_state()?;
        state.state = TunnelState::Starting;
        state.last_error = None;
        state.updated_at = Utc::now().to_rfc3339();
        write_state(&state)?;
        let result = invoke_tunnel_dll(&install_dir()?.join(TUNNEL_DLL), &runtime_path);
        let _ = fs::remove_file(&runtime_path);
        state.state = if result.is_ok() {
            TunnelState::Stopped
        } else {
            TunnelState::Degraded
        };
        state.last_error = result
            .as_ref()
            .err()
            .map(|_| "Tunnel service stopped unexpectedly".to_owned());
        state.updated_at = Utc::now().to_rfc3339();
        let _ = write_state(&state);
        result
    }

    fn provision_key(slot: KeySlot) -> Result<PublicKeyRecord, String> {
        let (private, public_key) = PrivateKeyMaterial::generate();
        let protected = dpapi::protect(&private).map_err(|error| error.to_string())?;
        let path = data_dir()?.join(slot.custody_file_name());
        write_atomic(&path, &protected)?;
        lock_file_for_service(&path)?;
        Ok(PublicKeyRecord {
            key_id: format!("wg-{}", Uuid::new_v4()),
            public_key,
            custody_ref: slot.custody_reference(),
            created_at: Utc::now().to_rfc3339(),
        })
    }

    fn create_or_update_service(executable: &Path) -> Result<(), String> {
        let binary_path = format!("\"{}\" /service", executable.display());
        let query = Command::new("sc.exe")
            .args(["query", MESH_SERVICE_NAME])
            .output();
        if query
            .as_ref()
            .map(|output| output.status.success())
            .unwrap_or(false)
        {
            sc(
                &[
                    "config",
                    MESH_SERVICE_NAME,
                    "binPath=",
                    &binary_path,
                    "start=",
                    "auto",
                    "depend=",
                    "Nsi/TcpIp",
                ],
                true,
            )?;
        } else {
            sc(
                &[
                    "create",
                    MESH_SERVICE_NAME,
                    "binPath=",
                    &binary_path,
                    "start=",
                    "auto",
                    "depend=",
                    "Nsi/TcpIp",
                    "DisplayName=",
                    "Omnix Private Mesh",
                ],
                true,
            )?;
        }
        sc(&["sidtype", MESH_SERVICE_NAME, "unrestricted"], true)?;
        sc(
            &[
                "failure",
                MESH_SERVICE_NAME,
                "reset=",
                "86400",
                "actions=",
                "restart/5000/restart/15000/none/0",
            ],
            true,
        )
    }

    fn verify_staged_artifacts(stage: &Path) -> Result<(), String> {
        let tunnel_hash = TUNNEL_SHA256.ok_or_else(|| {
            "mesh helper was built without a pinned tunnel.dll checksum".to_owned()
        })?;
        let wireguard_hash = WIREGUARD_SHA256.ok_or_else(|| {
            "mesh helper was built without a pinned wireguard.dll checksum".to_owned()
        })?;
        verify_hash(&stage.join(TUNNEL_DLL), tunnel_hash)?;
        verify_hash(&stage.join(WIREGUARD_DLL), wireguard_hash)?;
        for file in [
            stage.join(HELPER_FILE),
            stage.join(TUNNEL_DLL),
            stage.join(WIREGUARD_DLL),
        ] {
            verify_authenticode(&file)?;
        }
        Ok(())
    }

    fn verify_hash(path: &Path, expected: &str) -> Result<(), String> {
        if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("invalid embedded artifact checksum".to_owned());
        }
        let actual = hex::encode(Sha256::digest(
            fs::read(path).map_err(display_error("read staged artifact"))?,
        ));
        if actual.eq_ignore_ascii_case(expected) {
            Ok(())
        } else {
            Err("staged mesh artifact checksum mismatch".to_owned())
        }
    }

    fn verify_authenticode(path: &Path) -> Result<(), String> {
        let escaped = path.display().to_string().replace('\'', "''");
        let command = format!(
            "if ((Get-AuthenticodeSignature -LiteralPath '{}').Status -ne 'Valid') {{ exit 41 }}",
            escaped
        );
        let status = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &command])
            .status()
            .map_err(display_error("verify Authenticode signature"))?;
        status
            .success()
            .then_some(())
            .ok_or_else(|| "mesh artifact has no valid Authenticode signature".to_owned())
    }

    fn invoke_tunnel_dll(dll: &Path, config: &Path) -> Result<(), String> {
        type TunnelProc = unsafe extern "C" fn(*const u16) -> i32;
        let dll_wide = wide(dll.as_os_str());
        let module = unsafe { LoadLibraryW(dll_wide.as_ptr()) };
        if module.is_null() {
            return Err("could not load verified tunnel.dll".to_owned());
        }
        let symbol = CString::new("WireGuardTunnelService").expect("fixed symbol");
        let procedure = unsafe { GetProcAddress(module, symbol.as_ptr()) };
        if procedure.is_null() {
            unsafe { FreeLibrary(module) };
            return Err("verified tunnel.dll is missing WireGuardTunnelService".to_owned());
        }
        let config_wide = wide(config.as_os_str());
        let tunnel: TunnelProc = unsafe { std::mem::transmute(procedure) };
        let success = unsafe { tunnel(config_wide.as_ptr()) };
        unsafe { FreeLibrary(module) };
        if success != 0 {
            Ok(())
        } else {
            Err("WireGuard tunnel service returned failure".to_owned())
        }
    }

    fn read_state() -> Result<PublicMeshState, String> {
        serde_json::from_slice(
            &fs::read(data_dir()?.join(PUBLIC_STATE_FILE))
                .map_err(display_error("read mesh state"))?,
        )
        .map_err(|_| "invalid mesh state".to_owned())
    }

    fn write_state(state: &PublicMeshState) -> Result<(), String> {
        let bytes =
            serde_json::to_vec_pretty(state).map_err(|_| "serialize mesh state".to_owned())?;
        let path = data_dir()?.join(PUBLIC_STATE_FILE);
        write_atomic(&path, &bytes)?;
        lock_file_for_read(&path)
    }

    fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
        const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
        const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

        let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
        fs::write(&temporary, bytes).map_err(display_error("write protected mesh file"))?;
        let temporary_wide = wide(temporary.as_os_str());
        let destination_wide = wide(path.as_os_str());
        let replaced = unsafe {
            MoveFileExW(
                temporary_wide.as_ptr(),
                destination_wide.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if replaced == 0 {
            let _ = fs::remove_file(&temporary);
            return Err("replace protected mesh file".to_owned());
        }
        Ok(())
    }

    fn install_dir() -> Result<PathBuf, String> {
        std::env::var_os("ProgramFiles")
            .map(PathBuf::from)
            .map(|path| path.join(INSTALL_FOLDER))
            .ok_or_else(|| "ProgramFiles is unavailable".to_owned())
    }

    fn data_dir() -> Result<PathBuf, String> {
        std::env::var_os("ProgramData")
            .map(PathBuf::from)
            .map(|path| path.join(DATA_FOLDER))
            .ok_or_else(|| "ProgramData is unavailable".to_owned())
    }

    fn current_parent() -> Result<PathBuf, String> {
        std::env::current_exe()
            .map_err(display_error("locate mesh helper"))?
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "mesh helper has no parent directory".to_owned())
    }

    fn lock_directory(path: &Path) -> Result<(), String> {
        run_icacls(vec![
            path.as_os_str().to_owned(),
            "/inheritance:r".into(),
            "/grant:r".into(),
            "SYSTEM:(OI)(CI)F".into(),
            "*S-1-5-32-544:(OI)(CI)F".into(),
            "*S-1-5-32-545:(OI)(CI)RX".into(),
        ])
    }

    fn lock_file_for_inbox(path: &Path) -> Result<(), String> {
        run_icacls(vec![
            path.as_os_str().to_owned(),
            "/inheritance:r".into(),
            "/grant:r".into(),
            "SYSTEM:F".into(),
            "*S-1-5-32-544:F".into(),
            "*S-1-5-32-545:W".into(),
        ])
    }

    fn lock_file_for_service(path: &Path) -> Result<(), String> {
        run_icacls(vec![
            path.as_os_str().to_owned(),
            "/inheritance:r".into(),
            "/grant:r".into(),
            "SYSTEM:F".into(),
            "*S-1-5-32-544:F".into(),
            format!("NT SERVICE\\{MESH_SERVICE_NAME}:R").into(),
        ])
    }

    fn lock_file_for_read(path: &Path) -> Result<(), String> {
        run_icacls(vec![
            path.as_os_str().to_owned(),
            "/inheritance:r".into(),
            "/grant:r".into(),
            "SYSTEM:F".into(),
            "*S-1-5-32-544:F".into(),
            "*S-1-5-32-545:R".into(),
        ])
    }

    fn run_icacls(args: Vec<std::ffi::OsString>) -> Result<(), String> {
        let status = Command::new("icacls.exe")
            .args(args)
            .status()
            .map_err(display_error("apply mesh ACL"))?;
        status
            .success()
            .then_some(())
            .ok_or_else(|| "failed to apply protected mesh ACL".to_owned())
    }

    fn sc(arguments: &[&str], require_success: bool) -> Result<(), String> {
        let output = Command::new("sc.exe")
            .args(arguments)
            .output()
            .map_err(display_error("run Service Control Manager command"))?;
        if require_success && !output.status.success() {
            return Err(
                "Windows Service Control Manager rejected the Private Mesh operation".to_owned(),
            );
        }
        Ok(())
    }

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    fn display_error(context: &'static str) -> impl FnOnce(std::io::Error) -> String {
        move |_| context.to_owned()
    }

    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn LoadLibraryW(file_name: *const u16) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, procedure_name: *const c_char) -> *mut c_void;
        fn FreeLibrary(module: *mut c_void) -> i32;
        fn MoveFileExW(
            existing_file_name: *const u16,
            new_file_name: *const u16,
            flags: u32,
        ) -> i32;
    }
}
