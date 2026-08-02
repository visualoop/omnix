# Sync and private-mesh contracts: security and integration

Status: sync persistence, activation, and dependency integration are registered. The Windows Private Mesh adapter is implemented behind `cfg(windows)`, staged through a pinned/checksummed/AuthentiCode-gated release job, exposed in Network settings, and routed through `SyncTransport`; real SCM/DPAPI/driver/handshake behavior still requires the Windows verification matrix in `WINDOWS_PRIVATE_MESH.md`. Android remains a separate native-host integration.

## Security boundary

The contracts separate decisions from side effects. They define identifier validation, epoch fencing, queue state machines, receipt/cursor idempotency, recovery boundaries, private IPv4 allocation, NAT classification, peer lifecycle policy, and support-safe WireGuard rendering. They do **not** implement:

- UUID generation or a trusted clock;
- canonical serialization, SHA-256 hashing, signing, or signature verification;
- SQLite transactions, outbox capture, inbox application, or snapshot creation;
- endpoint discovery, STUN/TURN, relay transport, DNS, or network probing;
- WireGuard key generation/storage, interface creation, route changes, or process execution;
- enrollment approval, device attestation, license checks, or revocation distribution.

All input from peers is untrusted. Integration must reject an envelope before parsing its business payload unless the protocol version, size limits, branch/HQ fence, source authorization, payload digest, signature key status, signature, and expiry have all passed. Signature verification must use canonical bytes that include every `EnvelopeMetadata` field and the payload digest. A signature over the payload alone is insufficient because it would leave routing, epoch, sequence, entity, and expiry metadata mutable.

Node and event identifiers are canonical lowercase UUID v4 values. The contract validates IDs but does not generate them. Production generation should use the existing `uuid` crate with its v4 feature and persist a node ID once per installation. Reinstallation or cloning must never silently reuse another node's private key or sequence space.

## Fencing and delivery invariants

HQ and each branch maintain monotonic epochs. A receiver accepts writes only when both incoming epochs exactly match its current token. Lower epochs identify stale writers; higher epochs require control-plane reconciliation and are not accepted speculatively. Epoch increments must be serialized at HQ and distributed in a signed control event.

Each source node owns a monotonically increasing sequence within a branch and fence. Event insertion and the originating business mutation must share one SQLite transaction. Receivers persist the event ID, source/fence/sequence tuple, application result, receipt, and contiguous cursor in one transaction. Replays of the same event return the stored receipt. Reuse of an event ID with different receipt data is a security incident, not a last-write-wins case.

Outbox lease generation is a fencing value for workers. A worker may send or acknowledge only the lease generation it holds. Inbox and outbox terminal states are immutable. Transient transport, timeout, and storage-busy failures may retry; malformed, unauthorized, unverifiable, unsupported, or conflicting events go to a dead-letter workflow.

Conflicts involving closed fiscal periods, immutable compliance records, uniqueness, deleted entities, or schema mismatch require explicit domain resolution. Sync code must not bypass existing accounting, inventory, eTIMS, pharmacy, audit, or authorization business rules.

## Snapshot and recovery

A snapshot records branch/HQ epochs, schema version, byte length, chunk count, SHA-256 digest, and a contiguous cursor per source. Before restore, integration must verify authorization, signature (to be added by the integration envelope), digest, schema compatibility, branch identity, exact fence, free disk space, and an encrypted pre-restore backup.

Restore should occur into a new SQLite file, run integrity and application invariants, then swap atomically while the branch is fenced read-only. Replay starts at each snapshot cursor plus one. Recovery attempts and results belong in the audit log. A failed restore must leave the prior database and keys intact.

## Private mesh policy

The initial address contract uses a private `/16`: site `0` is HQ, sites `1..254` are branches, host `1` is reserved for the site router, and hosts `2..254` are peers. The integration must maintain a unique allocation registry; deterministic address construction alone does not prove that a site/host pair is unused. Do not overlap the selected pool with customer LANs, VPNs, Docker networks, or common cloud routes. Pool selection therefore remains an installation-time control-plane decision.

