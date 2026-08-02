# Omnix Private Mesh on Windows

## Customer install experience

The normal Omnix NSIS installer remains a **current-user** install. It does not install a VPN driver, create a Windows service, or request administrator access in the background. Omnix works normally on one computer and on the local network without Private Mesh.

In **Settings → Network**, Windows customers see **Install Private Mesh**. Selecting it first explains that a system driver and background service will be installed, then opens one Windows UAC prompt. Cancelling UAC leaves Omnix and the database unchanged. Approval runs the narrow, signed `omnix-mesh-service.exe /install` helper. It accepts no customer-controlled path, service name, tunnel name, or executable argument.

The elevated helper rechecks the SHA-256 values compiled into its signed executable and requires valid Authenticode signatures on itself, `tunnel.dll`, and `wireguard.dll`. It then copies them to `%ProgramFiles%\Omnix\Private Mesh`, creates `WireGuardTunnel$omnix-mesh` with `Nsi` and `TcpIp` dependencies and an unrestricted service SID, and generates one device key. The private key is wrapped with machine-scope DPAPI and restricted to SYSTEM, administrators, and the service SID. SQLite stores only the public key and an opaque `dpapi-machine://…` custody reference.

The customer selects **Enrol device** in Omnix. The short-lived request is bound to the current node, allocation, public key, signing identity, nonce, and expiry, then waits for explicit HQ approval. No WireGuard account, WireGuard GUI, configuration file editing, or key copying is required. Applying approved configuration, rotating or promoting a key, and revoking Private Mesh each show an explicit confirmation in Omnix and then a Windows UAC prompt because they modify protected machine-wide service state. Once approved control metadata is applied, Windows starts the service and the Network page reports starting, running, degraded, rotation pending, stopped, or revoked state.

Private Mesh adds routes only inside the selected private Omnix `/16`. The renderer and sync transport reject `0.0.0.0/0`, `::/0`, routes outside the selected pool, and mesh HTTP endpoints outside that pool. General internet, payment, update, and unrelated LAN traffic remain on the customer's normal connection.

## Publishing the HQ endpoint

Installing WireGuard does not make the HQ computer reachable from the internet by itself. On the HQ computer, the operator opens **Settings → Network → Omnix Private Mesh**, enters either a public IPv4 address or a fully qualified DDNS hostname plus the WireGuard UDP listen port, and selects **Publish endpoint**. Omnix rejects private, loopback, link-local, carrier-grade NAT and malformed IPv4 literals, malformed hostnames, and port zero. A DDNS hostname is preserved in enrolled-device configurations so WireGuard can resolve future address changes.

Publishing requests UAC because it writes the listener configuration and restarts the protected tunnel service. Omnix stores the host, port and publication time on the HQ `sync_nodes` record, registers only the hub public key and its opaque DPAPI custody reference, and writes `ListenPort` into the service configuration. The private key remains in the machine-scope DPAPI file and never enters SQLite or the staged public configuration.

The operator must then configure the internet router:

1. Reserve a stable LAN address for the HQ computer.
2. Forward the selected **UDP** port on the router to the same UDP port on that LAN address.
3. Allow that inbound UDP port through Windows Firewall. No TCP forward is required.
4. If the ISP changes the public address, configure DDNS and publish that hostname instead of a transient address.

The Network panel separates configuration from evidence. It shows the published endpoint, an independently observed public IPv4 address when one exists, UDP reachability (`Reachable`, `Not reachable`, or `Unknown`), and the NAT classification. Saving an endpoint never marks it reachable. Omnix does not call a public-IP lookup or generic “check my port” API, because those services cannot prove a WireGuard UDP handshake and would make offline startup depend on a third party.

A reachability observation is valid only when a trusted host outside the business network attempts a WireGuard handshake against the exact published host and UDP port, records the mapped public IPv4/NAT evidence, and returns that signed control metadata with an expiry through the existing mesh sync control plane. No such observer is bundled in this release. Without a current verified observation, or while offline, the panel reports **Not observed**, **Unknown**, and **Unknown** rather than inferring success. If verified evidence classifies the line as carrier-grade NAT, the panel states that router port forwarding cannot work and that the ISP must provide a public address or a relay is required; this release does not claim to provide a relay.

Approved devices receive an installable configuration containing their assigned `/32` interface address, the current HQ public key, the published endpoint, and only the private Omnix `/16` in `AllowedIPs`. Devices behind NAT, including devices whose NAT class is not yet known, receive `PersistentKeepalive = 25`. The HQ listener receives only each active peer's assigned private `/32`; neither side receives a default IPv4 or IPv6 route.

**Rotate key** creates a second DPAPI-wrapped device key. Existing and next key IDs overlap only for the policy grace period; **Activate approved key** promotes the approved key and removes the old custody blob. **Revoke** is terminal: it records revocation, invalidates enrollment metadata, advances the branch epoch when compromise is selected, stops the tunnel, and deletes local key custody/configuration.

## Release staging (no committed DLLs)

`src-tauri/tauri.mesh.conf.json` (deliberately not named `tauri.windows.conf.json`, which Tauri would auto-merge into every Windows build) declares the generated Windows resources. The ignored `src-tauri/wireguard/staged/windows-x86_64/` directory is populated only by:

```powershell
./scripts/prepare-wireguard-windows.ps1 -Release
```

The script directly downloads the source archive and WireGuardNT SDK pinned in `src-tauri/wireguard/windows-embeddable-dll-service.toml`, verifies both archive hashes and the official amd64 `wireguard.dll` hash, then runs the exact pinned upstream `build.bat`, which may bootstrap its own build dependencies from the URLs defined by that revision. It Authenticode-signs the resulting `tunnel.dll` and Omnix helper, verifies every PE signature, embeds the exact signed DLL hashes into the helper build, and emits `artifact-manifest.json`. Pin changes therefore require reviewing the upstream build script as well as updating hashes. The Tauri bundle also ships `THIRD_PARTY_NOTICES.md` and the WireGuard for Windows MIT notice.

Release staging fails if either code-signing secret is absent, a pin differs, a PE signature is invalid, an output is missing, or a post-stage hash differs. Pull-request artifacts use a runner-local development certificate and are not customer releases.

## Windows verification still required

Linux validation covers rendering, route containment, key/lifecycle policy, schema invariants, Rust tests, TypeScript, frontend tests, and builds. Before release, test on supported Windows hardware and VMs:

1. Authenticode trust and UAC cancellation/success with the production certificate.
2. Fresh install, upgrade, rollback, uninstall, reboot auto-start, and service recovery.
3. WireGuardNT driver installation and adapter creation on x64 Windows 10/11.
4. Service-SID ACLs, DPAPI LocalMachine unwrap under LocalSystem, and inability of a standard user to read custody/config files.
5. Real HQ approval, overlap rotation, offline revocation delivery, and compromised-epoch fencing.
6. Tunnel handshakes, state reporting, private `/16` route creation/removal, and proof that default/internet routes never change.
7. Replication delivery and recovery through `SyncTransport` using a `private_mesh` peer route.

A Linux build cannot honestly certify those Windows SCM, DPAPI, driver, Authenticode trust, route-table, or live handshake behaviors.
