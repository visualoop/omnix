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

## Windows Private Mesh release secrets

### `WINDOWS_CODE_SIGNING_CERT` / `WINDOWS_CODE_SIGNING_PASSWORD`

Required for a customer release that bundles Omnix Private Mesh. `WINDOWS_CODE_SIGNING_CERT` is
the base64-encoded PFX and `WINDOWS_CODE_SIGNING_PASSWORD` unlocks it. The verified staging job
uses the certificate to Authenticode-sign `tunnel.dll` and `omnix-mesh-service.exe`; it preserves
and verifies the official WireGuard signature on `wireguard.dll`. Release staging fails closed if
the secrets are absent or any signature is not trusted.

Pull-request artifact builds use a runner-local development certificate so checksum/build wiring
can be tested. Those artifacts are not customer releases and their helper will not pass trust
verification on a customer machine.

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