NAT classification is evidence-based and conservative. Symmetric and carrier-grade NAT should normally use an authenticated relay unless a tested traversal mechanism succeeds. Endpoint observations expire and must not be accepted as enrollment proof. LAN endpoints are useful only when route scope and peer identity are independently verified.

Enrollment requires short-lived requests and explicit HQ approval. Bind approval to node ID, business/install identity, WireGuard public key, signing public key, requested allocation, request nonce, approval identity, and expiry. A one-time enrollment secret must be random, rate-limited, single-use, stored hashed, and never logged. Licensing and user authorization remain separate checks.

Rotation uses an overlap window in which only the recorded current and next key IDs are valid. After the deadline, the old key is blocked. Revocation is terminal for that credential and must remove the peer from WireGuard, deny sync signatures, invalidate enrollment material, increment the relevant epoch when compromise could permit stale writes, and create an audit event. Offline peers receive a signed revocation set before any data exchange.

Private and preshared keys must be generated by a cryptographically secure provider and stored using OS-protected secret storage with least-privilege filesystem fallback. They must never enter SQLite plaintext, frontend state, IPC payloads, logs, crash reports, telemetry, backups without encryption, or support bundles. `WireGuardPeerConfig::render_redacted` is support text only and intentionally cannot produce an installable configuration. Public keys and endpoint hosts are also shortened/redacted to reduce support-log linkability.

## Completed integration leaves

Migration **`099_sync_mesh.sql`** now owns sync node identity/status, exact branch/HQ epochs, source sequences, outbox/lease state, inbox identity, stable receipts, cursors/observed out-of-order sequences, conflicts, dead letters, snapshot/recovery metadata, and Private Mesh site/allocation/endpoint/enrollment/public-key/rotation/revocation/control-ack metadata. Migrations `094` through `098` preceded it; `099` was free when claimed. The separate read-only-web change is assigned `100` and must remain there.

`src-tauri/src/db/sync.rs` contains transaction-scoped sqlx functions for sequence allocation and event capture, exact epoch fencing/advancement, crash-recoverable lease generations, send/ack/retry/dead-letter transitions, idempotent inbox claims and stable receipts, contiguous cursor advancement, and snapshot/recovery metadata. The leaf is intentionally absent from `db/mod.rs` and `lib.rs` so this task cannot accidentally expose an incomplete transport or crypto path.

The database stores public keys, key IDs, SHA-256 digests, hashed enrollment secrets, and opaque key-custody references. It has no WireGuard private-key, preshared-key, signing-private-key, or plaintext enrollment-secret column. Private keys must never be reconstructed from database values.

## WireGuard dependency and custody manifests

The files under `src-tauri/wireguard/` are release inputs, not package wiring:

- `windows-embeddable-dll-service.toml` pins official WireGuard for Windows source revision `4e6726c23ae9c5cb58e0c9910f3b7515621d133d` and the `embeddable-dll-service` source path. Its deny-unlisted checksum policy intentionally contains no approved DLLs, so packaging must fail until reviewed `tunnel.dll` and `wireguard.dll` artifacts have SHA-256 values and valid Authenticode signatures in a signed release manifest.
- `android-tunnel.toml` pins `com.wireguard.android:tunnel:1.0.20260102` and its Maven Central AAR SHA-256 `2b9c16db026496123e4db695d26d03d1958a201096c7c4c89b21077dc70f3119`. Dynamic versions and repository fallback are forbidden.
- `THIRD_PARTY_NOTICES.md`, `LICENSE-APACHE-2.0.txt`, and `LICENSE-MIT-WIREGUARD-WINDOWS.txt` must ship whenever the corresponding artifact ships. The Android release step must also inspect the resolved AAR and preserve any upstream `NOTICE` content.

Each device generates its own keypair. Windows uses CNG plus DPAPI LocalMachine wrapping and a service-SID-restricted ACL. Android uses a hardware-backed Android Keystore key when available to wrap the device-local WireGuard secret. Only an opaque custody reference and public key enter SQLite. Cloning an Omnix database or backup must not clone a device credential.

