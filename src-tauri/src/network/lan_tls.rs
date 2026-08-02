//! TLS material for the dedicated browser companion listener.
//!
//! The normal paired-till listener remains HTTP for compatibility. This module
//! owns only the browser listener's certificate files. A managed certificate
//! order sends a CSR, never the locally generated private key, to the explicitly
//! configured Omnix DNS-01 helper URL.

use axum_server::tls_rustls::RustlsConfig;
use chrono::{DateTime, Utc};
use rcgen::{CertificateParams, CertifiedKey, KeyPair};
use rustls::client::{danger::ServerCertVerifier, WebPkiServerVerifier};
use rustls::pki_types::{ServerName, UnixTime};
use rustls::RootCertStore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufReader, Cursor};
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

pub const RENEW_BEFORE_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const RENEWAL_CHECK_SECONDS: u64 = 6 * 60 * 60;
const MAX_CERTIFICATE_RESPONSE_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CertificateState {
    Trusted,
    TrustedRenewalDue,
    TrustedRenewing,
    TrustedRenewalDelayed,
    SelfSigned,
    SelfSignedManagedPending,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTlsStatus {
    pub scheme: &'static str,
    pub hostname: String,
    pub certificate_state: CertificateState,
    pub certificate_fingerprint: String,
    pub certificate_expires_at: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CertificateSelection {
    ManagedCurrent,
    ManagedRenewalDue,
    SelfSigned,
    SelfSignedManagedPending,
}

#[derive(Clone, Debug)]
pub struct LanTlsConfig {
    pub storage_dir: PathBuf,
    pub advertised_ip: IpAddr,
    pub managed_hostname: Option<String>,
    pub helper_order_url: Option<String>,
    pub helper_token: Option<String>,
}

impl LanTlsConfig {
    pub fn from_environment(storage_dir: PathBuf, advertised_ip: IpAddr) -> Self {
        Self {
            storage_dir,
            advertised_ip,
            managed_hostname: nonempty_env("OMNIX_LAN_CERT_HOSTNAME"),
            helper_order_url: nonempty_env("OMNIX_ACME_HELPER_ORDER_URL"),
            helper_token: nonempty_env("OMNIX_ACME_HELPER_TOKEN"),
        }
    }

    fn managed_configured(&self) -> bool {
        self.managed_hostname
            .as_deref()
            .is_some_and(valid_dns_hostname)
            && self.helper_order_url.as_deref().is_some_and(|value| {
                reqwest::Url::parse(value).is_ok_and(|url| url.scheme() == "https")
            })
            && self
                .helper_token
                .as_deref()
                .is_some_and(|value| !value.is_empty())
    }

    pub fn advertised_hostname(&self) -> String {
        self.managed_hostname
            .as_deref()
            .filter(|value| valid_dns_hostname(value))
            .map(str::to_owned)
            .unwrap_or_else(|| self.advertised_ip.to_string())
    }
}

#[derive(Clone, Debug)]
pub struct TlsMaterial {
    pub rustls: RustlsConfig,
    pub status: BrowserTlsStatus,
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedMetadata {
    hostname: String,
    not_after_unix_seconds: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CertificateOrderRequest<'a> {
    hostname: &'a str,
    csr_pem: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CertificateOrderResponse {
    certificate_chain_pem: String,
    not_after: String,
}

pub fn select_certificate(
    managed_not_after: Option<i64>,
    managed_configured: bool,
    now: i64,
) -> CertificateSelection {
    match managed_not_after {
        Some(not_after) if not_after > now + RENEW_BEFORE_SECONDS => {
            CertificateSelection::ManagedCurrent
        }
        Some(not_after) if not_after > now => CertificateSelection::ManagedRenewalDue,
        _ if managed_configured => CertificateSelection::SelfSignedManagedPending,
        _ => CertificateSelection::SelfSigned,
    }
}

pub fn renewal_transition(
    previous: CertificateState,
    renewal_succeeded: bool,
    managed_certificate_still_valid: bool,
) -> CertificateState {
    if renewal_succeeded {
        CertificateState::Trusted
    } else if managed_certificate_still_valid {
        CertificateState::TrustedRenewalDelayed
    } else if matches!(
        previous,
        CertificateState::Trusted
            | CertificateState::SelfSignedManagedPending
            | CertificateState::TrustedRenewing
            | CertificateState::TrustedRenewalDue
            | CertificateState::TrustedRenewalDelayed
    ) {
        CertificateState::SelfSignedManagedPending
    } else {
        CertificateState::SelfSigned
    }
}

pub fn renewal_started(previous: CertificateState) -> CertificateState {
    if matches!(
        previous,
        CertificateState::Trusted
            | CertificateState::TrustedRenewalDue
            | CertificateState::TrustedRenewalDelayed
            | CertificateState::TrustedRenewing
    ) {
        CertificateState::TrustedRenewing
    } else {
        CertificateState::SelfSignedManagedPending
    }
}

pub async fn initial_tls_material(config: &LanTlsConfig) -> Result<TlsMaterial, String> {
    fs::create_dir_all(&config.storage_dir)
        .map_err(|error| format!("Failed to create LAN certificate directory: {error}"))?;
    let now = Utc::now().timestamp();
    let metadata = load_managed_metadata(config);
    let selection = select_certificate(
        metadata.as_ref().map(|value| value.not_after_unix_seconds),
        config.managed_configured(),
        now,
    );
    if matches!(
        selection,
        CertificateSelection::ManagedCurrent | CertificateSelection::ManagedRenewalDue
    ) {
        let cert_path = managed_cert_path(config);
        let key_path = managed_key_path(config);
        if cert_path.is_file() && key_path.is_file() {
            let metadata = metadata.expect("selection requires metadata");
            let stored_chain = fs::read_to_string(&cert_path)
                .map_err(|error| format!("Stored managed certificate could not be read: {error}"))
                .and_then(|pem| validate_trusted_certificate_chain(&pem, &metadata.hostname));
            if let Err(error) = stored_chain {
                log::warn!(
                    "stored managed LAN certificate is not publicly trusted for its assigned hostname; using local fallback: {error}"
                );
                return self_signed_material(
                    config,
                    CertificateSelection::SelfSignedManagedPending,
                )
                .await;
            }
            match RustlsConfig::from_pem_file(&cert_path, &key_path).await {
                Ok(rustls) => {
                    return Ok(TlsMaterial {
                        status: BrowserTlsStatus {
                            scheme: "https",
                            hostname: metadata.hostname,
                            certificate_state: if selection == CertificateSelection::ManagedCurrent
                            {
                                CertificateState::Trusted
                            } else {
                                CertificateState::TrustedRenewalDue
                            },
                            certificate_fingerprint: certificate_fingerprint(&cert_path)?,
                            certificate_expires_at: timestamp(metadata.not_after_unix_seconds),
                        },
                        rustls,
                        cert_path,
                        key_path,
                    });
                }
                Err(error) => {
                    log::warn!(
                        "stored managed LAN certificate is unusable; using local fallback: {error}"
                    );
                }
            }
        } else {
            log::warn!("stored managed LAN certificate files are incomplete; using local fallback");
        }
        return self_signed_material(config, CertificateSelection::SelfSignedManagedPending).await;
    }
    self_signed_material(config, selection).await
}

async fn self_signed_material(
    config: &LanTlsConfig,
    selection: CertificateSelection,
) -> Result<TlsMaterial, String> {
    let cert_path = config.storage_dir.join("self-signed-chain.pem");
    let key_path = config.storage_dir.join("self-signed-key.pem");
    if !cert_path.is_file() || !key_path.is_file() {
        let names = if config
            .managed_hostname
            .as_deref()
            .is_some_and(valid_dns_hostname)
        {
            vec![
                config.advertised_hostname(),
                config.advertised_ip.to_string(),
            ]
        } else {
            vec![config.advertised_ip.to_string()]
        };
        let CertifiedKey { cert, key_pair } =
            rcgen::generate_simple_self_signed(names).map_err(|error| error.to_string())?;
        atomic_write(&cert_path, cert.pem().as_bytes(), false)?;
        atomic_write(&key_path, key_pair.serialize_pem().as_bytes(), true)?;
    }
    let rustls = RustlsConfig::from_pem_file(&cert_path, &key_path)
        .await
        .map_err(|error| format!("Local LAN certificate is invalid: {error}"))?;
    Ok(TlsMaterial {
        status: BrowserTlsStatus {
            scheme: "https",
            hostname: config.advertised_hostname(),
            certificate_state: if selection == CertificateSelection::SelfSignedManagedPending {
                CertificateState::SelfSignedManagedPending
            } else {
                CertificateState::SelfSigned
            },
            certificate_fingerprint: certificate_fingerprint(&cert_path)?,
            certificate_expires_at: None,
        },
        rustls,
        cert_path,
        key_path,
    })
}

pub fn renewal_due(config: &LanTlsConfig, now: i64) -> bool {
    config.managed_configured()
        && (!managed_cert_path(config).is_file()
            || !managed_key_path(config).is_file()
            || load_managed_metadata(config)
                .map(|metadata| metadata.not_after_unix_seconds <= now + RENEW_BEFORE_SECONDS)
                .unwrap_or(true))
}

pub async fn renew_managed_certificate(config: &LanTlsConfig) -> Result<TlsMaterial, String> {
    if !config.managed_configured() {
        return Err("Managed LAN certificate service is not configured.".to_string());
    }
    let hostname = config
        .managed_hostname
        .as_deref()
        .expect("managed configuration checked");
    let key_path = managed_key_path(config);
    let key_pair = if key_path.is_file() {
        KeyPair::from_pem(
            &fs::read_to_string(&key_path)
                .map_err(|error| format!("Failed to read the LAN private key: {error}"))?,
        )
        .map_err(|error| format!("Stored LAN private key is invalid: {error}"))?
    } else {
        let key_pair = KeyPair::generate().map_err(|error| error.to_string())?;
        atomic_write(&key_path, key_pair.serialize_pem().as_bytes(), true)?;
        key_pair
    };
    let params = CertificateParams::new(vec![hostname.to_string()])
        .map_err(|error| format!("Invalid managed LAN hostname: {error}"))?;
    let csr_pem = params
        .serialize_request(&key_pair)
        .and_then(|csr| csr.pem())
        .map_err(|error| format!("Failed to create the LAN certificate request: {error}"))?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(
            config
                .helper_order_url
                .as_deref()
                .expect("managed configuration checked"),
        )
        .bearer_auth(
            config
                .helper_token
                .as_deref()
                .expect("managed configuration checked"),
        )
        .json(&CertificateOrderRequest {
            hostname,
            csr_pem: &csr_pem,
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "LAN certificate helper timed out.".to_string()
            } else if error.is_connect() {
                "LAN certificate helper could not be reached.".to_string()
            } else {
                "LAN certificate helper request failed.".to_string()
            }
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "LAN certificate helper returned HTTP {}.",
            response.status().as_u16()
        ));
    }
    if response.content_length().unwrap_or(0) > MAX_CERTIFICATE_RESPONSE_BYTES {
        return Err("LAN certificate helper response was too large.".to_string());
    }
    let response_bytes = response
        .bytes()
        .await
        .map_err(|_| "LAN certificate helper response could not be read.".to_string())?;
    if response_bytes.len() as u64 > MAX_CERTIFICATE_RESPONSE_BYTES {
        return Err("LAN certificate helper response was too large.".to_string());
    }
    let response: CertificateOrderResponse = serde_json::from_slice(&response_bytes)
        .map_err(|_| "LAN certificate helper response was invalid.".to_string())?;
    let not_after = DateTime::parse_from_rfc3339(&response.not_after)
        .map_err(|_| "LAN certificate helper returned an invalid expiry.".to_string())?
        .with_timezone(&Utc)
        .timestamp();
    if not_after <= Utc::now().timestamp() + 24 * 60 * 60 {
        return Err("LAN certificate helper returned an expired certificate.".to_string());
    }
    validate_trusted_certificate_chain(&response.certificate_chain_pem, hostname)?;
    let rustls = RustlsConfig::from_pem(
        response.certificate_chain_pem.as_bytes().to_vec(),
        key_pair.serialize_pem().into_bytes(),
    )
    .await
    .map_err(|error| format!("LAN certificate does not match the hub private key: {error}"))?;
    let cert_path = managed_cert_path(config);
    atomic_write(&cert_path, response.certificate_chain_pem.as_bytes(), false)?;
    let metadata = ManagedMetadata {
        hostname: hostname.to_string(),
        not_after_unix_seconds: not_after,
    };
    atomic_write(
        &managed_metadata_path(config),
        serde_json::to_vec_pretty(&metadata)
            .map_err(|error| error.to_string())?
            .as_slice(),
        false,
    )?;
    Ok(TlsMaterial {
        status: BrowserTlsStatus {
            scheme: "https",
            hostname: hostname.to_string(),
            certificate_state: CertificateState::Trusted,
            certificate_fingerprint: certificate_fingerprint(&cert_path)?,
            certificate_expires_at: timestamp(not_after),
        },
        rustls,
        cert_path,
        key_path,
    })
}

fn validate_trusted_certificate_chain(pem: &str, hostname: &str) -> Result<(), String> {
    let mut reader = BufReader::new(Cursor::new(pem.as_bytes()));
    let certificates = rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Certificate chain PEM is invalid: {error}"))?;
    let (leaf, intermediates) = certificates
        .split_first()
        .ok_or_else(|| "Certificate helper returned no certificates.".to_string())?;
    let server_name = ServerName::try_from(hostname.to_owned())
        .map_err(|_| "Certificate helper hostname is invalid.".to_string())?;
    let roots = RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let verifier = WebPkiServerVerifier::builder(Arc::new(roots))
        .build()
        .map_err(|error| format!("Public certificate verifier could not start: {error}"))?;
    verifier
        .verify_server_cert(leaf, intermediates, &server_name, &[], UnixTime::now())
        .map_err(|error| {
            format!(
                "Certificate helper returned a chain that is not publicly trusted for the assigned hostname: {error}"
            )
        })?;
    Ok(())
}

fn certificate_fingerprint(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(Cursor::new(bytes));
    let certificate = rustls_pemfile::certs(&mut reader)
        .next()
        .ok_or_else(|| "Certificate file is empty.".to_string())?
        .map_err(|error| error.to_string())?;
    let digest = Sha256::digest(certificate.as_ref());
    Ok(digest
        .chunks(2)
        .map(hex::encode_upper)
        .collect::<Vec<_>>()
        .join(":"))
}

fn load_managed_metadata(config: &LanTlsConfig) -> Option<ManagedMetadata> {
    let metadata: ManagedMetadata =
        serde_json::from_slice(&fs::read(managed_metadata_path(config)).ok()?).ok()?;
    (metadata.hostname == config.managed_hostname.as_deref()?).then_some(metadata)
}

fn managed_cert_path(config: &LanTlsConfig) -> PathBuf {
    config.storage_dir.join("managed-chain.pem")
}

fn managed_key_path(config: &LanTlsConfig) -> PathBuf {
    config.storage_dir.join("managed-key.pem")
}

fn managed_metadata_path(config: &LanTlsConfig) -> PathBuf {
    config.storage_dir.join("managed-certificate.json")
}

fn atomic_write(path: &Path, contents: &[u8], private: bool) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    if private {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn timestamp(value: i64) -> Option<String> {
    DateTime::from_timestamp(value, 0).map(|date| date.to_rfc3339())
}

fn nonempty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn valid_dns_hostname(value: &str) -> bool {
    value.len() <= 253
        && value.contains('.')
        && value.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn certificate_selection_prefers_valid_managed_material_and_falls_back_safely() {
        let now = 1_000_000;
        assert_eq!(
            select_certificate(Some(now + RENEW_BEFORE_SECONDS + 1), true, now),
            CertificateSelection::ManagedCurrent
        );
        assert_eq!(
            select_certificate(Some(now + RENEW_BEFORE_SECONDS), true, now),
            CertificateSelection::ManagedRenewalDue
        );
        assert_eq!(
            select_certificate(Some(now - 1), true, now),
            CertificateSelection::SelfSignedManagedPending
        );
        assert_eq!(
            select_certificate(None, false, now),
            CertificateSelection::SelfSigned
        );
    }

    #[test]
    fn renewal_state_transitions_preserve_valid_certificates_and_expose_fallback() {
        assert_eq!(
            renewal_started(CertificateState::TrustedRenewalDue),
            CertificateState::TrustedRenewing
        );
        assert_eq!(
            renewal_started(CertificateState::SelfSignedManagedPending),
            CertificateState::SelfSignedManagedPending
        );
        assert_eq!(
            renewal_transition(CertificateState::TrustedRenewing, true, false),
            CertificateState::Trusted
        );
        assert_eq!(
            renewal_transition(CertificateState::TrustedRenewing, false, true),
            CertificateState::TrustedRenewalDelayed
        );
        assert_eq!(
            renewal_transition(CertificateState::TrustedRenewing, false, false),
            CertificateState::SelfSignedManagedPending
        );
        assert_eq!(
            renewal_transition(CertificateState::Trusted, false, false),
            CertificateState::SelfSignedManagedPending
        );
        assert_eq!(
            renewal_transition(CertificateState::SelfSigned, false, false),
            CertificateState::SelfSigned
        );
    }

    #[test]
    fn managed_configuration_requires_a_hostname_https_helper_and_token() {
        let mut config = LanTlsConfig {
            storage_dir: PathBuf::from("unused"),
            advertised_ip: "192.168.1.10".parse().unwrap(),
            managed_hostname: Some("hub-123.lan.omnix.example".to_string()),
            helper_order_url: Some("https://certificates.omnix.example/order".to_string()),
            helper_token: Some("secret".to_string()),
        };
        assert!(config.managed_configured());
        config.helper_order_url = Some("http://certificates.omnix.example/order".to_string());
        assert!(!config.managed_configured());
    }
}
