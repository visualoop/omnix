import 'server-only'
import { eq, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, platformSettings } from '@/db'

/**
 * Read + write platform settings stored in the DB.
 *
 * SENSITIVE values are encrypted at rest with AES-256-GCM. The master
 * key is derived from PLATFORM_SETTINGS_MASTER (env). Without it, sensitive
 * settings can't be decrypted — make sure it's set in Vercel before
 * setting any keys.
 *
 * Cached in-process for 60s to avoid hammering the DB on hot paths
 * (Paystack init reads paystack.secret_key on every call).
 */

interface CacheEntry {
  value: string | null
  expiresAt: number
}
const TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

/** Set of keys we expose to the admin dashboard with their default config. */
export const SETTING_DEFINITIONS = [
  // ── Paystack ────────────────────────────────────
  { key: 'paystack.public_key',     category: 'paystack',  label: 'Paystack public key',     sensitive: false, envFallback: 'PAYSTACK_PUBLIC_KEY',     description: 'Used by the in-page Paystack popup.' },
  { key: 'paystack.secret_key',     category: 'paystack',  label: 'Paystack secret key',     sensitive: true,  envFallback: 'PAYSTACK_SECRET_KEY',     description: 'Used server-side to initialise + verify charges. Rotate after every staff departure.' },
  { key: 'paystack.webhook_secret', category: 'paystack',  label: 'Paystack webhook secret', sensitive: true,  envFallback: 'PAYSTACK_WEBHOOK_SECRET', description: 'HMAC-SHA512 signature key. Configured in Paystack dashboard → Settings → Webhooks.' },

  // ── Email (Resend) ─────────────────────────────
  { key: 'resend.api_key',          category: 'email',     label: 'Resend API key',          sensitive: true,  envFallback: 'RESEND_API_KEY',          description: 'Sends magic links, invitations, receipts, support replies.' },
  { key: 'resend.from_email',       category: 'email',     label: 'From address',            sensitive: false, envFallback: 'RESEND_FROM',             description: 'e.g. "Omnix <noreply@omnix.co.ke>".' },
  { key: 'resend.reply_to',         category: 'email',     label: 'Reply-to address',        sensitive: false, envFallback: 'RESEND_REPLY_TO',         description: 'Where customers reach you when they reply to a transactional mail.' },

  // ── Google OAuth ───────────────────────────────
  { key: 'google.client_id',        category: 'oauth',     label: 'Google OAuth client ID',     sensitive: false, envFallback: 'GOOGLE_CLIENT_ID',     description: 'From console.cloud.google.com → APIs & Services → Credentials.' },
  { key: 'google.client_secret',    category: 'oauth',     label: 'Google OAuth client secret', sensitive: true,  envFallback: 'GOOGLE_CLIENT_SECRET', description: 'Pair with the client ID above. Restart deploys ignored — read at runtime.' },

  // ── Cloud backup / S3 ─────────────────────────
  { key: 's3.endpoint',             category: 'storage',   label: 'S3 endpoint',                sensitive: false, envFallback: 'S3_ENDPOINT',          description: 'e.g. "https://<accountid>.r2.cloudflarestorage.com" for Cloudflare R2.' },
  { key: 's3.region',               category: 'storage',   label: 'S3 region',                  sensitive: false, envFallback: 'S3_REGION',            description: 'Usually "auto" for R2.' },
  { key: 's3.bucket',               category: 'storage',   label: 'S3 bucket',                  sensitive: false, envFallback: 'S3_BUCKET',            description: 'Bucket where encrypted backups land.' },
  { key: 's3.access_key_id',        category: 'storage',   label: 'S3 access key ID',           sensitive: true,  envFallback: 'S3_ACCESS_KEY_ID',     description: '' },
  { key: 's3.secret_access_key',    category: 'storage',   label: 'S3 secret access key',       sensitive: true,  envFallback: 'S3_SECRET_ACCESS_KEY', description: '' },

  // ── Cron / system ──────────────────────────────
  { key: 'cron.secret',             category: 'system',    label: 'Cron Bearer secret',         sensitive: true,  envFallback: 'CRON_SECRET',          description: 'Vercel cron jobs send Authorization: Bearer <this>.' },

  // ── Feature flags ──────────────────────────────
  { key: 'flags.cloud_backup',      category: 'feature_flags', label: 'Cloud backup enabled',  sensitive: false, envFallback: 'CLOUD_BACKUP_ENABLED', description: 'Set to "true" / "false". Off → /buy?type=cloud_backup is hidden.' },
  { key: 'flags.signup_open',       category: 'feature_flags', label: 'New sign-ups allowed',  sensitive: false, envFallback: undefined,              description: '"true" → /login lets new emails sign up via magic link. "false" → only existing users can sign in.' },

  // ── Analytics ──────────────────────────────────
  { key: 'analytics.ga_id',         category: 'analytics', label: 'Google Analytics ID',         sensitive: false, envFallback: 'NEXT_PUBLIC_GA_ID',    description: 'GA4 measurement ID, e.g. "G-XXXXXXXX".' },
] as const

