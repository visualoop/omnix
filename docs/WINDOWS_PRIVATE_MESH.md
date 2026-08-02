# Omnix Private Mesh on Windows

## Customer install experience

The normal Omnix NSIS installer remains a **current-user** install. It does not install a VPN driver, create a Windows service, or request administrator access in the background. Omnix works normally on one computer and on the local network without Private Mesh.

In **Settings → Network**, Windows customers see **Install Private Mesh**. Selecting it first explains that a system driver and background service will be installed, then opens one Windows UAC prompt. Cancelling UAC leaves Omnix and the database unchanged. Approval runs the narrow, signed `omnix-mesh-service.exe /install` helper. It accepts no customer-controlled path, service name, tunnel name, or executable argument.

The elevated helper rechecks the SHA-256 values compiled into its signed executable and requires valid Authenticode signatures on itself, `tunnel.dll`, and `wireguard.dll`. It then copies them to `%ProgramFiles%\Omnix\Private Mesh`, creates `WireGuardTunnel$omnix-mesh` with `Nsi` and `TcpIp` dependencies and an unrestricted service SID, and generates one device key. The private key is wrapped with machine-scope DPAPI and restricted to SYSTEM, administrators, and the service SID. SQLite stores only the public key and an opaque `dpapi-machine://…` custody reference.

The customer selects **Enrol device** in Omnix. The short-lived request is bound to the current node, allocation, public key, signing identity, nonce, and expiry, then waits for explicit HQ approval. No WireGuard account, WireGuard GUI, configuration file editing, or key copying is required. Applying approved configuration, rotating or promoting a key, and revoking Private Mesh each show an explicit confirmation in Omnix and then a Windows UAC prompt because they modify protected machine-wide service state. Once approved control metadata is applied, Windows starts the service and the Network page reports starting, running, degraded, rotation pending, stopped, or revoked state.

Private Mesh adds routes only inside the selected private Omnix `/16`. The renderer and sync transport reject `0.0.0.0/0`, `::/0`, routes outside the selected pool, and mesh HTTP endpoints outside that pool. General internet, payment, update, and unrelated LAN traffic remain on the customer's normal connection.

**Rotate key** creates a second DPAPI-wrapped device key. Existing and next key IDs overlap only for the policy grace period; **Activate approved key** promotes the approved key and removes the old custody blob. **Revoke** is terminal: it records revocation, invalidates enrollment metadata, advances the branch epoch when compromise is selected, stops the tunnel, and deletes local key custody/configuration.

## Release staging (no committed DLLs)

`src-tauri/tauri.windows.conf.json` declares the generated Windows resources. The ignored `src-tauri/wireguard/staged/windows-x86_64/` directory is populated only by:

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