## Windows installer elevation boundary

The current Tauri NSIS configuration uses `installMode: "currentUser"`. A current-user installer does not have the durable administrative context required to install/update the WireGuardNT driver, stage per-machine DLLs securely, create a `SERVICE_WIN32_OWN_PROCESS` service, apply `SERVICE_SID_TYPE_UNRESTRICTED`, or set service-SID ACLs. In short, this `currentUser` installer cannot install a VPN driver or Windows service without elevation. Attempting those operations from an unelevated post-install app produces partial installs, repeated UAC prompts, or a service whose binary/config can be replaced by the user.

Do **not** silently change the Tauri configuration in this task. The coordinator must choose and security-review one of two explicit designs: (1) move the Windows installer to a per-machine/elevated NSIS flow with rollback and uninstall cleanup; or (2) ship a separately signed, narrow bootstrapper that requests elevation only for driver/service install, verifies the signed checksum manifest, writes to administrator-protected locations, and returns a machine-readable result. The normal Tauri process must never accept peer-controlled paths, service names, or arguments for this bootstrapper. Driver/service installation is a high-impact operation and requires explicit user consent.

## Route boundary

Every generated peer configuration must restrict `AllowedIPs` to the selected private Omnix mesh subnet, normally the assigned peer `/32` and only the branch/HQ prefixes needed for typed sync traffic. `0.0.0.0/0` and `::/0` are forbidden: Omnix Private Mesh is not a customer internet gateway and must never capture general internet, payment, update, or unrelated LAN traffic. Validate each route against the persisted installation pool before passing configuration to WireGuard; fail closed on an address outside that pool or either default route.

## Exact protected-file coordinator patch

Apply these hunks only after `099_sync_mesh.sql` and the read-only-web `100_read_only_web.sql` leaf are both present on the integration branch. The migration order is intentionally 98 → 99 → 100.

```diff
diff --git a/src-tauri/src/db/mod.rs b/src-tauri/src/db/mod.rs
--- a/src-tauri/src/db/mod.rs
+++ b/src-tauri/src/db/mod.rs
@@
 // Database module placeholder
+pub mod sync;

diff --git a/src-tauri/src/lib.rs b/src-tauri/src/lib.rs
--- a/src-tauri/src/lib.rs
+++ b/src-tauri/src/lib.rs
@@
 mod commands;
 mod db;
 mod license;
+mod mesh_contracts;
+mod sync_contracts;
 pub mod network;
@@
         Migration {
             version: 98,
             description: "Salon commission payouts (daily staff pay)",
             sql: include_str!("../migrations/098_salon_commission_payouts.sql"),
             kind: MigrationKind::Up,
         },
+        Migration {
+            version: 99,
+            description: "Offline branch sync and Private Mesh metadata",
+            sql: include_str!("../migrations/099_sync_mesh.sql"),
+            kind: MigrationKind::Up,
+        },
+        Migration {
+            version: 100,
+            description: "Read-only browser companion sessions",
+            sql: include_str!("../migrations/100_read_only_web.sql"),
+            kind: MigrationKind::Up,
+        },
     ];
```

The Android coordinator must add the literal dependency `implementation("com.wireguard.android:tunnel:1.0.20260102")` to the native host module and pin SHA-256 `2b9c16db026496123e4db695d26d03d1958a201096c7c4c89b21077dc70f3119` in Gradle dependency verification. Do not add a dynamic version or fallback repository. Windows packaging must consume `windows-embeddable-dll-service.toml`; it must remain fail-closed until signed `tunnel.dll` and `wireguard.dll` hashes replace the empty approved-artifact list and the coordinator chooses an elevated per-machine installer or narrow signed bootstrapper.

## Coordinator integration sequence

