//! Windows Private Mesh integration policy and platform custody.
//!
//! Pure validation/rendering stays available on every target for tests. Windows
//! side effects are isolated under `cfg(windows)` and are called only by the
//! fixed-purpose elevated mesh service helper.

use std::fmt;
use std::net::Ipv4Addr;
use std::str::FromStr;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroizing;

use crate::mesh_contracts::{nat_requires_persistent_keepalive, Endpoint, NatClass};

pub const MESH_SERVICE_NAME: &str = "WireGuardTunnel$omnix-mesh";
pub const MESH_TUNNEL_NAME: &str = "omnix-mesh";
pub const DEFAULT_ROTATION_DAYS: i64 = 90;
pub const DEFAULT_ROTATION_GRACE_HOURS: i64 = 72;

#[derive(Debug, thiserror::Error, Clone, Eq, PartialEq)]
pub enum MeshWindowsError {
    #[error("Private Mesh requires a private IPv4 /16 pool")]
    InvalidPool,
    #[error("the interface address must be inside the selected Private Mesh pool")]
    InvalidInterfaceAddress,
    #[error(
        "Private Mesh routes must stay inside the selected pool; default routes are forbidden"
    )]
    InvalidRoute,
    #[error("the peer endpoint is invalid")]
    InvalidEndpoint,
    #[error("a WireGuard key must be 32 bytes encoded as padded base64")]
    InvalidKey,
    #[error("the tunnel configuration must contain at least one peer")]
    MissingPeer,
    #[error("the requested tunnel transition is not allowed")]
    InvalidTransition,
    #[error("Windows key custody failed")]
    KeyCustody,
    #[error("Windows Private Mesh is unavailable on this platform")]
    UnsupportedPlatform,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum KeySlot {
    Current,
    Next,
}

