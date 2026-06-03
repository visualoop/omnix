// Cloud backup — uploads an encrypted+gzipped copy of the SQLite DB to the
// website's R2 bucket via presigned URLs.
//
// Encryption: AES-256-GCM. Key derived from `password + machineId` via
// SHA-256 (deterministic so the same machine + password can decrypt later).
// The plaintext DB never leaves the device — the server only sees an opaque
// blob, its size, and its sha256.
//
// Pipeline (upload):
//   1. Hot-copy SQLite via `VACUUM INTO` to a temp file (consistent snapshot).
//   2. gzip → AES-256-GCM encrypt with derived key + random 12-byte nonce.
//   3. POST /api/cloud-backups/presign (machine bearer auth) to get a PUT URL.
//   4. Stream the encrypted blob to the presigned URL.
//   5. POST /api/cloud-backups/finalize with size + sha256.
//
// Pipeline (restore):
//   1. POST /api/cloud-backups/:id/download → presigned GET URL.
//   2. Stream → AES-256-GCM decrypt → gunzip → write to a temp file.
//   3. Hand off to backup.rs::restore_backup with the temp file as source.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::Manager;

use crate::license::format_fingerprint;

const NONCE_LEN: usize = 12;

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudBackupPresignResp {
    #[serde(rename = "backupId")]
    pub backup_id: String,
    #[serde(rename = "objectKey")]
    pub object_key: String,
    pub bucket: String,
    #[serde(rename = "uploadUrl")]
    pub upload_url: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    #[serde(rename = "pruneAfter")]
    pub prune_after: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudBackupRow {
    pub id: String,
    #[serde(rename = "objectKey")]
    pub object_key: String,
    #[serde(rename = "machineId", default)]
    pub machine_id: Option<String>,
    #[serde(rename = "desktopVersion", default)]
    pub desktop_version: Option<String>,
    #[serde(rename = "sizeBytes", default)]
    pub size_bytes: Option<u64>,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "finalizedAt", default)]
    pub finalized_at: Option<String>,
    #[serde(rename = "pruneAfter", default)]
    pub prune_after: Option<String>,
    #[serde(rename = "clientKeyHint", default)]
    pub client_key_hint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudBackupListResp {
    pub backups: Vec<CloudBackupRow>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudBackupDownloadResp {
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    pub sha256: Option<String>,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: Option<u64>,
    #[serde(rename = "objectKey")]
    pub object_key: String,
}

#[derive(Debug, Serialize)]
pub struct CloudBackupResult {
    pub object_key: String,
    pub size_bytes: u64,
    pub sha256: String,
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("omnix.db"))
}

fn temp_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let t = dir.join("tmp");
    if !t.exists() {
        fs::create_dir_all(&t).map_err(|e| e.to_string())?;
    }
    Ok(t)
}

/// Derive a 32-byte AES-256 key from password + machineId.
/// SHA-256(password || ":" || machineId). Deterministic so future restores work.
fn derive_key(password: &str, machine_id: &str) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(password.as_bytes());
    h.update(b":");
    h.update(machine_id.as_bytes());
    let out = h.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&out);
    key
}

/// First 8 hex chars of the key — used as a public hint so the user knows
/// which password applied to this backup. Cannot recover the password.
fn key_hint(key: &[u8; 32]) -> String {
    hex::encode(&key[..4])
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts-{}", secs)
}

/// Take a hot snapshot of the live DB via SQLite's VACUUM INTO.
/// VACUUM INTO is the official way to checkpoint to a separate file
/// without locking the source.
fn snapshot_db(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let live = db_path(app)?;
    let snap = temp_dir(app)?.join(format!("snapshot-{}.db", now_iso()));

    // Use rusqlite to run VACUUM INTO
    let conn = rusqlite::Connection::open(&live).map_err(|e| format!("Open DB: {}", e))?;
    let snap_str = snap.to_string_lossy().to_string();
    let escaped = snap_str.replace('\'', "''");
    conn.execute(&format!("VACUUM INTO '{}'", escaped), [])
        .map_err(|e| format!("VACUUM INTO failed: {}", e))?;
    drop(conn);
    Ok(snap)
}

