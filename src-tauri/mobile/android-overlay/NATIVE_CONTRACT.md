# Omnix Android native contract

This is the review source for the Android-only `omnix-mobile` Tauri plugin. It is not generated output. The coordinator creates the plugin with Tauri CLI 2.11.2 on the pinned x86_64 toolchain, then implements this contract in the generated source set. JavaScript calls Rust commands named `plugin:omnix-mobile|<snake_case command>`; Rust delegates to Kotlin camel-case commands with `PluginHandle::run_mobile_plugin`.

`android-contract.json` is authoritative for command/event names. Unknown fields, oversized strings, malformed ids, and native results that do not match these shapes fail closed.

## Secure storage / Android Keystore

- `secure_storage_availability() -> AdapterAvailability`
- `secure_storage_get({ key }) -> { value: string | null }`
- `secure_storage_set({ key, value }) -> {}`
- `secure_storage_remove({ key }) -> {}`

`key` is `{ namespace: "session" | "device" | "mesh", accountId, name }`; each part matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Kotlin repeats this check. Generate a non-exportable AES-256/GCM key in `AndroidKeyStore` for each hashed structured key. Store only IV + ciphertext + tag in app-private preferences. Set `setUserAuthenticationRequired(true)` only for credentials whose product flow explicitly requires biometric unlock; never silently change authentication policy for existing ciphertext. No plaintext secret, token, WireGuard private key, key alias input, or decrypted value enters logs, SQLite, backups, intents, saved instance state, analytics, or UI models. Unrecoverable keys delete their ciphertext and return a typed `KEY_INVALIDATED` error; there is no insecure fallback.

## Biometrics

- `biometric_availability() -> { status, kinds, enrolled }`
- `biometric_permission() -> PermissionState`
- `biometric_request_permission() -> PermissionState`
- `biometric_authenticate({ reason }) -> { verified: boolean }`

Use `BiometricManager` and `BiometricPrompt`. Android has no biometric runtime permission: query returns `granted` only when supported/enrolled and `unavailable` or `prompt` otherwise; request opens the protected OS prompt and never collects biometric material. Return only the outcome. Cancel, lockout, and negative button resolve `verified: false` with a non-secret error code.

## Scanner

- `scanner_availability() -> AdapterAvailability`
- `scanner_permission() -> PermissionState`
- `scanner_request_permission() -> PermissionState`
- `scanner_scan({ options }) -> ScanResult | null`
- `scanner_cancel() -> {}`

Use CameraX plus the bundled ML Kit barcode model; no Google Play dynamic-module dependency and no external scanner intent. Decode only requested formats, bound image analysis to one frame at a time, stop camera resources on pause/cancel, and return one trimmed value (max 4096 bytes), normalized format, and UTC timestamp. Camera denial leaves manual search and every offline ERP operation usable.

## Notifications

- `notification_availability() -> AdapterAvailability`
- `notification_permission() -> PermissionState`
- `notification_request_permission() -> PermissionState`
- `notification_post({ notification }) -> {}`
- `notification_cancel({ notificationId }) -> {}`

Request `POST_NOTIFICATIONS` only on API 33+. Use an Omnix-owned channel and `WorkManager` for inexact scheduled local notifications; do not request exact-alarm permission. Notification routes must be local absolute paths, must not target Settings, and are emitted through `notification-opened` from `onNewIntent`. PendingIntent is immutable and explicit. Never put customer, patient, prescription, credential, or payment data in lock-screen text.

## Sharing

- `share_availability() -> AdapterAvailability`
- `share_permission() -> PermissionState`
- `share_request_permission() -> PermissionState`
- `share({ payload }) -> { completed: boolean }`

Android sharing has no runtime permission, so query/request are separate idempotent calls returning `granted` only if an explicit chooser can resolve. Attachments use opaque `attachmentId` values. Resolve them only below app cache `exports/`, expose with the unexported FileProvider, grant one-shot read URI permission, and reject raw paths, `file://`, caller-supplied `content://`, directory traversal, and more than ten attachments.

## Lifecycle and predictive back

- `lifecycle_current_state() -> "active" | "inactive" | "background"`
- `lifecycle_complete_back({ requestId, handled }) -> {}`
- events: `lifecycle`, `back-requested`