impl KeySlot {
    pub fn custody_file_name(self) -> &'static str {
        match self {
            Self::Current => "wireguard-current.dpapi",
            Self::Next => "wireguard-next.dpapi",
        }
    }

    pub fn custody_reference(self) -> String {
        format!("dpapi-machine://{}", self.custody_file_name())
    }

    pub fn validate_custody_reference(self, value: &str) -> Result<(), MeshWindowsError> {
        (value == self.custody_reference())
            .then_some(())
            .ok_or(MeshWindowsError::KeyCustody)
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TunnelState {
    NotInstalled,
    Installed,
    AwaitingEnrollment,
    Starting,
    Running,
    Degraded,
    RotationPending,
    Revoked,
    Stopped,
}

impl TunnelState {
    pub fn transition(self, next: Self) -> Result<Self, MeshWindowsError> {
        use TunnelState::*;
        let allowed = matches!(
            (self, next),
            (NotInstalled, Installed)
                | (Installed, AwaitingEnrollment)
                | (Installed, Starting)
                | (AwaitingEnrollment, Starting)
                | (Starting, Running)
                | (Starting, Degraded)
                | (Starting, Stopped)
                | (Running, Degraded)
                | (Running, RotationPending)
                | (RotationPending, Running)
                | (RotationPending, Degraded)
                | (RotationPending, Stopped)
                | (Degraded, Starting)
                | (Degraded, Stopped)
                | (Running, Stopped)
                | (Stopped, Starting)
                | (Installed, Revoked)
                | (AwaitingEnrollment, Revoked)
                | (Starting, Revoked)
                | (Running, Revoked)
                | (Degraded, Revoked)
                | (RotationPending, Revoked)
                | (Stopped, Revoked)
        );
        allowed
            .then_some(next)
            .ok_or(MeshWindowsError::InvalidTransition)
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Eq, PartialEq)]
pub struct Ipv4Network {
    pub address: Ipv4Addr,
    pub prefix_length: u8,
}

impl Ipv4Network {
    pub fn parse(value: &str) -> Result<Self, MeshWindowsError> {
        let (address, prefix) = value
            .split_once('/')
            .ok_or(MeshWindowsError::InvalidRoute)?;
        let address = Ipv4Addr::from_str(address).map_err(|_| MeshWindowsError::InvalidRoute)?;
        let prefix_length = prefix
            .parse::<u8>()
            .map_err(|_| MeshWindowsError::InvalidRoute)?;
        if prefix_length > 32 {
            return Err(MeshWindowsError::InvalidRoute);
        }
        Ok(Self {
            address,
            prefix_length,
        })
    }

    fn mask(self) -> u32 {
        if self.prefix_length == 0 {
            0
        } else {
            u32::MAX << (32 - self.prefix_length)
        }
    }

    fn network(self) -> u32 {
        u32::from(self.address) & self.mask()
    }

    pub fn contains_address(self, address: Ipv4Addr) -> bool {
        u32::from(address) & self.mask() == self.network()
    }

    pub fn contains_network(self, other: Self) -> bool {
        other.prefix_length >= self.prefix_length && self.contains_address(other.address)
    }
}

impl fmt::Display for Ipv4Network {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}/{}", self.address, self.prefix_length)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MeshPeer {
    pub public_key: String,
    pub allowed_ips: Vec<String>,
    pub endpoint: Option<String>,
    pub persistent_keepalive_seconds: Option<u16>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesiredTunnelConfig {
    pub schema_version: u16,
    pub mesh_pool: String,
    pub interface_address: String,
    pub listen_port: Option<u16>,
    pub key_slot: KeySlot,
    pub peers: Vec<MeshPeer>,
}

impl DesiredTunnelConfig {
    pub fn validate(&self) -> Result<(), MeshWindowsError> {
        if self.schema_version != 1 {
            return Err(MeshWindowsError::InvalidRoute);
        }
        let pool = Ipv4Network::parse(&self.mesh_pool)?;
        if pool.prefix_length != 16
            || !pool.address.is_private()
            || pool.network() != u32::from(pool.address)
        {
            return Err(MeshWindowsError::InvalidPool);
        }
        let interface = Ipv4Network::parse(&self.interface_address)?;
        if interface.prefix_length != 32 || !pool.contains_address(interface.address) {
            return Err(MeshWindowsError::InvalidInterfaceAddress);
        }
        if self.listen_port == Some(0) {
            return Err(MeshWindowsError::InvalidEndpoint);
        }
        for peer in &self.peers {
            validate_key(&peer.public_key)?;
            if peer.allowed_ips.is_empty() {
                return Err(MeshWindowsError::InvalidRoute);
            }
            for route in &peer.allowed_ips {
                if route == "0.0.0.0/0" || route == "::/0" {
                    return Err(MeshWindowsError::InvalidRoute);
                }
                let route = Ipv4Network::parse(route)?;
                if route.prefix_length == 0 || !pool.contains_network(route) {
                    return Err(MeshWindowsError::InvalidRoute);
                }
            }
            if let Some(endpoint) = &peer.endpoint {
                validate_endpoint(endpoint)?;
            }
            if peer.persistent_keepalive_seconds == Some(0) {
                return Err(MeshWindowsError::InvalidEndpoint);
            }
        }
        Ok(())
    }

    /// Render the installable service configuration. The caller owns the
    /// private key bytes and must zero/drop the returned text immediately after
    /// `tunnel.dll` has loaded it. This function never logs or implements Debug
    /// for the private key wrapper.
    pub fn render(
        &self,
        private_key: &PrivateKeyMaterial,
    ) -> Result<Zeroizing<String>, MeshWindowsError> {
        self.validate()?;
        let encoded_private_key = Zeroizing::new(private_key.base64());
        let mut lines = vec![
            "[Interface]".to_owned(),
            format!("PrivateKey = {}", encoded_private_key.as_str()),
            format!("Address = {}", self.interface_address),
        ];
        if let Some(port) = self.listen_port {
            lines.push(format!("ListenPort = {port}"));
        }
        for peer in &self.peers {
            lines.push(String::new());
            lines.push("[Peer]".to_owned());
            lines.push(format!("PublicKey = {}", peer.public_key));
            lines.push(format!("AllowedIPs = {}", peer.allowed_ips.join(", ")));
            if let Some(endpoint) = &peer.endpoint {
                lines.push(format!("Endpoint = {endpoint}"));
            }
            if let Some(seconds) = peer.persistent_keepalive_seconds {
                lines.push(format!("PersistentKeepalive = {seconds}"));
            }
        }
        Ok(Zeroizing::new(lines.join("\r\n") + "\r\n"))
    }
}

/// Builds the installable configuration delivered to an approved device. The
/// interface address comes from its allocation; the sole peer is the current
/// HQ key at the operator-published endpoint. The only route is the selected
/// Omnix private /16.
pub fn enrolled_device_tunnel_config(
    mesh_pool: &str,
    assigned_mesh_address: &str,
    hub_public_key: &str,
    hub_endpoint: &Endpoint,
    device_nat_class: NatClass,
) -> Result<DesiredTunnelConfig, MeshWindowsError> {
    let configuration = DesiredTunnelConfig {
        schema_version: 1,
        mesh_pool: mesh_pool.to_owned(),
        interface_address: assigned_mesh_address.to_owned(),
        listen_port: None,
        key_slot: KeySlot::Current,
        peers: vec![MeshPeer {
            public_key: hub_public_key.to_owned(),
            allowed_ips: vec![mesh_pool.to_owned()],
            endpoint: Some(hub_endpoint.render()),
            persistent_keepalive_seconds: nat_requires_persistent_keepalive(device_nat_class)
                .then_some(25),
        }],
    };
    configuration.validate()?;
    Ok(configuration)
}

/// Builds the hub listener configuration from public peer metadata. A newly
/// installed hub may listen before its first peer is approved. Every later peer
/// route is its assigned /32 inside the selected Omnix pool.
pub fn hub_tunnel_config(
    mesh_pool: &str,
    assigned_mesh_address: &str,
    listen_port: u16,
    peers: Vec<MeshPeer>,
) -> Result<DesiredTunnelConfig, MeshWindowsError> {
    let configuration = DesiredTunnelConfig {
        schema_version: 1,
        mesh_pool: mesh_pool.to_owned(),
        interface_address: assigned_mesh_address.to_owned(),
        listen_port: Some(listen_port),
        key_slot: KeySlot::Current,
        peers,
    };
    configuration.validate()?;
    Ok(configuration)
}

/// Validate that a typed sync HTTP endpoint is routed only through the selected
/// Omnix pool. DNS is intentionally rejected here because route scope must be
/// provable before transport; endpoint discovery resolves to an allocated /32.
pub fn validate_private_mesh_endpoint_url(
    endpoint_url: &str,
    mesh_pool: &str,
) -> Result<(), MeshWindowsError> {
    let pool = Ipv4Network::parse(mesh_pool)?;
    if pool.prefix_length != 16 || !pool.address.is_private() {
        return Err(MeshWindowsError::InvalidPool);
    }
    let authority = endpoint_url
        .strip_prefix("http://")
        .ok_or(MeshWindowsError::InvalidEndpoint)?
        .split('/')
        .next()
        .ok_or(MeshWindowsError::InvalidEndpoint)?;
    let (host, port) = authority
        .rsplit_once(':')
        .ok_or(MeshWindowsError::InvalidEndpoint)?;
    let host = host
        .parse::<Ipv4Addr>()
        .map_err(|_| MeshWindowsError::InvalidEndpoint)?;
    if port.parse::<u16>().ok().filter(|port| *port != 0).is_none() || !pool.contains_address(host)
    {
        return Err(MeshWindowsError::InvalidRoute);
    }
    Ok(())
}

fn validate_endpoint(value: &str) -> Result<(), MeshWindowsError> {
    let (host, port) = value
        .rsplit_once(':')
        .ok_or(MeshWindowsError::InvalidEndpoint)?;
    if host.is_empty() || port.parse::<u16>().ok().filter(|port| *port != 0).is_none() {
        return Err(MeshWindowsError::InvalidEndpoint);
    }
    let valid_host = host.parse::<Ipv4Addr>().is_ok()
        || (host.len() <= 253
            && host.split('.').all(|label| {
                !label.is_empty()
                    && label.len() <= 63
                    && !label.starts_with('-')
                    && !label.ends_with('-')
                    && label
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            }));
    valid_host
        .then_some(())
        .ok_or(MeshWindowsError::InvalidEndpoint)
}

pub fn validate_key(value: &str) -> Result<(), MeshWindowsError> {
    let decoded = BASE64
        .decode(value)
        .map_err(|_| MeshWindowsError::InvalidKey)?;
    (decoded.len() == 32)
        .then_some(())
        .ok_or(MeshWindowsError::InvalidKey)
}

/// Secret key bytes intentionally have no Debug/Display/Serialize implementation.
pub struct PrivateKeyMaterial([u8; 32]);

impl PrivateKeyMaterial {
    pub fn generate() -> (Self, String) {
        let secret = StaticSecret::random_from_rng(rand::rngs::OsRng);
        let public = PublicKey::from(&secret);
        (Self(secret.to_bytes()), BASE64.encode(public.as_bytes()))
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn expose(&self) -> &[u8; 32] {
        &self.0
    }

    fn base64(&self) -> String {
        BASE64.encode(self.0)
    }
}

impl Drop for PrivateKeyMaterial {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

#[cfg(windows)]
pub mod dpapi {
    use std::ffi::c_void;
    use std::ptr;

    use super::{MeshWindowsError, PrivateKeyMaterial};

    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;
    const CRYPTPROTECT_LOCAL_MACHINE: u32 = 0x4;
    const ENTROPY: &[u8] = b"Omnix Private Mesh WireGuard key v1";

    #[repr(C)]
    struct DataBlob {
        size: u32,
        data: *mut u8,
    }

    #[link(name = "Crypt32")]
    extern "system" {
        fn CryptProtectData(
            input: *const DataBlob,
            description: *const u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const DataBlob,
            description: *mut *mut u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "Kernel32")]
    extern "system" {
        fn LocalFree(memory: *mut c_void) -> *mut c_void;
    }

    pub fn protect(key: &PrivateKeyMaterial) -> Result<Vec<u8>, MeshWindowsError> {
        crypt(key.expose(), true)
    }

    pub fn unprotect(ciphertext: &[u8]) -> Result<PrivateKeyMaterial, MeshWindowsError> {
        let plaintext = zeroize::Zeroizing::new(crypt(ciphertext, false)?);
        if plaintext.len() != 32 {
            return Err(MeshWindowsError::KeyCustody);
        }
        let mut bytes = [0_u8; 32];
        bytes.copy_from_slice(&plaintext);
        Ok(PrivateKeyMaterial::from_bytes(bytes))
    }

    fn crypt(input: &[u8], protect: bool) -> Result<Vec<u8>, MeshWindowsError> {
        let input_size = u32::try_from(input.len()).map_err(|_| MeshWindowsError::KeyCustody)?;
        let entropy_size =
            u32::try_from(ENTROPY.len()).map_err(|_| MeshWindowsError::KeyCustody)?;
        let input_blob = DataBlob {
            size: input_size,
            data: input.as_ptr().cast_mut(),
        };
        let entropy_blob = DataBlob {
            size: entropy_size,
            data: ENTROPY.as_ptr().cast_mut(),
        };
        let mut output = DataBlob {
            size: 0,
            data: ptr::null_mut(),
        };
        let flags = CRYPTPROTECT_UI_FORBIDDEN | CRYPTPROTECT_LOCAL_MACHINE;
        let success = unsafe {
            if protect {
                CryptProtectData(
                    &input_blob,
                    ptr::null(),
                    &entropy_blob,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    flags,
                    &mut output,
                )
            } else {
                CryptUnprotectData(
                    &input_blob,
                    ptr::null_mut(),
                    &entropy_blob,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    flags,
                    &mut output,
                )
            }
        };
        if success == 0 || output.data.is_null() {
            return Err(MeshWindowsError::KeyCustody);
        }
        let bytes =
            unsafe { std::slice::from_raw_parts(output.data, output.size as usize).to_vec() };
        unsafe { LocalFree(output.data.cast()) };
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(character: u8) -> String {
        BASE64.encode([character; 32])
    }

    fn valid_config() -> DesiredTunnelConfig {
        DesiredTunnelConfig {
            schema_version: 1,
            mesh_pool: "10.73.0.0/16".to_owned(),
            interface_address: "10.73.4.2/32".to_owned(),
            listen_port: Some(51820),
            key_slot: KeySlot::Current,
            peers: vec![MeshPeer {
                public_key: key(7),
                allowed_ips: vec!["10.73.0.0/24".to_owned(), "10.73.4.1/32".to_owned()],
                endpoint: Some("hq.mesh.example:51820".to_owned()),
                persistent_keepalive_seconds: Some(25),
            }],
        }
    }

    #[test]
    fn private_mesh_transport_endpoint_must_be_an_allocated_pool_address() {
        validate_private_mesh_endpoint_url("http://10.73.4.1:8765", "10.73.0.0/16").unwrap();
        assert_eq!(
            validate_private_mesh_endpoint_url("http://10.74.4.1:8765", "10.73.0.0/16"),
            Err(MeshWindowsError::InvalidRoute)
        );
        assert_eq!(
            validate_private_mesh_endpoint_url("https://10.73.4.1:8765", "10.73.0.0/16"),
            Err(MeshWindowsError::InvalidEndpoint)
        );
    }

    #[test]
    fn renders_only_selected_private_mesh_routes() {
        let config = valid_config();
        let private = PrivateKeyMaterial::from_bytes([9; 32]);
        let rendered = config.render(&private).unwrap();
        assert!(rendered.contains("Address = 10.73.4.2/32"));
        assert!(rendered.contains("AllowedIPs = 10.73.0.0/24, 10.73.4.1/32"));
        assert!(!rendered.contains("0.0.0.0/0"));
        assert!(!rendered.contains("::/0"));
    }

    #[test]
    fn rejects_default_and_out_of_pool_routes() {
        for invalid in ["0.0.0.0/0", "::/0", "10.74.0.2/32", "192.168.1.0/24"] {
            let mut config = valid_config();
            config.peers[0].allowed_ips = vec![invalid.to_owned()];
            assert_eq!(config.validate(), Err(MeshWindowsError::InvalidRoute));
        }
    }

    #[test]
    fn enrolled_device_config_contains_hub_endpoint_key_address_and_keepalive() {
        let endpoint = Endpoint::parse_public("hq-west.ddns.example.co.ke", 51_820).unwrap();
        let config = enrolled_device_tunnel_config(
            "10.73.0.0/16",
            "10.73.42.2/32",
            &key(11),
            &endpoint,
            NatClass::PortRestricted,
        )
        .unwrap();
        assert_eq!(config.interface_address, "10.73.42.2/32");
        assert_eq!(config.peers[0].public_key, key(11));
        assert_eq!(config.peers[0].allowed_ips, vec!["10.73.0.0/16"]);
        assert_eq!(
            config.peers[0].endpoint.as_deref(),
            Some("hq-west.ddns.example.co.ke:51820")
        );
        assert_eq!(config.peers[0].persistent_keepalive_seconds, Some(25));

        let rendered = config
            .render(&PrivateKeyMaterial::from_bytes([12; 32]))
            .unwrap();
        assert!(rendered.contains(&format!("PublicKey = {}", key(11))));
        assert!(rendered.contains("Address = 10.73.42.2/32"));
        assert!(rendered.contains("Endpoint = hq-west.ddns.example.co.ke:51820"));
        assert!(rendered.contains("PersistentKeepalive = 25"));
        assert!(rendered.contains("AllowedIPs = 10.73.0.0/16"));
        assert!(!rendered.contains("0.0.0.0/0"));
        assert!(!rendered.contains("::/0"));
    }

    #[test]
    fn published_hub_config_listens_on_udp_port_with_private_peer_routes_only() {
        let config = hub_tunnel_config(
            "10.73.0.0/16",
            "10.73.0.1/32",
            51_820,
            vec![MeshPeer {
                public_key: key(13),
                allowed_ips: vec!["10.73.42.2/32".to_owned()],
                endpoint: None,
                persistent_keepalive_seconds: None,
            }],
        )
        .unwrap();
        let rendered = config
            .render(&PrivateKeyMaterial::from_bytes([14; 32]))
            .unwrap();
        assert!(rendered.contains("ListenPort = 51820"));
        assert!(rendered.contains("AllowedIPs = 10.73.42.2/32"));
        assert!(!rendered.contains("0.0.0.0/0"));
        assert!(!rendered.contains("::/0"));
    }

    #[test]
    fn rejects_interface_outside_pool_and_non_private_pool() {
        let mut config = valid_config();
        config.interface_address = "10.74.4.2/32".to_owned();
        assert_eq!(
            config.validate(),
            Err(MeshWindowsError::InvalidInterfaceAddress)
        );
        config.interface_address = "203.0.4.2/32".to_owned();
        config.mesh_pool = "203.0.0.0/16".to_owned();
        assert_eq!(config.validate(), Err(MeshWindowsError::InvalidPool));
    }

    #[test]
    fn lifecycle_requires_explicit_rotation_and_revocation_transitions() {
        assert_eq!(
            TunnelState::NotInstalled.transition(TunnelState::Installed),
            Ok(TunnelState::Installed)
        );
        assert_eq!(
            TunnelState::Running.transition(TunnelState::RotationPending),
            Ok(TunnelState::RotationPending)
        );
        assert_eq!(
            TunnelState::RotationPending.transition(TunnelState::Running),
            Ok(TunnelState::Running)
        );
        assert_eq!(
            TunnelState::Running.transition(TunnelState::Revoked),
            Ok(TunnelState::Revoked)
        );
        assert_eq!(
            TunnelState::Revoked.transition(TunnelState::Running),
            Err(MeshWindowsError::InvalidTransition)
        );
    }

    #[test]
    fn custody_policy_allows_only_fixed_machine_dpapi_slots() {
        let current = KeySlot::Current.custody_reference();
        let next = KeySlot::Next.custody_reference();
        assert_eq!(current, "dpapi-machine://wireguard-current.dpapi");
        assert_eq!(next, "dpapi-machine://wireguard-next.dpapi");
        KeySlot::Current
            .validate_custody_reference(&current)
            .unwrap();
        KeySlot::Next.validate_custody_reference(&next).unwrap();
        for invalid in [
            next.as_str(),
            "file://wireguard-current.key",
            "sqlite://mesh_peer_keys/private_key",
            "dpapi-user://wireguard-current.dpapi",
        ] {
            assert_eq!(
                KeySlot::Current.validate_custody_reference(invalid),
                Err(MeshWindowsError::KeyCustody)
            );
        }
    }

    #[test]
    fn generated_keys_are_wireguard_sized_and_private_key_has_no_debug_surface() {
        let (_private, public) = PrivateKeyMaterial::generate();
        validate_key(&public).unwrap();
        assert_eq!(BASE64.decode(public).unwrap().len(), 32);
    }
}
