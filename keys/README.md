# Keys

This directory holds cryptographic keys used by SokoOS.

| File | Committed? | Purpose |
|------|------------|---------|
| `license-public.pem` | ✅ Yes | Embedded in Rust binary; verifies customer license keys |
| `license-private.pem` | ❌ **NEVER** | Marketing site backend uses this to sign license keys for paying customers |
| `updater.key.pub` | ✅ Yes | Public key for verifying app updates (also embedded in `tauri.conf.json`) |
| `updater.key` | ❌ **NEVER** | Used by CI to sign update artifacts (set as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret) |

## If you regenerate any private key

You **must** re-issue every license/update that the old key signed. Existing installs will reject
artifacts signed with a new key they don't recognize.

## Backups

Keep offline backups of the private keys in a password manager or hardware security module.
Losing them means:

- **license-private.pem lost** → can't issue new licenses to new customers (existing customers fine)
- **updater.key lost** → can't ship updates that existing installs will accept (manual reinstall required)

## Generating from scratch (only do once, before first release)

```bash
# License keypair (RSA-2048)
openssl genrsa -out keys/license-private.pem 2048
openssl rsa -in keys/license-private.pem -pubout -out keys/license-public.pem

# Updater keypair (minisign)
npx @tauri-apps/cli signer generate -w keys/updater.key -p ""
```

After regenerating, update `src-tauri/tauri.conf.json` with the new updater public key contents.
