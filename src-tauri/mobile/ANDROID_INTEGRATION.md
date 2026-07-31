# Android platform integration hand-off

Task-owned source work is under `src/platform/`, `src/mobile/`, `src/components/mobile/`, `src-tauri/src/mobile/`, and `src-tauri/mobile/android-overlay/`. The generated project is intentionally absent: this host is ARM64 and has no Java/SDK/NDK. No toolchain was installed, no licence accepted, and no output was fabricated.

## Delivered leaves

- Runtime split and phone/tablet capability model.
- Authenticated operational/branch context and hard read-only all-branch behavior.
- Permission/module-filtered Android navigation with business Settings excluded.
- Mobile shell, home, full account/device profile, searchable assigned-branch picker, offline/sync/mesh status, protected account actions, and accessibility tests.
- Typed fail-closed adapters for Android Keystore, biometrics, bundled scanner, notifications, safe sharing, lifecycle/predictive back, direct APK updates, and embedded WireGuard mesh.
- Shared TypeScript/Rust/native command contract and Android-only Rust plugin forwarding leaf.
- Pinned x86_64 preflight/toolchain plan, exact initializer/build commands, least-privilege manifest/capability overlays, release signing inputs, direct-APK versus AAB separation, notices/SBOM gates, and deterministic source/generated overlay checker.

## Current fail-closed state

`src-tauri/capabilities/android-minimal.json` grants only `core:default`. This is deliberate: generated plugin permission schemas do not exist yet. Native adapters must report unavailable until the coordinator performs generated integration. The broad desktop capability does not apply because `tauri.android.conf.json` selects only `android-minimal`.

## Coordinator action

Follow `COORDINATOR_PATCH.md` exactly. Native generation/build details are in `android-overlay/README.md`, `NATIVE_CONTRACT.md`, and `CI_ANDROID.md`.

Approved initializer (x86_64 only, after preflight):

```bash
pnpm tauri android init --ci --skip-targets-install
```

Approved signed build command after overlay and signing setup:

```bash
pnpm tauri android build --ci --apk --aab --target aarch64 --target armv7 --target i686 --target x86_64
```

Do not run any iOS command. Do not use `--ignore-version-mismatches`.