/// Compress + encrypt a file. Returns the encrypted bytes (nonce || ciphertext).
fn pack_blob(src: &PathBuf, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let raw = fs::read(src).map_err(|e| format!("Read snapshot: {}", e))?;

    // Gzip
    let mut gz = GzEncoder::new(Vec::new(), Compression::default());
    gz.write_all(&raw).map_err(|e| format!("gzip write: {}", e))?;
    let compressed = gz.finish().map_err(|e| format!("gzip finish: {}", e))?;

    // AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "Bad key length".to_string())?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, compressed.as_ref())
        .map_err(|e| format!("encrypt failed: {}", e))?;

    // Final blob = nonce || ciphertext
    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt + decompress a blob into raw SQLite bytes.
fn unpack_blob(blob: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if blob.len() <= NONCE_LEN {
        return Err("Encrypted blob too short".to_string());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "Bad key length".to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let compressed = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "decrypt failed — wrong password?".to_string())?;

    // Gunzip
    let mut gz = GzDecoder::new(&compressed[..]);
    let mut raw = Vec::with_capacity(compressed.len() * 4);
    gz.read_to_end(&mut raw).map_err(|e| format!("gunzip: {}", e))?;
    Ok(raw)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

/// Fully integrated upload: snapshot → pack → presign → PUT → finalize.
///
/// `api_base`: e.g. "https://omnix.co.ke"
/// `auth_token`: machine bearer (the one returned from /licenses/activate).
/// `password`: the customer's encryption secret (derived in JS from owner password
///             or a dedicated "backup password"). NEVER persisted.
#[tauri::command]
pub async fn cloud_backup_upload(
    app: tauri::AppHandle,
    api_base: String,
    auth_token: String,
    password: String,
    desktop_version: Option<String>,
) -> Result<CloudBackupResult, String> {
    let machine_id = format_fingerprint(&crate::license::get_machine_fingerprint());
    let key = derive_key(&password, &machine_id);
    let hint = key_hint(&key);

    // 1. Snapshot
    let snap = snapshot_db(&app)?;
    let source_size = fs::metadata(&snap).map(|m| m.len()).unwrap_or(0);

    // 2. Pack
    let blob = pack_blob(&snap, &key)?;
    let _ = fs::remove_file(&snap); // best-effort cleanup
    let size_bytes = blob.len() as u64;
    let sha256 = sha256_hex(&blob);

    // 3. Presign
    let client = reqwest::Client::new();
    let presign_url = format!("{}/api/cloud-backups/presign", api_base.trim_end_matches('/'));
    let presign_body = serde_json::json!({
        "sourceSizeBytes": source_size,
        "desktopVersion": desktop_version,
        "clientKeyHint": hint,
    });
    let presign: CloudBackupPresignResp = client
        .post(&presign_url)
        .bearer_auth(&auth_token)
        .json(&presign_body)
        .send()
        .await
        .map_err(|e| format!("Presign request: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Presign HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Presign decode: {}", e))?;

    // 4. PUT to the presigned URL
    let put = client
        .put(&presign.upload_url)
        .header("content-type", "application/octet-stream")
        .body(blob)
        .send()
        .await
        .map_err(|e| format!("Upload PUT: {}", e))?;
    if !put.status().is_success() {
        return Err(format!("Upload PUT failed: HTTP {}", put.status()));
    }

    // 5. Finalize
    let finalize_url = format!("{}/api/cloud-backups/finalize", api_base.trim_end_matches('/'));
    let finalize_body = serde_json::json!({
        "objectKey": presign.object_key,
        "sizeBytes": size_bytes,
        "sha256": sha256,
    });
    client
        .post(&finalize_url)
        .bearer_auth(&auth_token)
        .json(&finalize_body)
        .send()
        .await
        .map_err(|e| format!("Finalize: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Finalize HTTP error: {}", e))?;

    Ok(CloudBackupResult {
        object_key: presign.object_key,
        size_bytes,
        sha256,
    })
}

/// List cloud backups for the current customer (uses cookie auth — must be
/// logged in to the dashboard via the website session) OR machine bearer.
/// In-app we'll pass the machine bearer for simplicity.
#[tauri::command]
pub async fn cloud_backup_list(
    api_base: String,
    auth_token: String,
) -> Result<Vec<CloudBackupRow>, String> {
    let url = format!("{}/api/cloud-backups", api_base.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp: CloudBackupListResp = client
        .get(&url)
        .bearer_auth(&auth_token)
        .send()
        .await
        .map_err(|e| format!("List request: {}", e))?
        .error_for_status()
        .map_err(|e| format!("List HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("List decode: {}", e))?;
    Ok(resp.backups)
}

/// Restore a backup by its server-side ID.
/// Downloads the blob, decrypts with the user-supplied password, verifies the
/// sha256, gunzips, and writes to a temp file. The frontend then calls
/// backup::restore_backup with that filename.
#[tauri::command]
pub async fn cloud_backup_restore(
    app: tauri::AppHandle,
    api_base: String,
    auth_token: String,
    backup_id: String,
    password: String,
) -> Result<String, String> {
    // 1. Get presigned download URL
    let url = format!(
        "{}/api/cloud-backups/{}/download",
        api_base.trim_end_matches('/'),
        backup_id
    );
    let client = reqwest::Client::new();
    let info: CloudBackupDownloadResp = client
        .post(&url)
        .bearer_auth(&auth_token)
        .send()
        .await
        .map_err(|e| format!("Download URL request: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Download URL HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Download URL decode: {}", e))?;

    // 2. Fetch the blob
    let blob = client
        .get(&info.download_url)
        .send()
        .await
        .map_err(|e| format!("GET blob: {}", e))?
        .error_for_status()
        .map_err(|e| format!("GET blob HTTP: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("GET blob read: {}", e))?
        .to_vec();

    // 3. Verify sha256 if server provided one
    if let Some(expected) = &info.sha256 {
        let actual = sha256_hex(&blob);
        if !actual.eq_ignore_ascii_case(expected) {
            return Err("sha256 mismatch — backup may be corrupt".to_string());
        }
    }

    // 4. Decrypt + gunzip
    let machine_id = format_fingerprint(&crate::license::get_machine_fingerprint());
    let key = derive_key(&password, &machine_id);
    let raw = unpack_blob(&blob, &key)?;

    // 5. Write to a restore-staging file. Caller invokes restore_backup with this.
    let staging = temp_dir(&app)?.join(format!(
        "cloud-restore-{}.db",
        now_iso()
    ));
    fs::write(&staging, &raw).map_err(|e| format!("Write staging: {}", e))?;
    Ok(staging.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_tmp(prefix: &str) -> PathBuf {
        std::env::temp_dir().join(format!("{}-{}.db", prefix, uuid::Uuid::new_v4()))
    }

    #[test]
    fn pack_unpack_roundtrip_preserves_bytes() {
        let tmp = unique_tmp("omnix-pack");
        let payload = b"PRAGMA omnix-test = 1;".repeat(200);
        fs::write(&tmp, &payload).unwrap();

        let key = derive_key("hunter2", "MACH-ABC-1234");
        let blob = pack_blob(&tmp, &key).unwrap();
        assert!(blob.len() > NONCE_LEN);
        let raw = unpack_blob(&blob, &key).unwrap();
        assert_eq!(raw, payload);
        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn unpack_with_wrong_password_fails() {
        let tmp = unique_tmp("omnix-wrongpw");
        fs::write(&tmp, b"data").unwrap();
        let key = derive_key("right", "M");
        let blob = pack_blob(&tmp, &key).unwrap();
        let wrong = derive_key("wrong", "M");
        let err = unpack_blob(&blob, &wrong).unwrap_err();
        assert!(err.contains("decrypt"));
        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn key_hint_is_8_hex_chars() {
        let k = derive_key("a", "b");
        assert_eq!(key_hint(&k).len(), 8);
        assert!(key_hint(&k).chars().all(|c| c.is_ascii_hexdigit()));
    }
}

/* ─── Auto-backup state + commands ───────────────────────────────────────
   The owner password is needed to derive the encryption key. Rather than
   persist it on disk (insecure), we hold the *derived 32-byte key* in
   memory only. The frontend calls `cloud_backup_set_session_key(password)`
   right after the user signs in, and `cloud_backup_clear_session_key()`
   on sign-out. The scheduler then uploads silently in the background as
   long as the app is open and signed-in.
*/

#[derive(Default)]
pub struct CloudBackupSession {
    pub key: Mutex<Option<[u8; 32]>>,
}

#[tauri::command]
pub fn cloud_backup_set_session_key(
    password: String,
    state: tauri::State<'_, std::sync::Arc<CloudBackupSession>>,
) -> Result<String, String> {
    let machine_id = format_fingerprint(&crate::license::get_machine_fingerprint());
    let key = derive_key(&password, &machine_id);
    let hint = key_hint(&key);
    *state.key.lock().map_err(|e| e.to_string())? = Some(key);
    Ok(hint)
}

#[tauri::command]
pub fn cloud_backup_clear_session_key(
    state: tauri::State<'_, std::sync::Arc<CloudBackupSession>>,
) -> Result<(), String> {
    *state.key.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub fn cloud_backup_has_session_key(
    state: tauri::State<'_, std::sync::Arc<CloudBackupSession>>,
) -> Result<bool, String> {
    Ok(state.key.lock().map_err(|e| e.to_string())?.is_some())
}

/// Upload using the in-memory session key (set by `set_session_key`).
/// Used by the scheduler so we don't have to prompt the user for a password
/// on every auto-backup. Returns 'no-key' if the key isn't loaded.
#[tauri::command]
pub async fn cloud_backup_auto_upload(
    app: tauri::AppHandle,
    api_base: String,
    auth_token: String,
    desktop_version: Option<String>,
    state: tauri::State<'_, std::sync::Arc<CloudBackupSession>>,
) -> Result<CloudBackupResult, String> {
    let key = {
        let guard = state.key.lock().map_err(|e| e.to_string())?;
        match guard.as_ref() {
            Some(k) => *k,
            None => return Err("no-key".to_string()),
        }
    };
    let machine_id = format_fingerprint(&crate::license::get_machine_fingerprint());
    let hint = key_hint(&key);

    let snap = snapshot_db(&app)?;
    let source_size = fs::metadata(&snap).map(|m| m.len()).unwrap_or(0);
    let blob = pack_blob(&snap, &key)?;
    let _ = fs::remove_file(&snap);
    let size_bytes = blob.len() as u64;
    let sha256 = sha256_hex(&blob);

    let client = reqwest::Client::new();
    let presign_url = format!("{}/api/cloud-backups/presign", api_base.trim_end_matches('/'));
    let presign: CloudBackupPresignResp = client
        .post(&presign_url)
        .bearer_auth(&auth_token)
        .json(&serde_json::json!({
            "sourceSizeBytes": source_size,
            "desktopVersion": desktop_version,
            "clientKeyHint": hint,
        }))
        .send()
        .await
        .map_err(|e| format!("Presign request: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Presign HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Presign decode: {}", e))?;

    let put = client
        .put(&presign.upload_url)
        .header("content-type", "application/octet-stream")
        .body(blob)
        .send()
        .await
        .map_err(|e| format!("Upload PUT: {}", e))?;
    if !put.status().is_success() {
        return Err(format!("Upload PUT failed: HTTP {}", put.status()));
    }

    client
        .post(&format!("{}/api/cloud-backups/finalize", api_base.trim_end_matches('/')))
        .bearer_auth(&auth_token)
        .json(&serde_json::json!({
            "objectKey": presign.object_key,
            "sizeBytes": size_bytes,
            "sha256": sha256,
        }))
        .send()
        .await
        .map_err(|e| format!("Finalize: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Finalize HTTP error: {}", e))?;

    let _ = machine_id; // silence unused warning if compiler picks it up
    Ok(CloudBackupResult {
        object_key: presign.object_key,
        size_bytes,
        sha256,
    })
}
