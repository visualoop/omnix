# Reviewed Android native overlay

This directory is the reviewed source of the Android overlay. The generated Android project mirrors these files after initialization; edit the reviewed Kotlin files first, copy them into `src-tauri/gen/android/**`, and use the verifier to reject drift. Do not install toolchains here, accept licences here, or run any iOS command.

## Source-state checks

```bash
bash scripts/android-preflight.sh       # expected to fail on the current ARM64/toolchain-less host
node scripts/verify-android-overlay.mjs # must pass without generated output
```

Pinned inputs live in `../android-toolchain.env`. The exact approved initializer on x86_64 CI is:

```bash
pnpm tauri android init --ci --skip-targets-install
```

`--skip-targets-install` prevents Tauri from installing Rust targets. Immediately reject generated changes outside `src-tauri/gen/android/**`; coordinator-owned manifest/lock/config changes are applied only through the reviewed patches in `../COORDINATOR_PATCH.md`. Never run `tauri ios init`.

## Overlay map after initialization

1. Merge `android-settings.gradle.kts.snippet`, `android-dependencies.gradle.kts.snippet`, and `release-signing.gradle.kts.snippet` into `src-tauri/gen/android/app/build.gradle.kts`. Keep each coordinate exactly pinned. Do not replace the generated Gradle file.
2. Copy `OmnixMobilePlugin.kt`, `BarcodeCaptureSession.kt`, and `DirectApkUpdater.kt` into `src-tauri/gen/android/app/src/main/java/co/ke/omnix/app/mobile/`, and copy `MainActivity.kt` into the parent app package. These files implement `NATIVE_CONTRACT.md`; `scripts/verify-android-overlay.mjs --generated` compares every mirror byte-for-byte. The Rust bridge is `src-tauri/src/mobile/mod.rs` and registers `co.ke.omnix.app.mobile.OmnixMobilePlugin`.
3. Merge `AndroidManifest.xml.snippet` into the base manifest. Copy `omnix_file_paths.xml` and `omnix_network_security_config.xml` to generated `res/xml/`. Apply `AndroidManifest.direct-apk.xml` only to the direct-APK product flavor/source set; it must not enter an AAB.
4. Copy `permissions.toml` into the generated plugin permission source, regenerate Tauri schemas, and then make the coordinator capability patch. The active capability remains `core:default` until those identifiers exist.
5. Retain `NOTICE-WIREGUARD` and `THIRD_PARTY_NOTICES.md` in release notices. Legal approval of the bundled ML Kit terms and generated transitive report is a release gate.
6. Configure direct APK versus Play/AAB product flavors. Direct APK can stage verified updates; AAB reports that adapter unavailable and relies on Play-managed updates.
7. Run `node scripts/verify-android-overlay.mjs --generated`, generated Gradle tests/lint, the focused TypeScript/Rust gates, and the signing/manifest/alignment checks in `CI_ANDROID.md`.

## Exact build command

After overlay application and signing inputs are present:

```bash
pnpm tauri android build --ci --apk --aab --target aarch64 --target armv7 --target i686 --target x86_64
```

Do not use `--ignore-version-mismatches`. APK/AAB output is not accepted until `apksigner`, `bundletool`, merged-manifest, SBOM/notices, and 16 KiB alignment gates pass.

## Security boundary

`src-tauri/tauri.android.conf.json` selects only `android-minimal`; the broad desktop capability never applies. Native unavailable/denied states leave offline ERP use available. Keystore secrets and WireGuard private keys never cross into React, SQLite, logs, backups, intents, or UI state. Sharing resolves opaque app-owned attachment ids. Updates accept only signed Omnix HTTPS metadata and require user package-installer consent. No location, contacts, SMS, call-log, external-storage, accessibility, device-admin, or broad package-query permission is allowed.
