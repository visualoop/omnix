// License verification module
// Validates RSA-signed license keys issued by the Omnix licensing server.

use rsa::{pkcs1v15::VerifyingKey, pkcs8::DecodePublicKey, RsaPublicKey};
use rsa::signature::Verifier;
use rsa::pkcs1v15::Signature;
use sha2::Sha256;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::Digest;

/// Embedded public key (PEM). Replace with production key before release.
const LICENSE_PUBLIC_KEY_PEM: &str = include_str!("../../../keys/license-public.pem");

/// License payload — what the server signs and embeds in the key.
///
/// Schema versions:
/// - v1: only `feat` (feature flags), implicitly the Dawa/pharmacy product.
/// - v2: adds `modules` (paid verticals) + `max_devices` (seat count).
///
/// New fields use `#[serde(default)]` so v1 keys still deserialize. Use
/// `effective_modules()` / `effective_max_devices()` to read entitlements
/// regardless of the key's schema version.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
    pub kid: String,                 // license key ID (human-readable, e.g., "OMNIX-2026-A1B2-C3D4")
    pub name: String,                // customer/business name
    pub email: String,               // customer email
    pub issued: String,              // ISO date
    pub maint_exp: String,           // maintenance expiry ISO date (when updates stop being free)
    #[serde(rename = "type")]
    pub license_type: String,        // "perpetual" | "trial" | "subscription"
    #[serde(default)]
    pub feat: Vec<String>,           // enabled feature flags (v1; still used for compliance toggles)
    #[serde(default)]
    pub modules: Vec<String>,        // paid verticals (v2): dawa | retail | hardware | hospitality
    #[serde(default)]
    pub max_devices: u32,            // seat count (v2). 0 = treat as 1 for legacy keys.
    pub ver: u32,                    // payload schema version
}

impl LicensePayload {
    /// Resolve the licensed modules regardless of schema version.
    /// v2 keys carry `modules` directly. v1 keys are mapped from `feat`
    /// (legacy keys were always the pharmacy/Dawa product).
    pub fn effective_modules(&self) -> Vec<String> {
        if !self.modules.is_empty() {
            return self.modules.clone();
        }
        let mut out = Vec::new();
        for f in &self.feat {
            match f.as_str() {
                "pharmacy" => out.push("dawa".to_string()),
                "retail" => out.push("retail".to_string()),
                "hardware" => out.push("hardware".to_string()),
                "hospitality" => out.push("hospitality".to_string()),
                _ => {}
            }
        }
        if out.is_empty() {
            // Legacy fallback: any v1 key without a recognizable module is Dawa.
            out.push("dawa".to_string());
        }
        out
    }