Register one lifecycle observer and AndroidX back callback. A back event carries a unique request id and `canGoBack`; React acknowledges it exactly once. If React handles it, navigate browser history. Otherwise delegate to Android's dispatcher so root back backgrounds/exits naturally. Time out after 500 ms and delegate to Android. Do not invent routes or route to Settings.

## Signed direct-APK updates

- `apk_update_availability() -> AdapterAvailability`
- `apk_update_status() -> ApkUpdateStatus`
- `apk_update_stage({ request }) -> ApkUpdateStatus`
- `apk_update_install({ releaseId }) -> ApkUpdateStatus`
- `apk_update_cancel({ releaseId }) -> {}`
- event: `apk-update-progress`

Direct-APK builds only: accept HTTPS from `omnix.co.ke` or `media.omnix.co.ke`, enforce positive monotonic `versionCode`, declared byte length, SHA-256 of downloaded bytes, and SHA-256 of the APK signing certificate matching both the signed release manifest and installed app. Download to app-private cache, fsync, verify with `PackageManager` before moving to `updates/verified/`, then launch an explicit package-installer intent through FileProvider. `REQUEST_INSTALL_PACKAGES` exists only in the `directApk` manifest source set. User denial or unknown-sources policy leaves the verified APK staged and core use available. AAB/Play builds report unavailable and use Play-managed updates; never ship `REQUEST_INSTALL_PACKAGES` in an AAB.

## Embedded WireGuard private mesh

- `mesh_availability() -> AdapterAvailability`
- `mesh_status() -> MeshStatus`
- `mesh_start({ request: { accountId, branchId, enrollmentId } }) -> MeshStatus`
- `mesh_stop() -> {}`

Use only `com.wireguard.android:tunnel:1.0.20260102`. Call `VpnService.prepare`; denial resolves `permission-denied` and is not an app failure. Ask only when the user first enables or explicitly retries Private Mesh; later revocation returns to the same state. `starting` lasts until WireGuard reports a real peer handshake, `connected` requires a recent handshake, and a configured tunnel with no handshake becomes `offline`/hub unreachable after a bounded grace period. Resolve `enrollmentId` to the AES-GCM encrypted account-scoped secure-storage value at `{ namespace: "mesh", accountId, name: enrollmentId }`. The version-1 JSON value contains the approved `accountId`, `branchId`, `status`, `nodeId`, `hubName`, `keyId`, optional expected `devicePublicKey`, `interfaceAddress`, private `meshSubnet`, hub `peerPublicKey`, `endpoint`, bounded `allowedIps`, and optional `persistentKeepaliveSeconds`. Rotation-pending values also carry `nextKeyId`, optional `nextDevicePublicKey`, `rotationDeadline`, and `activateNextKey`; revoked values are terminal.

Generate the device WireGuard key from a per-account/key-id, non-exportable HMAC-SHA256 key held by `AndroidKeyStore`; only the derived private bytes exist transiently in native memory and are zeroed immediately after import. No private key blob is written to preferences, files, SQLite, backups, logs, intents, or IPC. React receives public status only. Bind the tunnel to the authenticated account and explicit assigned branch; never infer branch from device state. Validate the interface and every allowed route against the approved RFC1918 mesh pool before creating `Config`; reject IPv6 and `0.0.0.0/0`/`::/0` so ordinary internet traffic remains outside the VPN.

Run the backend under `OmnixMeshService`, an ongoing foreground service with a persistent notification. A non-exported boot receiver restores only a tunnel the user previously enabled and only while VPN consent remains valid. A default-network callback rebuilds the tunnel after Wi-Fi/mobile handoff, and leaving Doze rechecks lifecycle state and connectivity. Android revoking consent or another VPN taking over drives the backend down and status becomes disabled/degraded until the user reconnects. Re-read the secure enrollment lifecycle while connected: activate an approved next key during rotation, block an expired old key, and stop plus delete Keystore credentials for terminal revocation. Stop and release backend config on account switch, revoke, sign-out, or explicit stop. No generic tunnel config, arbitrary endpoint, shell, SQL, HTTP, or private-key command is exposed.

## Required native tests after generation

Robolectric/instrumented tests must cover key validation and invalidation, biometric cancellation, camera/notification denial, attachment traversal, lifecycle back timeout, notification route rejection, update host/hash/signer/version failures, AAB absence of installer permission, VPN consent denial, account/branch mismatch, private-key redaction, and all command serialization fixtures. These are external blockers until the generated project exists and Gradle can run.
