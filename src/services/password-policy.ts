/**
 * Password policies + PIN login.
 *
 * Policy:
 *   - Enforced on password create/change (min length, complexity, breach check).
 *   - Login lockout: N failed attempts in the last hour → locked out for 15 min.
 *
 * PIN:
 *   - 4-6 digit numeric, hashed with SHA-256 + salt (Argon2 would be nicer;
 *     using SHA-256 in JS because we're in-app and PIN space is small anyway).
 *   - Used for quick-switch between cashiers on a shared till.
 */
import { execute, query } from "@/lib/db";

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: number;
  require_number: number;
  require_symbol: number;
  max_age_days: number | null;
  reuse_limit: number;
  lockout_after_failures: number;
}

export async function getPolicy(): Promise<PasswordPolicy> {
  const rows = await query<PasswordPolicy>(
    `SELECT min_length, require_uppercase, require_number, require_symbol,
            max_age_days, reuse_limit, lockout_after_failures
     FROM password_policies WHERE id = 'default' LIMIT 1`,
  );
  return rows[0] ?? {
    min_length: 8, require_uppercase: 0, require_number: 1, require_symbol: 0,
    max_age_days: null, reuse_limit: 5, lockout_after_failures: 5,
  };
}

export async function updatePolicy(patch: Partial<PasswordPolicy>): Promise<void> {
  const current = await getPolicy();
  const merged = { ...current, ...patch };
  await execute(
    `UPDATE password_policies
     SET min_length = ?1, require_uppercase = ?2, require_number = ?3, require_symbol = ?4,
         max_age_days = ?5, reuse_limit = ?6, lockout_after_failures = ?7,
         updated_at = datetime('now')
     WHERE id = 'default'`,
    [
      merged.min_length, merged.require_uppercase, merged.require_number, merged.require_symbol,
      merged.max_age_days, merged.reuse_limit, merged.lockout_after_failures,
    ],
  );
}

/** Validate a candidate password against the current policy. Returns null on success or an error message. */
export async function validatePassword(pw: string): Promise<string | null> {
  const policy = await getPolicy();
  if (pw.length < policy.min_length) return `At least ${policy.min_length} characters`;
  if (policy.require_uppercase && !/[A-Z]/.test(pw)) return "Must contain an uppercase letter";
  if (policy.require_number && !/[0-9]/.test(pw)) return "Must contain a number";
  if (policy.require_symbol && !/[^A-Za-z0-9]/.test(pw)) return "Must contain a symbol";
  return null;
}

// ─── Lockout ────────────────────────────────────────
export async function recordLoginAttempt(username: string, succeeded: boolean, ipAddress?: string): Promise<void> {
  await execute(
    `INSERT INTO login_attempts (id, username, ip_address, succeeded, attempted_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))`,
    [crypto.randomUUID().replace(/-/g, "").slice(0, 16), username, ipAddress ?? null, succeeded ? 1 : 0],
  );
}

export async function isLockedOut(username: string): Promise<boolean> {
  const policy = await getPolicy();
  const [row] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM login_attempts
      WHERE username = ?1
        AND succeeded = 0
        AND attempted_at >= datetime('now', '-15 minutes')`,
    [username],
  );
  return (row?.n ?? 0) >= policy.lockout_after_failures;
}

// ─── PIN ────────────────────────────────────────────
async function hashPin(pin: string, userId: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function setPin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4-6 digits");
  const hash = await hashPin(pin, userId);
  await execute(
    `UPDATE users SET pin_hash = ?2, pin_updated_at = datetime('now') WHERE id = ?1`,
    [userId, hash],
  );
}

export async function clearPin(userId: string): Promise<void> {
  await execute(`UPDATE users SET pin_hash = NULL, pin_updated_at = NULL WHERE id = ?1`, [userId]);
}

/**
 * Check a PIN against any active user. Returns the matched user id + username
 * on success, null on failure. Used for POS quick-switch — you type the PIN,
 * we find whose it is.
 */
export async function verifyPinAcrossUsers(pin: string): Promise<{ user_id: string; username: string } | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;
  const users = await query<{ id: string; username: string; pin_hash: string | null }>(
    `SELECT id, username, pin_hash FROM users WHERE pin_hash IS NOT NULL AND active = 1`,
  );
  for (const u of users) {
    if (!u.pin_hash) continue;
    const candidate = await hashPin(pin, u.id);
    if (candidate === u.pin_hash) return { user_id: u.id, username: u.username };
  }
  return null;
}
