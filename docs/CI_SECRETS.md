# CI Secrets

This document lists the GitHub Actions secrets required for the build and release pipelines.

Set these in: **Repo Settings → Secrets and variables → Actions → New repository secret**

## Required Secrets

### `TAURI_SIGNING_PRIVATE_KEY`

The Tauri updater signing key (minisign format) used to sign update artifacts so the in-app updater
can verify them.

**How to obtain:**
- The keypair was generated locally during development at `keys/updater.key` (private) and
  `keys/updater.key.pub` (public).
- The **public** key is already embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
- The **private** key (`keys/updater.key`) is `.gitignored` and must be uploaded as this secret.

**How to set:**
```bash
# On your local dev machine:
cat keys/updater.key
```
Copy the entire contents (including the `untrusted comment` lines) and paste into the secret value.

> ⚠️ If this key is lost, you cannot publish updates that existing installs will accept.
> Keep an offline backup.

### `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The password for the updater key.

If the keypair was generated **without** a password (the default for Omnix dev), set this secret
to an **empty string** (just leave the value blank when creating it).

If you regenerate with a password, update this secret to match.

## Optional Secrets (future)

### `WINDOWS_CODE_SIGNING_CERT` / `WINDOWS_CODE_SIGNING_PASSWORD`

Not currently used. When Omnix gets an EV code-signing certificate (recommended once you start
selling, ~$300-500/year) these will sign the `.msi` and `.exe` so Windows SmartScreen doesn't
warn users. Update `build.yml` and `release.yml` to use `signtool` or the `windows-codesigning`
GitHub action.

---

## Verifying secrets are set

After adding the secrets, push a commit (or trigger the workflow manually) and check the build.
The "Build & sign Tauri app" step will fail loudly if `TAURI_SIGNING_PRIVATE_KEY` is missing or
malformed.

## Local testing

To run the same build locally on a Windows machine:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content keys/updater.key -Raw)
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
pnpm exec tauri build --bundles msi,nsis
```

On macOS/Linux (cross-build won't produce Windows binaries, but the command form is):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat keys/updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm exec tauri build --bundles msi,nsis
```
