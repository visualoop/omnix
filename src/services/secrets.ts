/**
 * Application-level secret encryption for sensitive strings persisted to
 * the local SQLite database.
 *
 * The underlying SQLite file relies on OS-level user account controls for
 * protection. This helper adds an additional obfuscation layer so a raw
 * DB export (backup, forensic dump, misplaced USB stick) does not leak
 * insurance API keys, M-Pesa Daraja secrets, and similar tokens in
 * grep-able plaintext.
 *
 * The scheme is intentionally simple:
 *   1. Derive a 32-byte key from the machine license fingerprint + a
 *      static app salt via SHA-256.
 *   2. XOR the plaintext bytes with a repeating key.
 *   3. Prepend an 8-byte random nonce mixed into the key to prevent two
 *      identical secrets from hashing to the same ciphertext.
 *   4. Base64-encode with a `omx1:` prefix so `decrypt` can detect
 *      legacy plaintext rows and pass them through unchanged.
 *
 * This is not TLS-grade cryptography. It's obfuscation. A determined
 * attacker with access to the machine can still recover the secrets by
 * inspecting the running app. But an accidentally-committed DB backup
 * or a stolen laptop's cold-boot flash dump no longer surrenders API
 * keys to a curl-and-grep pipeline.
 */

const APP_SALT = "omnix-secret-2026-06-30";
const PREFIX = "omx1:";

async function deriveKey(): Promise<Uint8Array> {
  // The machine fingerprint is written by the licensing subsystem to
  // localStorage. Falls back to a UA-derived string on first run.
  const fingerprint = (typeof window !== "undefined"
    ? window.localStorage?.getItem("omnix.machine_id") ?? navigator.userAgent
    : "server") ?? "server";
  const material = new TextEncoder().encode(fingerprint + APP_SALT);
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Non-browser context (SSR / tests). Return the material padded/truncated.
    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) key[i] = material[i % material.length] ?? 0;
    return key;
  }
  const buf = await crypto.subtle.digest("SHA-256", material);
  return new Uint8Array(buf);
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return typeof btoa !== "undefined"
    ? btoa(bin)
    : Buffer.from(bytes).toString("base64");
}

function fromB64(s: string): Uint8Array {
  const bin = typeof atob !== "undefined"
    ? atob(s)
    : Buffer.from(s, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;
  const key = await deriveKey();
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const pt = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(pt.length);
  for (let i = 0; i < pt.length; i++) {
    ct[i] = pt[i] ^ key[i % 32] ^ nonce[i % 8];
  }
  // [8 bytes nonce] || [ciphertext]
  const packed = new Uint8Array(8 + ct.length);
  packed.set(nonce, 0);
  packed.set(ct, 8);
  return PREFIX + toB64(packed);
}

export async function decryptSecret(stored: string | null | undefined): Promise<string | null> {
  if (stored === null || stored === undefined || stored === "") return null;
  // Legacy plaintext row — no prefix means the row was written before this
  // helper existed. Pass through unchanged so nothing breaks; the next
  // save through the normal service path will re-encrypt.
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const packed = fromB64(stored.slice(PREFIX.length));
    if (packed.length < 8) return null;
    const nonce = packed.slice(0, 8);
    const ct = packed.slice(8);
    const key = await deriveKey();
    const pt = new Uint8Array(ct.length);
    for (let i = 0; i < ct.length; i++) {
      pt[i] = ct[i] ^ key[i % 32] ^ nonce[i % 8];
    }
    return new TextDecoder().decode(pt);
  } catch {
    // Corrupted row — treat as null rather than throwing so a broken
    // secret doesn't crash the settings screen.
    return null;
  }
}

/** Returns true if a stored value is in the encrypted format. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}
