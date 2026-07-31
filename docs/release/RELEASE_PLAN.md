# Android and Website Release Plan — Tracker Task 26

**Status:** reviewable plan and staged workflow; not active
**Workflow source:** `docs/release/android-release-workflow.yml`
**Coordinator-owned file intentionally untouched:** `.github/workflows/ci.yml`

## 1. Decision and scope

Omnix will keep the existing tag-driven Windows release intact: `.github/workflows/ci.yml` builds Dawa, Retail, Hospitality, Hardware, and Salon on `v*.*.*`, attaches the Windows installers to the GitHub Release, mirrors them to R2, and calls `https://omnix.co.ke/api/releases-sync`.

Android is an additional release target with one stable application identity, `co.ke.omnix.app`. Its direct-distribution artifact is a signed **universal APK** containing the four supported Android ABIs. A signed AAB is built and retained for a later Google Play launch, but Play publishing is not part of this task.

**iOS is explicitly excluded.** This plan does not provision macOS runners, Xcode, Apple certificates, App Store Connect, TestFlight, IPA files, or an iOS update channel.

This worker does not activate CI. The YAML under `docs/release/` cannot run as a GitHub workflow. The coordinator must review and merge its content into `.github/workflows/ci.yml` or copy it to a coordinator-owned active workflow only after all gates below pass.

## 2. Why Android builds must run in CI

The development host is ARM64 and cannot run `tauri android init`. Android project initialization and release builds therefore run on an **x86_64 Linux GitHub-hosted runner** (`ubuntu-24.04`). The staged workflow fails immediately unless `uname -m` is `x86_64`; an ARM64 self-hosted runner is not an acceptable substitution.

The runner installs:

