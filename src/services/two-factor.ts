/**
 * Two-Factor Authentication (TOTP) — owner accounts only.
 *
 * Uses RFC 6238 TOTP (compatible with Google Authenticator, Microsoft
 * Authenticator, Authy, etc.). The secret is stored locally on the device
 * — when 2FA is enabled, login requires both password AND a 6-digit code.
 *
 * STUB: this module provides the secret generation, QR code text, and
 * verification logic. Wire it into the login flow when ready by checking
 * `is2FAEnabled(userId)` in services/auth.ts and prompting for code.
 */

const STORAGE_KEY = (userId: string) => `sokoos-2fa-${userId}`;

export interface TwoFASetup {
  secret: string;       // base32-encoded shared secret
  uri: string;          // otpauth:// URI for QR code generation
  user_id: string;
  enabled: boolean;
  backup_codes: string[];
  enrolled_at: string;
}

// ─── Base32 (RFC 4648) ──────────────────────────────────────────────
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

function base32Decode(s: string): Uint8Array {
  const cleaned = s.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// ─── HMAC-SHA1 (Web Crypto) ─────────────────────────────────────────
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

// ─── TOTP ───────────────────────────────────────────────────────────
async function totpAt(secret: string, timestamp: number, period = 30, digits = 6): Promise<string> {
  const counter = Math.floor(timestamp / period);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter & 0xffffffff);
  const hash = await hmacSha1(base32Decode(secret), new Uint8Array(buf));
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

/** Verify a code against the secret with ±1 step tolerance for clock skew. */
export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  for (const offset of [-30, 0, 30]) {
    if ((await totpAt(secret, now + offset)) === code) return true;
  }
  return false;
}

// ─── Setup / management ─────────────────────────────────────────────
export function generateSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    codes.push(String(num >>> 0).padStart(10, "0").slice(0, 8));
  }
  return codes;
}

export function start2FAEnrollment(userId: string, username: string, issuer = "SokoOS"): TwoFASetup {
  const secret = generateSecret();
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return {
    secret,
    uri,
    user_id: userId,
    enabled: false,
    backup_codes: generateBackupCodes(),
    enrolled_at: new Date().toISOString(),
  };
}

export async function confirm2FAEnrollment(setup: TwoFASetup, verificationCode: string): Promise<boolean> {
  const valid = await verifyTotp(setup.secret, verificationCode);
  if (!valid) return false;
  const enabled = { ...setup, enabled: true };
  localStorage.setItem(STORAGE_KEY(setup.user_id), JSON.stringify(enabled));
  return true;
}

export function get2FA(userId: string): TwoFASetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function is2FAEnabled(userId: string): boolean {
  return get2FA(userId)?.enabled === true;
}

export function disable2FA(userId: string): void {
  localStorage.removeItem(STORAGE_KEY(userId));
}

export async function verify2FACode(userId: string, code: string): Promise<boolean> {
  const setup = get2FA(userId);
  if (!setup) return true; // not enrolled, allow through
  if (!setup.enabled) return true;
  // Try TOTP first, then backup codes
  if (await verifyTotp(setup.secret, code)) return true;
  if (setup.backup_codes.includes(code)) {
    // Burn the backup code
    setup.backup_codes = setup.backup_codes.filter((c) => c !== code);
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(setup));
    return true;
  }
  return false;
}