1. Add `pub mod sync;` to `src-tauri/src/db/mod.rs`; add private `mod sync_contracts;` and `mod mesh_contracts;` declarations in `src-tauri/src/lib.rs`. Keep policy/query types behind service APIs—do not expose them directly as Tauri commands.
2. Register `099_sync_mesh.sql` in the existing Tauri migration list immediately after `098_salon_commission_payouts.sql` and before `100_read_only_web.sql`. Do not renumber either migration. Run it with foreign keys enabled.
3. Add bounded, versioned wire DTOs and canonical signed-byte golden vectors. Verify protocol version, maximum body length, authorized source/branch, exact epoch, expiry, payload SHA-256, non-revoked signing key, and signature before deserializing a business payload.
4. In each synchronizable domain service: begin one `sqlx::Transaction`; call `peek_next_sequence_in_tx`; perform the existing authorized business mutation using that transaction; canonicalize/hash/sign the envelope; call `capture_event_in_tx`; write the audit event; commit. Any failure rolls back the mutation, sequence, outbox event, and audit together.
5. Run one dispatcher per destination partition. Call `lease_outbox`, send only the returned lease generation, call `mark_outbox_sent`, then `acknowledge_outbox` only after a verified matching receipt. Route transient failures through `retry_or_dead_letter_outbox`; never mutate queue rows directly.
6. For inbound events: open one transaction after all cryptographic/control checks; call `begin_inbox_apply_in_tx`; return `InboxStart::Duplicate`'s stored receipt without applying again; otherwise invoke the existing domain validation/mutation with the same transaction, call `complete_inbox_apply_in_tx`, append audit, and commit. Conflicts/dead letters require explicit domain workflows rather than last-write-wins.
7. Build snapshot files outside SQLite, encrypted at rest. After digest/signature completion call `record_snapshot_metadata`. Before `request_recovery`, create an encrypted pre-restore backup, verify free space/signature/digest/schema/fence, restore into a new file, run SQLite integrity plus domain invariants, atomically swap while read-only, and advance recovery state/audit. Replay each source cursor plus one.
8. Add a privileged Windows mesh adapter that consumes only the signed, checksum-approved staged DLL manifest. It generates per-device keys through CNG/DPAPI, creates the fixed-prefix service with fixed arguments, enforces `SERVICE_SID_TYPE_UNRESTRICTED`, and removes/revokes it transactionally. Resolve the currentUser elevation design above before enabling the adapter.
9. In the Android host project, add the exact Maven coordinate and dependency verification hash from `android-tunnel.toml`; generate/wrap one device key via Android Keystore. Do not pass private keys through a React/Tauri bridge.
10. Bind startup to persisted node identity, current branch/HQ fence, source sequence, key status, and signed revocation set. Replace the broad LAN raw-SQL peer API: mesh peers exchange only bounded domain events, receipts, snapshots, and signed control messages. Migration `011_network.sql` bearer tokens are not mesh identity.
11. Package the applicable local license/notice files and generate a signed artifact inventory. Fail closed on a missing hash, unknown DLL/AAR, invalid Authenticode/signature, dynamic Maven version, unreviewed upstream `NOTICE`, or absent key-custody capability.
12. Add registered integration tests for SQLite atomic rollback, competing dispatchers, crash/restart lease recovery, duplicate/mismatched delivery, cursor gaps, stale/future epochs, canonical signature vectors, key rotation overlap, offline revocation, snapshot replay, NAT/relay fallback, installer rollback, and secret-free diagnostics.

Coordinator-owned protected files for this wiring are `src-tauri/src/db/mod.rs`, `src-tauri/src/lib.rs`, the migration registry in `lib.rs`, Tauri/NSIS configuration, Android Gradle files, package files, and CI/release jobs. None are modified by this task.

## Standalone validation

The contract suite is intentionally independent of Cargo registration:

```bash
rustc --edition=2021 --test src-tauri/tests/sync_mesh_contracts_standalone.rs \
  -o /tmp/omnix-sync-mesh-contract-tests
/tmp/omnix-sync-mesh-contract-tests
```

This validates host-target policy behavior only. It does not validate Tauri, SQLite, cryptography, operating-system key custody, WireGuard, or real network behavior.