- Node 20 and the repository-declared pnpm version;
- JDK 17 (Temurin);
- Android platform/API 35, build-tools 35.0.0, and NDK 27.2.12479018;
- stable Rust with `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, and `x86_64-linux-android` targets.

Those versions are pinned in the staged workflow. A dependency/toolchain bump is a reviewed release change, not an implicit “latest” upgrade.

## 3. Build, identity, and version policy

### Commands

The release job performs the required sequence on the tagged source:

```bash
pnpm tauri android init
pnpm tauri android build --apk
pnpm tauri android build --aab
```

`--apk` must yield exactly one release APK whose path/name identifies it as universal. `--aab` must yield exactly one release AAB. The workflow stops instead of publishing if it sees split APKs, multiple release artifacts, or no universal APK.

### Stable identity

- Android application/package ID: `co.ke.omnix.app`.
- The workflow verifies that `src-tauri/tauri.conf.json` still carries that identifier and that the generated Gradle project uses it. It does not silently rename a changed package.
- The same upload key and package ID must be used for every direct APK and future Play release. Changing either prevents an installed app from accepting an in-place update.
- The tag, root `package.json`, and Tauri version must match before the build begins.

### Monotonic versionCode

Stable release tags use `vMAJOR.MINOR.PATCH`. The Android `versionName` is the tag without `v`. The deterministic code is:

```text
versionCode = MAJOR × 1,000,000 + MINOR × 1,000 + PATCH
```

Minor and patch are constrained to `0..999`; the result must be `1..2,100,000,000`. A release version must never move backwards. For example, `v0.72.4` maps to `72004`, and `v1.0.0` maps to `1000000`. The staged workflow rejects prerelease tags because beta/RC ordering needs a separate versionCode allocation policy before such AABs can be uploaded to Play.

The coordinator must compare the computed code with the latest persisted Android code in the website release record before activation. The Android-aware ingest endpoint must reject `versionCode <= latest Android versionCode` for a different release. Idempotent retries of the same tag/code are allowed.

## 4. Signing and secret custody

The APK and AAB are signed with the same Android release keystore. Store only these values in GitHub Actions secrets:

| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64 representation of the binary JKS/PKCS12 keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Release key alias |
| `ANDROID_KEY_PASSWORD` | Private-key password |

The workflow decodes the keystore into `$RUNNER_TEMP`, sets mode `0600`, validates the alias with `keytool`, injects a release `signingConfig` into the CI-generated Gradle project, and never writes secret material into the repository or release artifacts. It records only the public signing-certificate SHA-256 fingerprint.

Post-build checks are mandatory:

- `apksigner verify --verbose --print-certs` for the APK;
- `jarsigner -verify -verbose -certs` for the AAB (without PKI strict mode, because Android app-signing certificates are normally self-signed);
- the signing certificate must remain the expected production certificate;
- `sha256sum` is generated for both artifacts and immediately checked with `sha256sum -c`.

Back up the keystore and passwords offline under dual control. Losing the key makes direct APK updates impossible. Do not rotate it as a normal release operation. If Play App Signing is introduced later, document the distinction between the Play app-signing key and upload key before the first store upload.

## 5. Published artifacts and storage

For `vX.Y.Z`, the release job produces:

```text
Omnix-X.Y.Z-android-universal.apk   # public website download
Omnix-X.Y.Z-android.aab             # retained for later Play submission
SHA256SUMS                          # APK and AAB SHA-256 values
android-release.json                # machine-readable Android metadata
```

All four files attach to the existing GitHub Release for the tag. They are also mirrored under the existing R2 release hierarchy:

```text
releases/vX.Y.Z/android/<artifact>
```

The website links to the R2 APK so downloads remain available if the GitHub repository becomes private. The AAB is not presented as an end-user download even though it is retained with the release. Existing R2 retention keeps GitHub Releases as the permanent history; the coordinator must confirm that retention cannot remove the current Android object before metadata changes point clients to it.

The job is retry-safe: GitHub release asset upload, R2 copy, and website ingestion all target deterministic names. Never publish metadata before the signed file exists at its final URL.

## 6. Existing website API integration

The current API paths are retained, but their contracts need an Android extension.

### Ingest: `POST /api/releases-sync`

CI continues authenticating with `x-system-token` using the existing `PAYLOAD_SYSTEM_TOKEN`/server-side `RELEASE_INGEST_TOKEN` compatibility. The staged workflow sends the existing release fields plus:

```json
{
  "platform": "android",
  "variant": "android",
  "androidPackageId": "co.ke.omnix.app",
  "androidVersionCode": 72004,
  "androidApkUrl": "https://media.omnix.co.ke/releases/v0.72.4/android/Omnix-0.72.4-android-universal.apk",
  "androidAabUrl": "https://media.omnix.co.ke/releases/v0.72.4/android/Omnix-0.72.4-android.aab",
  "androidApkSize": 0,
  "androidAabSize": 0,
  "sha256Apk": "<64 lowercase hex characters>",
  "sha256Aab": "<64 lowercase hex characters>",
  "androidSigningCertificateSha256": "<64 lowercase hex characters>"
}
```

The coordinator must extend the existing Drizzle release model/ingest implementation to persist this as a typed `metadata.android` object (or typed columns), without overwriting `metadata.variants` or desktop hashes. Updates must be transaction-safe because the five Windows jobs and Android can report the same release. An ingest response must acknowledge `{ ok: true, platform: "android", androidApkUrl: "..." }` only after persistence. The staged workflow checks that response deliberately; the unmodified endpoint currently ignores Android fields, so activation would fail safely instead of claiming a successful sync.

Input validation must require HTTPS URLs on the approved GitHub/R2 hosts, the fixed package ID, positive sizes, valid SHA-256 values, a known signing-certificate fingerprint, valid SemVer, and a monotonic versionCode. Logs must not include the system token or keystore values.

### Version check: `GET /api/releases-latest?platform=android`

Extend the existing latest-release API rather than asking the Android client to consume the desktop Tauri manifest. Suggested request:

```text
GET /api/releases-latest?platform=android&currentVersion=0.72.3&currentVersionCode=72003
```

Return `204` if there is no newer compatible Android release. Otherwise return a typed payload such as:

```json
{
  "platform": "android",
  "version": "0.72.4",
  "versionCode": 72004,
  "packageId": "co.ke.omnix.app",
  "notes": "...",
  "publishedAt": "2026-07-31T12:00:00Z",
  "apk": {
    "url": "https://media.omnix.co.ke/releases/v0.72.4/android/Omnix-0.72.4-android-universal.apk",
    "size": 0,
    "sha256": "<64 lowercase hex characters>",
    "signingCertificateSha256": "<64 lowercase hex characters>"
  }
}
```

Keep the existing desktop response unchanged when `platform` is absent. Cache Android checks briefly, but never cache a failed or partial ingest as latest.

## 7. Android download and update experience

### Download page

Add a localized public route such as `/{locale}/download/android` and a dashboard link after the website integration is assigned. It should show:

- current version and publication date;
- APK size, SHA-256, package ID, and signing-certificate fingerprint;
- one primary “Download Android APK” action targeting the R2 URL;
- short sideload instructions and the minimum supported Android version;
- an explicit note that the AAB is for Play distribution and is not installable;
- a link to release notes and a troubleshooting path for “install unknown apps.”

Do not expose secrets, the keystore, or a mutable unverified redirect. The download page must obtain its URL from the persisted release record and must not guess filenames.

### Signed-download update flow

`@tauri-apps/plugin-updater` is desktop-targeted and must not be treated as the Android updater. Android needs a small platform-specific flow:

1. Check connectivity without blocking offline use. If offline, defer the check; core operations remain available.
2. Call the Android form of `/api/releases-latest` with the installed `versionName` and `versionCode`.
3. Accept only a higher versionCode, the exact package ID, HTTPS, and an approved download host.
4. Download to app-private temporary storage with bounded size/time and resumable or retry-safe behavior.
5. Stream SHA-256 while downloading and compare it in constant time with release metadata. Delete the file on mismatch.
6. Inspect the APK before prompting: package ID must be `co.ke.omnix.app`, and its signing certificate must match both the installed app and the pinned production fingerprint.
7. Open the Android package installer through a `FileProvider`/content URI with temporary read permission. Never request silent-install or device-admin privileges.
8. Android Package Manager performs the final signature and downgrade checks. Surface cancellation or failure clearly and leave the existing app/data intact.
9. Delete stale temporary APKs. Record only non-sensitive update status in diagnostics.

The APK's Android signing certificate is the update trust anchor; SHA-256 protects the downloaded bytes and catches corruption/substitution before installer handoff. TLS and strict host validation protect metadata transport. A later security review may add a separately signed metadata envelope, but it must use a pinned public key and key-rotation plan rather than reusing an undocumented desktop-plugin behavior.

## 8. Final release validation gates

No tag may be called ship-ready until evidence exists for every item below.

### Automated product gates

- [ ] **Desktop Vitest:** root `pnpm test` passes on the exact release commit.
- [ ] **Rust tests:** `cargo test --lib` passes for the release commit using the intended host target override.
- [ ] **Website integration suite:** `website` integration tests pass, including the new Android ingest/latest/download-page cases and existing release cases.
- [ ] **Four-country checks:** Kenya, Uganda, Tanzania, and Rwanda route/currency/authority/canonical checks pass (`east-africa-markets` plus the relevant SEO route suite).
- [ ] **Read-only web security checks:** unauthenticated/read-only routes cannot mutate ERP data; session, authorization, CSRF/origin, URL allowlist, traversal, secret-redaction, and update-metadata validation tests pass.
- [ ] **Android artifact checks:** universal APK contains `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`; APK/AAB signatures verify; package ID, versionName, versionCode, certificate fingerprint, sizes, and SHA-256 values match API metadata.
- [ ] **Website smoke check:** Android page downloads the exact signed APK; old versionCode receives an update and current versionCode receives `204`; offline app use is unaffected.

### Branch isolation gate

- [ ] Release work is integrated from isolated task branches/worktrees; unrelated worker changes are absent.
- [ ] `git status --short`, `git diff --name-only <release-base>...HEAD`, and `git diff --check <release-base>...HEAD` are captured.
- [ ] Only the coordinator edits `.github/workflows/ci.yml`, root package/version files, generated Android app source, or shared integration registries.
- [ ] The tag points at the reviewed integration commit, not a worker branch, dirty tree, merge preview, or unreviewed generated output.

### Coordinator integrations still required before shipping

These are blockers, not follow-up enhancements:

- [ ] Register the **typed command API** in the application command registry and generated TypeScript bindings.
- [ ] Register the **read-only web router and session** with authenticated, least-privilege access and mutation denial.
- [ ] Complete **sync and mesh wiring**, including discovery/reconnect, authorization, conflict behavior, and offline fallback.
- [ ] Perform **Android project generation** on an x86_64 runner, review generated Gradle/manifest/capability changes, reconcile plugin support and mobile permissions, and decide which generated files are committed. The workflow's `tauri android init` reproducibility check does not replace this application integration.
- [ ] Extend `/api/releases-sync`, `/api/releases-latest`, the release schema/types, admin display, and download page for Android metadata.
- [ ] Activate the reviewed Android job in coordinator-owned CI and ensure release ingestion is serialized/transactional with the five Windows variant notifications.

## 9. Activation sequence

1. Coordinator completes and reviews the four application integrations above, including generated Android source.
2. Implement typed Android release metadata and tests in the existing website API. Deploy it before activating Android release CI.
3. Create the production Android keystore, record its certificate fingerprint, put secrets in GitHub, and store an offline recovery copy.
4. Copy/merge the staged workflow into coordinator-owned Actions configuration. Preserve the existing Windows matrix, Payload/Drizzle notification, and R2 retention behavior.
5. Run a non-production rehearsal with a throwaway package ID and keystore in a private environment. Do not publish that key/package as production.
6. Build the first production tag. Confirm GitHub and R2 bytes have the same SHA-256 and confirm website API acknowledgment.
7. Install the APK on clean ARM64 and x86_64 Android test devices/emulators, exercise offline startup and read-only web access, then install a higher signed version over it without data loss.
8. Mark the Android record stable and expose the download page only after all validation evidence is attached to the release review.

## 10. Failure and rollback policy

Never reuse a lower versionCode and never replace an already published tag with different bytes. If the build or metadata sync fails, fix the cause and rerun the same immutable tag only when the artifact bytes are unchanged; otherwise create a new patch release and higher versionCode.

For a bad Android release, remove it from “latest,” keep the forensic artifact/checksum, publish a fixed higher versionCode, and have clients upgrade forward. Android does not permit a normal signed downgrade over a higher installed code. If the APK key or package ID differs, stop publication immediately: that is a new application identity, not a rollback.

R2 deletion is not a rollback by itself because clients may already have metadata or a cached APK. Update website metadata atomically first, verify the replacement, and prune only after no active record references the object.

## 11. Review notes for the staged YAML

The workflow intentionally:

- lives outside `.github/workflows` and is non-active;
- uses x86_64 Ubuntu, JDK 17, pinned SDK/NDK, and all four Rust Android targets;
- runs Android init, builds a universal APK and AAB, and signs both from secrets;
- verifies signatures, creates SHA-256 checksums, publishes GitHub assets, and mirrors R2;
- posts Android fields to the existing release ingest path;
- fails the API step until the coordinator implements an Android-aware acknowledgment;
- performs no iOS work and no Play upload.

Before activation, action SHAs should be pinned according to the repository's supply-chain policy, and the coordinator should decide whether Android is a `needs: build` job in `ci.yml` or a separate serialized workflow. A separate tag workflow must not race a non-atomic release metadata update.
