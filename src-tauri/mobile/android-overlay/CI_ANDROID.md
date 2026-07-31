# x86_64 Android CI generation and signed build plan

The current ARM64 worker must not initialize Android. The coordinator adds an independent `android` job on `ubuntu-24.04` (`x86_64`) or a pinned internal x86_64 image. Never add iOS commands.

## Immutable inputs

Read `src-tauri/mobile/android-toolchain.env`: Java 17, API/target 35, build-tools 35.0.0, NDK 28.1.13356709 (16 KiB page-ready), Tauri CLI 2.11.2, and all four Rust targets. Use `pnpm install --frozen-lockfile`. Installation/license acceptance happens only in the approved CI image/bootstrap owned by the coordinator, never in this worktree session. Cache keys include the full env-file SHA-256 and `Cargo.lock`/`pnpm-lock.yaml` hashes.

## Generation/build sequence

```bash
set -euo pipefail
test "$(uname -m)" = x86_64
bash scripts/android-preflight.sh
test ! -e src-tauri/gen/android
pnpm tauri android init --ci --skip-targets-install
git diff --exit-code -- package.json pnpm-lock.yaml src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git status --short
# Apply the reviewed overlay and coordinator patches described in ANDROID_INTEGRATION.md.
node scripts/verify-android-overlay.mjs --generated
pnpm exec tsc --noEmit
pnpm vitest run tests/android-platform.spec.ts tests/android-adapters.spec.ts tests/mobile-lifecycle.spec.ts tests/mobile-platform-components.spec.tsx tests/android-native-overlay.spec.ts tests/android-preflight.spec.ts
node scripts/audit-codebase.mjs
cargo test --manifest-path src-tauri/Cargo.toml --lib
pnpm tauri android build --ci --apk --aab --target aarch64 --target armv7 --target i686 --target x86_64
```

Do not use `--ignore-version-mismatches`. Run generated Gradle unit/lint tests before the Tauri build. Run `apksigner verify --verbose --print-certs` on every APK, `bundletool validate --bundle` on every AAB, and `zipalign -c -P 16 -v 4` on APKs. Assert 16 KiB ELF alignment with the current Android `check_elf_alignment.sh`. Inspect merged manifests separately for `directApk` APK and Play/AAB: forbidden permissions must be absent; `REQUEST_INSTALL_PACKAGES` must be absent from AAB.

## Signing inputs

Repository/environment secrets, all required and masked:

- `OMNIX_ANDROID_KEYSTORE_B64`: base64 of the release `.jks`.
- `OMNIX_ANDROID_KEYSTORE_SHA256`: digest checked immediately after decode.
- `OMNIX_ANDROID_KEYSTORE_PASSWORD`.
- `OMNIX_ANDROID_KEY_ALIAS`.
- `OMNIX_ANDROID_KEY_PASSWORD`.
- `OMNIX_ANDROID_SIGNING_CERT_SHA256`: expected certificate digest checked against `apksigner` output.

Decode to `$RUNNER_TEMP/omnix-release.jks` with mode `0600`, export only `OMNIX_ANDROID_KEYSTORE_PATH` plus the three Gradle signing variables, and securely delete the temporary file in an `if: always()` step. Never print secrets, `keytool -list -v` output, or Gradle properties. The public certificate digest may be published in the signed release manifest.

## Artifact contract

Upload immutable, digest-named artifacts: universal direct APK (or per-ABI APKs if product chooses), Play AAB, SHA-256 files, `apksigner` verification report with only public certificate digests, merged-manifest permission reports, SBOM, and third-party notices. The release manifest is server-signed and contains release id, variant, version name/code, exact size, HTTPS URL, APK SHA-256, signing certificate SHA-256, minimum supported version, and publication timestamp. APK and AAB artifacts must come from the same commit/version but use distinct distribution channels.

## CI permissions

Use `contents: read` for PR builds and no cloud credentials. A release job receives only artifact-upload permission after all verification gates pass. Do not run emulators, servers, or deployment in this task's focused validation job.