export type SettingKey = (typeof SETTING_DEFINITIONS)[number]['key']

function masterKey(): Buffer {
  const raw = process.env.PLATFORM_SETTINGS_MASTER
  if (!raw) {
    throw new Error('PLATFORM_SETTINGS_MASTER env var must be set (32+ char base64 or hex)')
  }
  // Derive a 32-byte key from whatever was supplied.
  return crypto.createHash('sha256').update(raw).digest()
}

function encrypt(plain: string): string {
  const key = masterKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: base64(iv || tag || ciphertext)
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(b64: string): string {
  const key = masterKey()
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/**
 * Read a setting. Cache hit → DB lookup → env fallback.
 * Returns undefined if neither is set.
 */
export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value ?? undefined
  }

  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (!def) return undefined

  let value: string | null = null
  try {
    const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1)
    const raw = rows[0]?.value ?? null
    if (raw) {
      value = def.sensitive ? decrypt(raw) : raw
    }
  } catch {
    // table missing on cold boot or master key bad — fall through to env
  }

  if (!value && def.envFallback) {
    value = process.env[def.envFallback] ?? null
  }

  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
  return value ?? undefined
}

/** Set a setting (encrypts if sensitive). */
export async function setSetting(key: SettingKey, value: string, actorId: string): Promise<void> {
  const def = SETTING_DEFINITIONS.find((d) => d.key === key)
  if (!def) throw new Error(`unknown setting: ${key}`)
  const stored = def.sensitive ? encrypt(value) : value
  await db
    .insert(platformSettings)
    .values({
      key,
      category: def.category,
      label: def.label,
      description: def.description ?? null,
      sensitive: def.sensitive,
      value: stored,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: stored, updatedAt: new Date(), updatedBy: actorId, label: def.label },
    })
  cache.delete(key)
}

/** List every setting with its current value (sensitive masked). */
export async function listSettings(): Promise<Array<{
  key: string
  category: string
  label: string
  description: string | null
  sensitive: boolean
  hasValue: boolean
  source: 'db' | 'env' | 'unset'
  preview: string | null
  updatedAt: Date | null
  updatedBy: string | null
}>> {
  const rows = await db.select().from(platformSettings)
  const dbMap = new Map(rows.map((r) => [r.key, r]))
  return SETTING_DEFINITIONS.map((def) => {
    const row = dbMap.get(def.key)
    const envValue = def.envFallback ? process.env[def.envFallback] : undefined

    let source: 'db' | 'env' | 'unset' = 'unset'
    let preview: string | null = null
    if (row?.value) {
      source = 'db'
      preview = def.sensitive ? maskValue(safeDecrypt(row.value)) : (row.value.length > 60 ? row.value.slice(0, 57) + '…' : row.value)
    } else if (envValue) {
      source = 'env'
      preview = def.sensitive ? maskValue(envValue) : (envValue.length > 60 ? envValue.slice(0, 57) + '…' : envValue)
    }

    return {
      key: def.key,
      category: def.category,
      label: def.label,
      description: def.description ?? null,
      sensitive: def.sensitive,
      hasValue: source !== 'unset',
      source,
      preview,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  })
}

function safeDecrypt(b64: string): string {
  try { return decrypt(b64) } catch { return '••• decryption failed' }
}

function maskValue(plain: string): string {
  if (plain.length <= 8) return '•'.repeat(plain.length)
  return plain.slice(0, 4) + '••••' + plain.slice(-4)
}

/** Force-clear the cache so the next read hits the DB fresh. */
export function invalidateSettingsCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}

/** Surface the count of unset critical settings on the admin overview. */
export async function countUnsetCritical(): Promise<number> {
  const list = await listSettings()
  const critical = ['paystack.secret_key', 'resend.api_key', 'google.client_secret']
  return list.filter((s) => critical.includes(s.key) && !s.hasValue).length
}

// Helper-aliases so callsites read more naturally.
export async function paystackKeys() {
  const [pub, sec, hook] = await Promise.all([
    getSetting('paystack.public_key'),
    getSetting('paystack.secret_key'),
    getSetting('paystack.webhook_secret'),
  ])
  return { public: pub, secret: sec, webhook: hook }
}

export async function resendConfig() {
  const [key, from, replyTo] = await Promise.all([
    getSetting('resend.api_key'),
    getSetting('resend.from_email'),
    getSetting('resend.reply_to'),
  ])
  return { apiKey: key, from, replyTo }
}

export async function googleOAuthConfig() {
  const [id, sec] = await Promise.all([
    getSetting('google.client_id'),
    getSetting('google.client_secret'),
  ])
  return { clientId: id, clientSecret: sec }
}
