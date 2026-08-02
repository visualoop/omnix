//! Pure private-mesh policy and rendering contracts.
//!
//! This module does not create interfaces, run WireGuard, discover endpoints,
//! persist keys, or contact enrollment services. Those side effects belong in
//! an explicitly privileged integration layer.

use std::fmt;
use std::net::Ipv4Addr;

pub use crate::sync_contracts::{NodeId, UnixMillis};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MeshError {
    InvalidPool,
    InvalidSite,
    InvalidHost,
    InvalidPort,
    InvalidDnsName,
    NonPublicEndpoint,
    InvalidKey,
    InvalidAllowedIp,
    InvalidPolicy,
    EnrollmentExpired,
    EnrollmentNotApproved,
    CapacityReached,
    NodeRevoked,
    RotationRequired,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SiteRole {
    Hq,
    Branch,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MeshIpv4Plan {
    base: Ipv4Addr,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MeshIpv4Allocation {
    pub address: Ipv4Addr,
    pub prefix_length: u8,
    pub site: u8,
    pub host: u8,
    pub role: SiteRole,
}

impl MeshIpv4Plan {
    /// Creates a private /16 plan. The final two base octets must be zero.
    pub fn new(base: Ipv4Addr) -> Result<Self, MeshError> {
        let octets = base.octets();
        if octets[2] != 0 || octets[3] != 0 || !is_private(base) {
            return Err(MeshError::InvalidPool);
        }
        Ok(Self { base })
    }

    pub fn base(&self) -> Ipv4Addr {
        self.base
    }

    /// Site 0 is reserved for HQ; branch sites are 1..=254.
    /// Host 1 is the site router; peer hosts are 2..=254.
    pub fn allocate(&self, site: u8, host: u8) -> Result<MeshIpv4Allocation, MeshError> {
        if site == u8::MAX {
            return Err(MeshError::InvalidSite);
        }
        if !(1..=254).contains(&host) {
            return Err(MeshError::InvalidHost);
        }
        let base = self.base.octets();
        Ok(MeshIpv4Allocation {
            address: Ipv4Addr::new(base[0], base[1], site, host),
            prefix_length: 32,
            site,
            host,
            role: if site == 0 {
                SiteRole::Hq
            } else {
                SiteRole::Branch
            },
        })
    }
}

pub fn is_private(address: Ipv4Addr) -> bool {
    let [first, second, _, _] = address.octets();
    first == 10 || (first == 172 && (16..=31).contains(&second)) || (first == 192 && second == 168)
}

pub fn is_carrier_grade_nat(address: Ipv4Addr) -> bool {
    let [first, second, _, _] = address.octets();
    first == 100 && (64..=127).contains(&second)
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EndpointHost {
    Ipv4(Ipv4Addr),
    Dns(String),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Endpoint {
    pub host: EndpointHost,
    pub port: u16,
}

impl Endpoint {
    pub fn new(host: EndpointHost, port: u16) -> Result<Self, MeshError> {
        if port == 0 {
            return Err(MeshError::InvalidPort);
        }
        if let EndpointHost::Dns(name) = &host {
            let valid = !name.is_empty()
                && name.len() <= 253
                && !name.starts_with('.')
                && !name.ends_with('.')
                && name.split('.').all(|label| {
                    !label.is_empty()
                        && label.len() <= 63
                        && !label.starts_with('-')
                        && !label.ends_with('-')
                        && label
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                });
            if !valid {
                return Err(MeshError::InvalidDnsName);
            }
        }
        Ok(Self { host, port })
    }

    /// Parses an endpoint that another site can dial over the public internet.
    /// Private, carrier-grade, loopback, link-local and reserved IPv4 ranges
    /// are rejected. DNS names must be fully qualified; resolution is left to
    /// WireGuard so DDNS updates continue to work.
    pub fn parse_public(host: &str, port: u16) -> Result<Self, MeshError> {
        let host = host.trim();
        if host.is_empty() {
            return Err(MeshError::InvalidDnsName);
        }
        if let Ok(address) = host.parse::<Ipv4Addr>() {
            if !is_public_ipv4(address) {
                return Err(MeshError::NonPublicEndpoint);
            }
            return Self::new(EndpointHost::Ipv4(address), port);
        }
        if host
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'.')
            || !host.contains('.')
        {
            return Err(MeshError::InvalidDnsName);
        }
        Self::new(EndpointHost::Dns(host.to_ascii_lowercase()), port)
    }

    pub fn host_text(&self) -> String {
        match &self.host {
            EndpointHost::Ipv4(address) => address.to_string(),
            EndpointHost::Dns(name) => name.clone(),
        }
    }

    pub fn render(&self) -> String {
        format!("{}:{}", self.host_text(), self.port)
    }

    fn is_private_ipv4(&self) -> bool {
        matches!(self.host, EndpointHost::Ipv4(address) if is_private(address))
    }
}

pub fn is_public_ipv4(address: Ipv4Addr) -> bool {
    let [first, second, third, _] = address.octets();
    !is_private(address)
        && !is_carrier_grade_nat(address)
        && !address.is_unspecified()
        && !address.is_loopback()
        && !address.is_link_local()
        && !address.is_multicast()
        && !address.is_broadcast()
        && !address.is_documentation()
        && first != 0
        && first < 224
        && !(first == 192 && second == 0 && third == 0)
        && !(first == 198 && matches!(second, 18 | 19))
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NatObservation {
    pub probe_target: Endpoint,
    pub mapped_endpoint: Endpoint,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NatClass {
    OpenInternet,
    FullCone,
    AddressRestricted,
    PortRestricted,
    Symmetric,
    CarrierGrade,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NatEvidence {
    pub local_address: Ipv4Addr,
    pub observations: Vec<NatObservation>,
    pub unsolicited_inbound_succeeded: bool,
    pub address_restricted_probe_succeeded: bool,
}

pub fn classify_nat(evidence: &NatEvidence) -> NatClass {
    if is_carrier_grade_nat(evidence.local_address) {
        return NatClass::CarrierGrade;
    }
    if evidence.observations.is_empty() {
        return NatClass::Unknown;
    }

    let first_mapping = &evidence.observations[0].mapped_endpoint;
    if !is_private(evidence.local_address)
        && matches!(first_mapping.host, EndpointHost::Ipv4(address) if address == evidence.local_address)
    {
        return NatClass::OpenInternet;
    }
    if evidence
        .observations
        .iter()
        .skip(1)
        .any(|observation| observation.mapped_endpoint != *first_mapping)
    {
        return NatClass::Symmetric;
    }
    if evidence.unsolicited_inbound_succeeded {
        NatClass::FullCone
    } else if evidence.address_restricted_probe_succeeded {
        NatClass::AddressRestricted
    } else {
        NatClass::PortRestricted
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EndpointClass {
    DirectLan,
    DirectPublic,
    NatTraversal,
    RelayRequired,
    Unreachable,
}

pub fn classify_endpoint(
    endpoint: Option<&Endpoint>,
    nat: NatClass,
    endpoint_reachable: bool,
    relay_available: bool,
) -> EndpointClass {
    if let Some(endpoint) = endpoint {
        if endpoint_reachable && endpoint.is_private_ipv4() {
            return EndpointClass::DirectLan;
        }
        if endpoint_reachable && nat == NatClass::OpenInternet {
            return EndpointClass::DirectPublic;
        }
        if endpoint_reachable
            && matches!(
                nat,
                NatClass::FullCone | NatClass::AddressRestricted | NatClass::PortRestricted
            )
        {
            return EndpointClass::NatTraversal;
        }
    }
    if relay_available {
        EndpointClass::RelayRequired
    } else {
        EndpointClass::Unreachable
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PortReachability {
    Reachable,
    Unreachable,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ReachabilityObservation {
    pub observed_public_address: Option<Ipv4Addr>,
    pub observed_port: u16,
    pub nat_class: NatClass,
    pub endpoint_class: EndpointClass,
    pub verified: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HubReachability {
    pub observed_public_address: Option<Ipv4Addr>,
    pub port_reachability: PortReachability,
    pub nat_class: NatClass,
    pub warning: Option<&'static str>,
}

/// Assesses only independently verified evidence. A configured endpoint alone
/// never proves that an inbound UDP handshake can reach the hub.
pub fn assess_hub_reachability(
    endpoint: &Endpoint,
    observation: Option<&ReachabilityObservation>,
) -> HubReachability {
    let Some(observation) = observation.filter(|observation| observation.verified) else {
        return HubReachability {
            observed_public_address: None,
            port_reachability: PortReachability::Unknown,
            nat_class: NatClass::Unknown,
            warning: None,
        };
    };
    let port_reachability = if observation.observed_port != endpoint.port {
        PortReachability::Unknown
    } else if matches!(
        observation.endpoint_class,
        EndpointClass::DirectPublic | EndpointClass::NatTraversal
    ) {
        PortReachability::Reachable
    } else if matches!(
        observation.endpoint_class,
        EndpointClass::RelayRequired | EndpointClass::Unreachable
    ) {
        PortReachability::Unreachable
    } else {
        PortReachability::Unknown
    };
    HubReachability {
        observed_public_address: observation.observed_public_address,
        port_reachability,
        nat_class: observation.nat_class,
        warning: nat_warning(observation.nat_class),
    }
}

pub fn nat_warning(nat_class: NatClass) -> Option<&'static str> {
    match nat_class {
        NatClass::CarrierGrade => Some(
            "This line is behind carrier-grade NAT. Router port forwarding cannot make the hub reachable; a relay or a public address from the ISP is required.",
        ),
        _ => None,
    }
}

/// Unknown is treated conservatively because most branch devices sit behind a
/// router; periodic keepalive is harmless on an open path and preserves NAT
/// mappings when external classification has not arrived yet.
pub fn nat_requires_persistent_keepalive(nat_class: NatClass) -> bool {
    nat_class != NatClass::OpenInternet
}

#[derive(Clone, Eq, PartialEq)]
pub struct WireGuardKey(String);

impl WireGuardKey {
    pub fn new(value: impl Into<String>) -> Result<Self, MeshError> {
        let value = value.into();
        let valid = value.len() == 44
            && value.ends_with('=')
            && value[..43]
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/'));
        if !valid {
            return Err(MeshError::InvalidKey);
        }
        Ok(Self(value))
    }

    fn redacted(&self) -> String {
        format!("<redacted:{}…{}>", &self.0[..6], &self.0[39..43])
    }
}

impl fmt::Debug for WireGuardKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("WireGuardKey(<redacted>)")
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyId(String);

impl KeyId {
    pub fn new(value: impl Into<String>) -> Result<Self, MeshError> {
        let value = value.into();
        if value.is_empty()
            || value.len() > 128
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        {
            return Err(MeshError::InvalidKey);
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentPolicy {
    pub request_ttl_ms: u64,
    pub rotation_interval_ms: u64,
    pub rotation_grace_ms: u64,
    pub max_active_peers: usize,
}

impl EnrollmentPolicy {
    pub fn validate(&self) -> Result<(), MeshError> {
        if self.request_ttl_ms == 0
            || self.rotation_interval_ms == 0
            || self.rotation_grace_ms == 0
            || self.max_active_peers == 0
        {
            return Err(MeshError::InvalidPolicy);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EnrollmentRequest {
    pub node_id: NodeId,
    pub key_id: KeyId,
    pub public_key: WireGuardKey,
    pub requested_at: UnixMillis,
    pub expires_at: UnixMillis,
    pub approved_by_hq: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EnrollmentDecision {
    Approve,
    RejectExpired,
    RejectUnapproved,
    RejectCapacity,
}

pub fn evaluate_enrollment(
    policy: &EnrollmentPolicy,
    request: &EnrollmentRequest,
    now: UnixMillis,
    active_peers: usize,
) -> Result<EnrollmentDecision, MeshError> {
    policy.validate()?;
    let maximum_expiry = request
        .requested_at
        .0
        .checked_add(policy.request_ttl_ms)
        .ok_or(MeshError::InvalidPolicy)?;
    if request.expires_at <= request.requested_at
        || request.expires_at.0 > maximum_expiry
        || now > request.expires_at
    {
        return Ok(EnrollmentDecision::RejectExpired);
    }
    if !request.approved_by_hq {
        return Ok(EnrollmentDecision::RejectUnapproved);
    }
    if active_peers >= policy.max_active_peers {
        return Ok(EnrollmentDecision::RejectCapacity);
    }
    Ok(EnrollmentDecision::Approve)
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PeerLifecycle {
    Active {
        key_id: KeyId,
        activated_at: UnixMillis,
        rotate_at: UnixMillis,
    },
    RotationPending {
        current_key_id: KeyId,
        next_key_id: KeyId,
        deadline: UnixMillis,
    },
    Revoked {
        key_id: KeyId,
        revoked_at: UnixMillis,
        reason: RevocationReason,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RotationStatus {
    Current,
    Due,
    Grace,
    Blocked,
    Revoked,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RevocationReason {
    DeviceLost,
    DeviceReplaced,
    Compromised,
    AuthorizationRemoved,
    Administrative,
}

impl PeerLifecycle {
    pub fn rotation_status(
        &self,
        policy: &EnrollmentPolicy,
        now: UnixMillis,
    ) -> Result<RotationStatus, MeshError> {
        policy.validate()?;
        match self {
            Self::Active { rotate_at, .. } if now < *rotate_at => Ok(RotationStatus::Current),
            Self::Active { rotate_at, .. }
                if now.0
                    <= rotate_at
                        .0
                        .checked_add(policy.rotation_grace_ms)
                        .ok_or(MeshError::InvalidPolicy)? =>
            {
                Ok(RotationStatus::Due)
            }
            Self::Active { .. } => Ok(RotationStatus::Blocked),
            Self::RotationPending { deadline, .. } if now <= *deadline => Ok(RotationStatus::Grace),
            Self::RotationPending { .. } => Ok(RotationStatus::Blocked),
            Self::Revoked { .. } => Ok(RotationStatus::Revoked),
        }
    }

    pub fn authorize_handshake(
        &self,
        policy: &EnrollmentPolicy,
        presented_key_id: &KeyId,
        now: UnixMillis,
    ) -> Result<(), MeshError> {
        match self {
            Self::Active { key_id, .. }
                if key_id == presented_key_id
                    && self.rotation_status(policy, now)? != RotationStatus::Blocked =>
            {
                Ok(())
            }
            Self::RotationPending {
                current_key_id,
                next_key_id,
                deadline,
            } if now <= *deadline
                && (presented_key_id == current_key_id || presented_key_id == next_key_id) =>
            {
                Ok(())
            }
            Self::Revoked { .. } => Err(MeshError::NodeRevoked),
            _ => Err(MeshError::RotationRequired),
        }
    }

    pub fn revoke(self, at: UnixMillis, reason: RevocationReason) -> Result<Self, MeshError> {
        let key_id = match self {
            Self::Active { key_id, .. } => key_id,
            Self::RotationPending { current_key_id, .. } => current_key_id,
            Self::Revoked { .. } => return Err(MeshError::NodeRevoked),
        };
        Ok(Self::Revoked {
            key_id,
            revoked_at: at,
            reason,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Ipv4Cidr {
    pub address: Ipv4Addr,
    pub prefix_length: u8,
}

impl Ipv4Cidr {
    pub fn new(address: Ipv4Addr, prefix_length: u8) -> Result<Self, MeshError> {
        if prefix_length > 32 {
            return Err(MeshError::InvalidAllowedIp);
        }
        Ok(Self {
            address,
            prefix_length,
        })
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct WireGuardPeerConfig {
    pub public_key: WireGuardKey,
    pub preshared_key: Option<WireGuardKey>,
    pub allowed_ips: Vec<Ipv4Cidr>,
    pub endpoint: Option<Endpoint>,
    pub persistent_keepalive_seconds: Option<u16>,
}

impl fmt::Debug for WireGuardPeerConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("WireGuardPeerConfig")
            .field("public_key", &"<redacted>")
            .field(
                "preshared_key",
                &self.preshared_key.as_ref().map(|_| "<redacted>"),
            )
            .field("allowed_ips", &self.allowed_ips)
            .field(
                "endpoint",
                &self.endpoint.as_ref().map(|_| "<redacted-host>"),
            )
            .field(
                "persistent_keepalive_seconds",
                &self.persistent_keepalive_seconds,
            )
            .finish()
    }
}

impl WireGuardPeerConfig {
    /// Produces support-safe text, never an installable configuration.
    pub fn render_redacted(&self) -> String {
        let mut lines = vec![
            "[Peer]".to_owned(),
            format!("PublicKey = {}", self.public_key.redacted()),
        ];
        if self.preshared_key.is_some() {
            lines.push("PresharedKey = <redacted>".to_owned());
        }
        if !self.allowed_ips.is_empty() {
            lines.push(format!(
                "AllowedIPs = {}",
                self.allowed_ips
                    .iter()
                    .map(|cidr| format!("{}/{}", cidr.address, cidr.prefix_length))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        if let Some(endpoint) = &self.endpoint {
            lines.push(format!("Endpoint = <redacted-host>:{}", endpoint.port));
        }
        if let Some(seconds) = self.persistent_keepalive_seconds {
            lines.push(format!("PersistentKeepalive = {seconds}"));
        }
        lines
            .push("# PrivateKey is intentionally never represented by a peer contract.".to_owned());
        lines.join("\n")
    }
}
