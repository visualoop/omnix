# Coordinator-owned integration patch — Android task 13

Do not cherry-pick generated guesses. Apply these edits centrally after the worktree leaves merge and an x86_64 runner passes `scripts/android-preflight.sh`.

## 1. `src/App.tsx` — split before desktop hooks

Add imports for `readRuntimeSignals`, `resolveRuntimeCapabilities`, `createAndroidPlatformAdapters`, `registerMobileLifecycle`, the four mobile components/models, navigation/context helpers, `useNavigate`, and `useLocation`. Compute runtime once in `App`:

```tsx
const runtime = resolveRuntimeCapabilities(readRuntimeSignals());
```

Customer-display and kitchen-display branches remain desktop-only (`runtime.target === "desktop"`). Pass `runtime` into `AppContent`. Split `AppContent` into shared boot/auth state plus two authenticated children. **Do not conditionally call hooks.** Move these existing desktop-only hooks unchanged into `DesktopAuthenticatedApp`: `useF11Fullscreen`, `useAutoUpdate`, `useLanAutostart`, and desktop `WindowTitlebar`/`AppShell` routing. Keep DB init, setup/auth, offline queue, background jobs, and alert scanner in a common component only where their underlying services are Android-safe.

Before setup/auth screens, choose chrome by target: Android renders setup/login without `WindowTitlebar` or desktop minimum widths. After `user` exists:

```tsx
if (runtime.target === "android") {
  return <AndroidAuthenticatedApp runtime={runtime} />;
}
return <DesktopAuthenticatedApp />;
```

`AndroidAuthenticatedApp` must:

1. Create one `createAndroidPlatformAdapters()` instance; unavailable registration is a hard native-feature error, never a localStorage/SQLite fallback.
2. Build `OperationalContext` from authenticated user id/effective permissions, assigned branches, explicit active scope, and country. Do not infer branch from device state.
3. Load account/device status through typed commands and validate with `createAccountDeviceModel`; never add password, PIN, session/mesh secret, enrollment token, or private key fields.
4. Resolve routes with `resolveAndroidNavigation(ANDROID_MOBILE_ROUTES, ...)` and create the shell model from the current location. Mount `MobileShell` around `/mobile`, `/mobile/profile`, and only the existing operational route elements allowed by that resolved set. No `/settings` or `/settings/*` route may be mounted or redirected into mobile.
5. Enforce `ResolvedMobileRoute.access === "read"` at every mutation/action boundary when all-branch scope is active. UI labels are not authorization.
6. Register `registerMobileLifecycle(adapters.lifecycle, ...)` once inside the router. `canNavigateBack` is based on router history; handled back calls `navigate(-1)`, unhandled back delegates to Android.
7. Use the Android APK adapter only for direct-APK flavor metadata. Never call desktop `useAutoUpdate`/process updater on Android.
8. On account/branch switch or sign-out, stop mesh, clear account-scoped session material, dispose listeners/scanner, then update auth state.

Keep the existing desktop route tree byte-for-byte except where extracting it into `DesktopAuthenticatedApp` requires moving JSX.

## 2. `src-tauri/src/lib.rs` — Android registration only

At module declarations:

```rust
#[cfg(target_os = "android")]
mod mobile;
```

Break the builder chain immediately after `.plugin(tauri_plugin_process::init())`:

```rust
let builder = tauri::Builder::default()
    // existing manage/plugin calls through process, unchanged
    .plugin(tauri_plugin_process::init());

#[cfg(target_os = "android")]
let builder = builder.plugin(mobile::init());

builder
    .plugin(
        tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:omnix.db", migrations)
            .build(),
    )
    // existing setup, invoke_handler, run unchanged
```

The leaf `src-tauri/src/mobile/mod.rs` already registers exactly:

```rust
api.register_android_plugin("co.ke.omnix.app.mobile", "OmnixMobilePlugin")
```

Do not add mobile commands to the global app `invoke_handler`; they belong to plugin `omnix-mobile`. No iOS module/registration.

## 3. `src-tauri/Cargo.toml`, `Cargo.lock`, `package.json`, `pnpm-lock.yaml`

No new direct dependency is required for the Rust forwarding leaf or TypeScript adapter: existing `tauri`, `serde_json`, and `@tauri-apps/api` are sufficient. Keep all four files unchanged unless the official initializer changes a required Tauri mobile feature; if it does, review that generated diff centrally, pin the exact resolved version, and reject unrelated changes. Never add official plugin packages in parallel with this custom contract because that would create duplicate permission/behavior paths.

## 4. Generated Android project

Run only after clean x86_64 preflight:

```bash
pnpm tauri android init --ci --skip-targets-install
```

Apply every file/insertion listed in `android-overlay/README.md`; implement `NATIVE_CONTRACT.md` at the exact package/class registered above. `wireguard-dependency.gradle.kts.snippet` is superseded by the complete `android-dependencies.gradle.kts.snippet`; do not insert both. Then run `node scripts/verify-android-overlay.mjs --generated`.

## 5. `src-tauri/capabilities/android-minimal.json`

Only after generated plugin permissions validate, replace the current `permissions` array with:

```json
[
  "core:default",
  "omnix-mobile:secure-storage",
  "omnix-mobile:biometric",
  "omnix-mobile:scanner",
  "omnix-mobile:sharing",
  "omnix-mobile:notifications",
  "omnix-mobile:mesh",
  "omnix-mobile:lifecycle"
]
```

For direct-APK flavor only, merge an additional capability containing `omnix-mobile:apk-update`. Do not grant it to the Play/AAB webview. Never add `sql:default`, generic `http:default`, shell, process, filesystem, broad `omnix-mobile:default`, or wildcard permissions to Android. Do not modify desktop `capabilities/default.json`.

## 6. `.github/workflows/ci.yml` or new coordinator workflow

Add an independent x86_64 Android job following `android-overlay/CI_ANDROID.md`. It installs only pinned toolchain components in the approved CI context, runs init with `--skip-targets-install`, asserts choke-file diffs are empty, applies the overlay, and runs focused Vitest, full type-check, audit, Rust tests, generated Gradle tests/lint, signed APK+AAB build, signer, manifest, SBOM/notices, bundle validation, and 16 KiB alignment gates. PR permissions are `contents: read`; release publishing is a separate dependent job. No emulator/server/deploy step.

Required secrets are exactly the six names in `CI_ANDROID.md`. Add environment protection for release signing. Never put keystore data or passwords in Gradle properties committed to git.

## 7. Website/release API

Extend the signed release record and `/api/releases-latest` response with Android distribution records containing `releaseId`, `variant`, `versionName`, monotonically increasing `versionCode`, `channel` (`direct-apk` or `play`), exact `sizeBytes`, HTTPS URL, APK SHA-256, public signing-certificate SHA-256, minimum supported version, and UTC publication time. The endpoint must sign the canonical response and never return an arbitrary host. Preserve existing Windows updater responses. Device/license rollout gating may suppress an update but must fail offline without blocking app use.

## Integration acceptance

After all coordinator edits: no `src-tauri/gen/ios`, no iOS command/config/capability; source and generated overlay checks pass; Android capability schema resolves every identifier; direct APK and AAB merged permission reports differ only as documented; a generated native test proves each adapter plus VPN/update denial remains non-blocking; `git diff --check`, focused/full tests, type-check, audit, Rust tests, Gradle lint/test, APK/AAB signing/alignment validation all pass.