    /// Seat count, defaulting to 1 for legacy/zero values.
    #[allow(dead_code)] // consumed by the online-activation + seat-enforcement command layer
    pub fn effective_max_devices(&self) -> u32 {
        if self.max_devices == 0 {
            1
        } else {
            self.max_devices
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedLicense {
    pub payload: LicensePayload,
    pub raw_key: String,             // the original key string (to store)
}

#[derive(Debug, thiserror::Error)]
pub enum LicenseError {
    #[error("Invalid license key format")]
    InvalidFormat,
    #[error("Failed to decode license payload: {0}")]
    DecodeError(String),
    #[error("License signature verification failed")]
    SignatureInvalid,
    #[error("Failed to load public key: {0}")]
    PublicKeyError(String),
}

/// Verify a license key string and return the decoded payload.
///
/// Format: `OMNIX-<base64url(json)>.<base64url(rsa_signature)>`
pub fn verify_license_key(key: &str) -> Result<VerifiedLicense, LicenseError> {
    // Strip ALL whitespace (not just trim) — copy-paste often inserts
    // line breaks mid-string when the email client / terminal wraps.
    let cleaned: String = key.chars().filter(|c| !c.is_whitespace()).collect();
    let key_body = cleaned
        .strip_prefix("OMNIX-")
        .or_else(|| cleaned.strip_prefix("SOKO-")) // legacy keys issued before the Omnix rename
        .unwrap_or(&cleaned);

    let parts: Vec<&str> = key_body.split('.').collect();
    if parts.len() != 2 {
        return Err(LicenseError::InvalidFormat);
    }

    let payload_b64 = parts[0];
    let sig_b64 = parts[1];

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|e| LicenseError::DecodeError(format!("payload b64: {}", e)))?;

    let sig_bytes = URL_SAFE_NO_PAD
        .decode(sig_b64)
        .map_err(|e| LicenseError::DecodeError(format!("sig b64: {}", e)))?;

    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| LicenseError::DecodeError(format!("json: {}", e)))?;

    // Verify RSA signature
    let pk = RsaPublicKey::from_public_key_pem(LICENSE_PUBLIC_KEY_PEM)
        .map_err(|e| LicenseError::PublicKeyError(e.to_string()))?;

    let verifying_key: VerifyingKey<Sha256> = VerifyingKey::new(pk);
    let signature = Signature::try_from(sig_bytes.as_slice())
        .map_err(|_| LicenseError::SignatureInvalid)?;

    verifying_key
        .verify(&payload_bytes, &signature)
        .map_err(|_| LicenseError::SignatureInvalid)?;

    Ok(VerifiedLicense {
        payload,
        raw_key: cleaned,
    })
}

/// Compute a stable machine fingerprint.
///
/// Combines: machine UUID + first MAC address + CPU brand
/// Returns hex SHA-256 truncated to 16 chars (good enough as ID).
pub fn get_machine_fingerprint() -> String {
    let machine_uuid = machine_uid::get().unwrap_or_else(|_| "unknown".to_string());

    let mut sys = sysinfo::System::new();
    sys.refresh_cpu_all();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let combined = format!("{}|{}", machine_uuid, cpu_brand);
    let hash = sha2::Sha256::digest(combined.as_bytes());
    hex::encode(&hash[..8]).to_uppercase()
}

/// Format the machine fingerprint for display (groups of 4)
pub fn format_fingerprint(fp: &str) -> String {
    fp.chars()
        .collect::<Vec<_>>()
        .chunks(4)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A real license key generated by scripts/generate-license.mjs against keys/license-private.pem.
    /// If the keypair is regenerated, this test will fail and must be updated.
    const VALID_TEST_KEY: &str = "OMNIX-eyJraWQiOiJTT0tPLTIwMjYtWkZSWi05NFo0IiwibmFtZSI6IkludGVncmF0aW9uIFRlc3QiLCJlbWFpbCI6InRlc3RAaW50ZWdyYXRpb24ubG9jYWwiLCJpc3N1ZWQiOiIyMDI2LTA1LTI1IiwibWFpbnRfZXhwIjoiMjAyNy0wNS0yNSIsInR5cGUiOiJwZXJwZXR1YWwiLCJmZWF0IjpbInBoYXJtYWN5IiwiZXRpbXMiLCJpbnN1cmFuY2UiLCJsYW4iLCJyZXBvcnRzIl0sInZlciI6MX0.mfKvN1ppsDGIwD47BXC_jLlAaGJf8_WpzWOZetL-aoivF5wEi2lzO4ux13gFNB22oYDIOsltzsEXmZ55OplDH-cftvmyGnURiCS45UZ9cwl1uSUx3UmKzgf4sJzyo5Y8A-clkDJu6IuckIXGzAHg8kW7651V5jFHo7YY0cQ_dokZCM9y9lnlDKgan3egN74UvlniWwWWJXhGp7csiSV6V4u4MOLdS0Ycx698PzmhsIQO9mWhuL-IiyaRhft3seOKU4CI07wTDkfZwh88BIYlRPwNJ2u_McV2estEKQ7T2vuioxMOwy1lOK8ZYokBWCsYhn9QbTYtgajFjMuIE6v6Sw";

    #[test]
    fn rejects_garbage() {
        assert!(verify_license_key("not-a-license").is_err());
        assert!(verify_license_key("OMNIX-aaa.bbb").is_err());
        assert!(verify_license_key("").is_err());
    }

    #[test]
    fn rejects_tampered_payload() {
        // Valid format but signature won't verify against a fake payload
        let bad = "OMNIX-eyJraWQiOiJ0YW1wZXJlZCIsIm5hbWUiOiJoYWNrZXIifQ.AAAA";
        assert!(matches!(
            verify_license_key(bad),
            Err(LicenseError::SignatureInvalid) | Err(LicenseError::DecodeError(_))
        ));
    }

    #[test]
    fn accepts_real_signed_key() {
        let result = verify_license_key(VALID_TEST_KEY);
        let verified = result.expect("real generated key must verify");
        assert_eq!(verified.payload.name, "Integration Test");
        assert_eq!(verified.payload.email, "test@integration.local");
        assert_eq!(verified.payload.license_type, "perpetual");
        assert!(verified.payload.feat.contains(&"pharmacy".to_string()));
    }

    /// A real v2 key generated with `--modules hardware --max-devices 2`.
    const VALID_V2_KEY: &str = "OMNIX-eyJraWQiOiJPTU5JWC0yMDI2LVlLN1ctWk5XOCIsIm5hbWUiOiJIYXJkd2FyZSBUZXN0IiwiZW1haWwiOiJod0BpbnRlZ3JhdGlvbi5sb2NhbCIsImlzc3VlZCI6IjIwMjYtMDYtMDEiLCJtYWludF9leHAiOiIyMDI3LTA2LTAxIiwidHlwZSI6InBlcnBldHVhbCIsImZlYXQiOlsiZXRpbXMiLCJpbnN1cmFuY2UiLCJsYW4iLCJyZXBvcnRzIl0sIm1vZHVsZXMiOlsiaGFyZHdhcmUiXSwibWF4X2RldmljZXMiOjIsInZlciI6Mn0.BE3vglO7KfMEu0Dx8WuZjugcS45dwprcNVapnGRDuI5sK_P5ok5LLWstCdqGiYdUOzdZJoVyBZ9SsFsG-jZ9kYlOqFVfb9kOFJ08lLMkXifmxotFmi7drv_pQV5vpEt4XaS1AH7XKugsKMSe6yGqsDGBeqR-CHn7x8amKuaLG_KxKVvWy-DvTWL_rTM4fDkTeYAGw7nnLwLojgP_t-vXTkY51utomhxQbRa-o0FoNYmuMRwnvbCSZYVnPcErtIjM1cIMAgW2CPz61A6LzX9Hk75rL-jVKmy_TQJhL0AnUQxaDTGBgmizOZm-_Onp-ACsAhdEahATuknLICCRVWIx_g";

    #[test]
    fn accepts_v2_key_with_entitlements() {
        let verified = verify_license_key(VALID_V2_KEY).expect("v2 key must verify");
        assert_eq!(verified.payload.ver, 2);
        assert_eq!(verified.payload.effective_modules(), vec!["hardware".to_string()]);
        assert_eq!(verified.payload.effective_max_devices(), 2);
    }

    #[test]
    fn v1_key_maps_feat_to_modules_and_single_seat() {
        // The v1 test key has feat=[pharmacy,...] and no modules/max_devices.
        let verified = verify_license_key(VALID_TEST_KEY).expect("v1 key must verify");
        assert_eq!(verified.payload.ver, 1);
        assert_eq!(verified.payload.effective_modules(), vec!["dawa".to_string()]);
        assert_eq!(verified.payload.effective_max_devices(), 1);
    }

    #[test]
    fn rejects_tampered_modules() {
        // Take the valid v2 key and flip a char inside the payload (modules region).
        // Any payload mutation must break the signature.
        let parts: Vec<&str> = VALID_V2_KEY.strip_prefix("OMNIX-").unwrap().split('.').collect();
        let mut payload_chars: Vec<char> = parts[0].chars().collect();
        let mid = payload_chars.len() / 2;
        payload_chars[mid] = if payload_chars[mid] == 'A' { 'B' } else { 'A' };
        let tampered: String = payload_chars.into_iter().collect();
        let bad_key = format!("OMNIX-{}.{}", tampered, parts[1]);
        assert!(matches!(
            verify_license_key(&bad_key),
            Err(LicenseError::SignatureInvalid) | Err(LicenseError::DecodeError(_))
        ));
    }

    #[test]
    fn rejects_mutated_signature() {
        // Take a valid key but flip one character in the signature
        let mut chars: Vec<char> = VALID_TEST_KEY.chars().collect();
        let last_idx = chars.len() - 1;
        chars[last_idx] = if chars[last_idx] == 'A' { 'B' } else { 'A' };
        let mutated: String = chars.into_iter().collect();
        assert!(matches!(
            verify_license_key(&mutated),
            Err(LicenseError::SignatureInvalid)
        ));
    }

    #[test]
    fn machine_fingerprint_is_stable() {
        let fp1 = get_machine_fingerprint();
        let fp2 = get_machine_fingerprint();
        assert_eq!(fp1, fp2);
        assert_eq!(fp1.len(), 16);
    }

    #[test]
    fn format_fingerprint_groups_in_4s() {
        assert_eq!(format_fingerprint("ABCD1234EFGH5678"), "ABCD-1234-EFGH-5678");
    }
}
