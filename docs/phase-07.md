# Phase 7 — Licensing & Security

## Goals
- Machine fingerprinting
- Offline license validation
- Database encryption
- Tamper detection
- Per-device licensing (single tier)

## Licensing Model

**Single tier — per-device:**
- 1 license = 1 device (the primary/server node)
- Additional LAN devices = additional device licenses
- No Standard/Pro/Enterprise split
- No expiry (perpetual license, pay once)
- Updates included for 1 year, then optional renewal

## Tasks

### 7.1 Machine Fingerprinting (Rust)
Generate unique device ID from:
- CPU ID (via `raw-cpuid` crate)
- Disk serial number
- OS installation ID
- Motherboard serial (where available)

Combined → SHA-256 hash → device fingerprint.

Stored locally, sent during activation.

### 7.2 License File Structure
```json
{
  "businessId": "SOKO-XXXX-XXXX",
  "businessType": "pharmacy",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "maxDevices": 1,
  "activatedDevices": ["device_fingerprint_hash"],
  "issuedAt": "2026-01-15T00:00:00Z",
  "updatesUntil": "2027-01-15T00:00:00Z",
  "signature": "base64_signature"
}
```

### 7.3 License Validation (Offline)
- License file signed with RSA key (public key embedded in app)
- On startup: verify signature → check device fingerprint matches → allow
- Tampered file → invalid signature → system blocks
- No internet required for validation

### 7.4 Activation Flow
1. First install → generates fingerprint
2. User enters license key (purchased from marketing site)
3. App calls activation server (one-time, requires internet)
4. Server validates key, records device fingerprint, returns signed license file
5. License file stored locally
6. All future validations are offline

### 7.5 Database Encryption
- SQLite database encrypted with SQLCipher
- Encryption key derived from license + device fingerprint
- Database unreadable without valid license on correct device

### 7.6 Security Measures
- All API keys/secrets encrypted at rest (AES-256)
- Tauri CSP (Content Security Policy) locked down
- No remote code execution
- Auto-lock screen after configurable inactivity
- Audit log for sensitive operations (user changes, voids, adjustments)

### 7.7 Grace Period
- If license file missing/corrupted: 7-day grace period with warning
- After grace: read-only mode (can view data, cannot create sales)
- Never deletes data — worst case is read-only

## Done When
- Machine fingerprint generates consistently on same hardware
- License activates successfully (one-time internet)
- All subsequent startups validate offline
- Tampered license file is rejected
- Database is encrypted and unreadable externally
- Grace period works correctly
- System blocks at device limit
