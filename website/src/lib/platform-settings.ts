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
  // Webhooks are HMAC-SHA512 signed using the secret_key (Paystack does
  // not expose a separate "webhook secret"). One key, two purposes.
  { key: 'paystack.public_key',     category: 'paystack',  label: 'Paystack public key',     sensitive: false, envFallback: 'PAYSTACK_PUBLIC_KEY',     description: 'Used by the in-page Paystack popup.' },
  { key: 'paystack.secret_key',     category: 'paystack',  label: 'Paystack secret key',     sensitive: true,  envFallback: 'PAYSTACK_SECRET_KEY',     description: 'Server-side: initialises charges, verifies, AND signs webhooks. Rotate after every staff departure.' },

  // ── Email (Resend) ─────────────────────────────
  { key: 'resend.api_key',          category: 'email',     label: 'Resend API key',          sensitive: true,  envFallback: 'RESEND_API_KEY',          description: 'Sends magic links, invitations, receipts, support replies.' },
  { key: 'resend.from_email',       category: 'email',     label: 'From address',            sensitive: false, envFallback: 'RESEND_FROM_EMAIL',       description: 'e.g. "Omnix <noreply@omnix.co.ke>".' },
  { key: 'resend.reply_to',         category: 'email',     label: 'Reply-to address',        sensitive: false, envFallback: 'RESEND_REPLY_TO',         description: 'Where customers reach you when they reply to a transactional mail.' },

  // ── Email branding (visible in every email's footer) ─────
  { key: 'email.brand_tagline',     category: 'email_branding', label: 'Footer tagline',          sensitive: false, envFallback: undefined, description: 'One sentence under the brand mark in every email. Default: "Offline-first POS + business software for Kenyan SMEs".' },
  { key: 'email.support_email',     category: 'email_branding', label: 'Support email',           sensitive: false, envFallback: undefined, description: 'Shown in every email footer + used as Reply-To if "resend.reply_to" is empty.' },
  { key: 'email.support_whatsapp',  category: 'email_branding', label: 'Support WhatsApp',        sensitive: false, envFallback: undefined, description: 'Optional. International format e.g. "+254 712 345 678". Shown as a footer link.' },
  { key: 'email.business_address',  category: 'email_branding', label: 'Business address',        sensitive: false, envFallback: undefined, description: 'Optional postal/legal address shown in the email footer for compliance.' },
  { key: 'email.legal_name',        category: 'email_branding', label: 'Legal entity name',       sensitive: false, envFallback: undefined, description: 'e.g. "Blyss Studio Limited". Shown on receipts + the legal-fine-print line.' },
  { key: 'email.copyright_line',    category: 'email_branding', label: 'Copyright line',          sensitive: false, envFallback: undefined, description: 'Optional override. Default: "© {year} Omnix. Built in Nairobi."' },
  { key: 'email.unsubscribe_text',  category: 'email_branding', label: 'Unsubscribe text',        sensitive: false, envFallback: undefined, description: 'Default: "You\'re receiving this because you have an active Omnix account."' },

  // ── Site (public website footer + contact details) ───────
  { key: 'site.tagline',            category: 'site',           label: 'Site tagline',           sensitive: false, envFallback: undefined, description: 'Shown under the wordmark in the marketing footer. Default: "Offline-first POS + business software for Kenyan SMEs".' },
  { key: 'site.support_email',      category: 'site',           label: 'Support email',          sensitive: false, envFallback: 'NEXT_PUBLIC_SUPPORT_EMAIL', description: 'Footer link + structured-data contact point.' },
  { key: 'site.sales_email',        category: 'site',           label: 'Sales email',            sensitive: false, envFallback: undefined, description: 'For Custom-tier enquiries. Default falls back to support_email.' },
  { key: 'site.phone_kenya',        category: 'site',           label: 'Kenya phone',            sensitive: false, envFallback: undefined, description: 'International format, e.g. "+254 712 345 678". Shown on the /ke contact page.' },
  { key: 'site.phone_intl',         category: 'site',           label: 'International phone',    sensitive: false, envFallback: undefined, description: 'Optional. Shown on non-Kenya locale contact pages.' },
  { key: 'site.whatsapp',           category: 'site',           label: 'WhatsApp number',        sensitive: false, envFallback: 'NEXT_PUBLIC_WHATSAPP_NUMBER', description: 'Digits only or international format. Powers the floating chat link + footer.' },
  { key: 'site.address_kenya',      category: 'site',           label: 'Kenya physical address', sensitive: false, envFallback: undefined, description: 'Physical office address (Kenya).' },
  { key: 'site.address_intl',       category: 'site',           label: 'International address',  sensitive: false, envFallback: undefined, description: 'Optional second address shown on /us / /gb / /in contact pages.' },
  { key: 'site.twitter_url',        category: 'site',           label: 'X (Twitter) URL',        sensitive: false, envFallback: undefined, description: 'Full https URL. Hidden if empty.' },
  { key: 'site.linkedin_url',       category: 'site',           label: 'LinkedIn URL',           sensitive: false, envFallback: undefined, description: 'Full https URL.' },
  { key: 'site.facebook_url',       category: 'site',           label: 'Facebook URL',           sensitive: false, envFallback: undefined, description: 'Full https URL.' },
  { key: 'site.youtube_url',        category: 'site',           label: 'YouTube URL',            sensitive: false, envFallback: undefined, description: 'Full https URL.' },
  { key: 'site.instagram_url',      category: 'site',           label: 'Instagram URL',          sensitive: false, envFallback: undefined, description: 'Full https URL.' },
  { key: 'site.github_url',         category: 'site',           label: 'GitHub URL',             sensitive: false, envFallback: undefined, description: 'Full https URL.' },
  { key: 'site.legal_name',         category: 'site',           label: 'Legal entity name',      sensitive: false, envFallback: undefined, description: 'Used on Organization JSON-LD + footer copyright.' },
  { key: 'site.kra_pin',            category: 'site',           label: 'KRA PIN',                sensitive: false, envFallback: undefined, description: 'Kenya tax-compliance footer line. Optional.' },

  // ── Google OAuth ───────────────────────────────
  { key: 'google.client_id',        category: 'oauth',     label: 'Google OAuth client ID',     sensitive: false, envFallback: 'GOOGLE_CLIENT_ID',     description: 'From console.cloud.google.com → APIs & Services → Credentials.' },
  { key: 'google.client_secret',    category: 'oauth',     label: 'Google OAuth client secret', sensitive: true,  envFallback: 'GOOGLE_CLIENT_SECRET', description: 'Pair with the client ID above. Restart deploys ignored — read at runtime.' },

  // ── Cloud backup / S3 ─────────────────────────
  { key: 's3.endpoint',             category: 'storage',   label: 'S3 endpoint',                sensitive: false, envFallback: 'S3_ENDPOINT',          description: 'e.g. "https://<accountid>.r2.cloudflarestorage.com" for Cloudflare R2.' },
  { key: 's3.region',               category: 'storage',   label: 'S3 region',                  sensitive: false, envFallback: 'S3_REGION',            description: 'Usually "auto" for R2.' },
  { key: 's3.bucket',               category: 'storage',   label: 'S3 bucket',                  sensitive: false, envFallback: 'S3_BUCKET',            description: 'Bucket where encrypted backups land.' },
  { key: 's3.access_key_id',        category: 'storage',   label: 'S3 access key ID',           sensitive: true,  envFallback: 'S3_ACCESS_KEY_ID',     description: '' },
  { key: 's3.secret_access_key',    category: 'storage',   label: 'S3 secret access key',       sensitive: true,  envFallback: 'S3_SECRET_ACCESS_KEY', description: '' },
  { key: 's3.media_bucket',         category: 'storage',   label: 'Media bucket name',          sensitive: false, envFallback: 'S3_BUCKET',            description: 'Bucket for marketing images (separate from encrypted backups, public-read).' },
  { key: 's3.public_url',           category: 'storage',   label: 'Media public base URL',      sensitive: false, envFallback: 'S3_PUBLIC_URL',        description: 'CDN URL prefix for served images, e.g. "https://media.omnix.co.ke" or the R2 pub-XXX domain.' },

  // ── Cron / system ──────────────────────────────
  { key: 'cron.secret',             category: 'system',    label: 'Cron Bearer secret',         sensitive: true,  envFallback: 'CRON_SECRET',          description: 'Vercel cron jobs send Authorization: Bearer <this>.' },

  // ── Feature flags ──────────────────────────────
  { key: 'flags.cloud_backup',      category: 'feature_flags', label: 'Cloud backup enabled',  sensitive: false, envFallback: 'CLOUD_BACKUP_ENABLED', description: 'Set to "true" / "false". Off → /buy?type=cloud_backup is hidden.' },
  { key: 'flags.signup_open',       category: 'feature_flags', label: 'New sign-ups allowed',  sensitive: false, envFallback: undefined,              description: '"true" → /login lets new emails sign up via magic link. "false" → only existing users can sign in.' },

  // ── Analytics ──────────────────────────────────
  { key: 'analytics.ga_id',         category: 'analytics', label: 'Google Analytics ID',         sensitive: false, envFallback: 'NEXT_PUBLIC_GA_ID',    description: 'GA4 measurement ID, e.g. "G-XXXXXXXX".' },

  // ── Landing page — hero copy (leave blank to use built-in fallback) ─
  { key: 'landing.hero.eyebrow',        category: 'landing_hero', label: 'Hero eyebrow',           sensitive: false, envFallback: undefined, description: 'The pill above the headline. Empty = "One platform · offline-first · pay once, own forever". Overridden by latest-release note when a release exists.' },
  { key: 'landing.hero.headline',       category: 'landing_hero', label: 'Hero headline',          sensitive: false, envFallback: undefined, description: 'Main homepage headline. Empty = shipped default. Keep it under 65 chars for the landing look.' },
  { key: 'landing.hero.subheadline',    category: 'landing_hero', label: 'Hero subheadline',       sensitive: false, envFallback: undefined, description: 'The paragraph under the headline. Empty = per-locale default (Kenya vs global copy).' },
  { key: 'landing.hero.cta_label',      category: 'landing_hero', label: 'Primary CTA label',      sensitive: false, envFallback: undefined, description: 'The big button below the subheadline. Empty = "Start free trial".' },
  { key: 'landing.hero.cta_href',       category: 'landing_hero', label: 'Primary CTA link',       sensitive: false, envFallback: undefined, description: 'Where the CTA points. Empty = "/signup". Use an absolute URL for external.' },
  { key: 'landing.hero.video_url',      category: 'landing_hero', label: 'Hero video URL',         sensitive: false, envFallback: undefined, description: 'Direct URL to a short (10-25s) muted loop showing the product in motion. mp4/webm. Leave empty to render the current PosPreview illustration.' },
  { key: 'landing.hero.video_poster',   category: 'landing_hero', label: 'Hero video poster',      sensitive: false, envFallback: undefined, description: 'URL to a still frame shown before the video loads (and on mobile until tap-to-play). Highly recommended if video_url is set.' },

  // ── Landing page — per-variant video (module pages: /dawa, /retail, /hospitality, /hardware) ─
  { key: 'landing.dawa.video_url',        category: 'landing_variant_video', label: 'Dawa video URL',           sensitive: false, envFallback: undefined, description: 'Short muted loop for the Dawa (pharmacy) landing page hero.' },
  { key: 'landing.dawa.video_poster',     category: 'landing_variant_video', label: 'Dawa video poster',        sensitive: false, envFallback: undefined, description: 'Still frame for the Dawa hero video.' },
  { key: 'landing.retail.video_url',      category: 'landing_variant_video', label: 'Retail video URL',         sensitive: false, envFallback: undefined, description: 'Short muted loop for the Retail landing page hero.' },
  { key: 'landing.retail.video_poster',   category: 'landing_variant_video', label: 'Retail video poster',      sensitive: false, envFallback: undefined, description: 'Still frame for the Retail hero video.' },
  { key: 'landing.hospitality.video_url', category: 'landing_variant_video', label: 'Hospitality video URL',    sensitive: false, envFallback: undefined, description: 'Short muted loop for the Hospitality landing page hero.' },
  { key: 'landing.hospitality.video_poster', category: 'landing_variant_video', label: 'Hospitality video poster', sensitive: false, envFallback: undefined, description: 'Still frame for the Hospitality hero video.' },
  { key: 'landing.hardware.video_url',    category: 'landing_variant_video', label: 'Hardware video URL',       sensitive: false, envFallback: undefined, description: 'Short muted loop for the Hardware Store landing page hero.' },
  { key: 'landing.hardware.video_poster', category: 'landing_variant_video', label: 'Hardware video poster',    sensitive: false, envFallback: undefined, description: 'Still frame for the Hardware Store hero video.' },
  { key: 'landing.salon.video_url',       category: 'landing_variant_video', label: 'Salon video URL',          sensitive: false, envFallback: undefined, description: 'Short muted loop for the Salon & Spa landing page hero.' },
  { key: 'landing.salon.video_poster',    category: 'landing_variant_video', label: 'Salon video poster',       sensitive: false, envFallback: undefined, description: 'Still frame for the Salon & Spa hero video.' },

  // ── Landing page — one-price section ─
  { key: 'landing.one_price.eyebrow',           category: 'landing_one_price', label: 'One-price eyebrow',           sensitive: false, envFallback: undefined, description: 'Small caps label above the price. Empty = "Pricing".' },
  { key: 'landing.one_price.commitment_lead',   category: 'landing_one_price', label: 'Commitment (lead)',           sensitive: false, envFallback: undefined, description: 'Muted italic that leads. Empty = "Once."' },
  { key: 'landing.one_price.commitment_accent', category: 'landing_one_price', label: 'Commitment (accent)',         sensitive: false, envFallback: undefined, description: 'The stronger phrase that follows. Empty = "For the whole product."' },

  // ── Landing page — founder note ─
  { key: 'landing.founder.eyebrow',    category: 'landing_founder', label: 'Founder note eyebrow',   sensitive: false, envFallback: undefined, description: 'Empty = "A note from the studio".' },
  { key: 'landing.founder.body',       category: 'landing_founder', label: 'Founder note body',      sensitive: false, envFallback: undefined, description: 'Multi-paragraph. Separate paragraphs with a blank line. Empty = shipped 3-paragraph default.' },
  { key: 'landing.founder.signature',  category: 'landing_founder', label: 'Signature line',         sensitive: false, envFallback: undefined, description: 'Empty = "— Justin". Include the em dash if you want it.' },
  { key: 'landing.founder.tagline',    category: 'landing_founder', label: 'Signature tagline',      sensitive: false, envFallback: undefined, description: 'Small caps mono under the signature. Empty = "Founder · Nairobi".' },

  // ── Landing page — closing CTA ─
  { key: 'landing.closing.headline',        category: 'landing_closing', label: 'Closing CTA headline',        sensitive: false, envFallback: undefined, description: 'The italic display line. The final accent word is a separate field.' },
  { key: 'landing.closing.headline_accent', category: 'landing_closing', label: 'Closing CTA accent word',     sensitive: false, envFallback: undefined, description: 'The final coloured word/phrase in the headline. Empty = "properly."' },
  { key: 'landing.closing.cta_label',       category: 'landing_closing', label: 'Closing CTA button label',    sensitive: false, envFallback: undefined, description: 'Empty = "Start free trial".' },
  { key: 'landing.closing.whatsapp_prompt', category: 'landing_closing', label: 'WhatsApp link text',          sensitive: false, envFallback: undefined, description: 'Empty = "or talk to us on WhatsApp".' },
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
  const [pub, sec] = await Promise.all([
    getSetting('paystack.public_key'),
    getSetting('paystack.secret_key'),
  ])
  // The secret_key is also the HMAC-SHA512 webhook signer; Paystack does
  // not expose a separate "webhook secret" setting in its dashboard.
  return { public: pub, secret: sec, webhook: sec }
}

export async function resendConfig() {
  const [key, from, replyTo] = await Promise.all([
    getSetting('resend.api_key'),
    getSetting('resend.from_email'),
    getSetting('resend.reply_to'),
  ])
  return { apiKey: key, from, replyTo }
}

/** Branding values rendered into every email footer. Hot-reloads via the 60s cache. */
export async function emailBranding(): Promise<{
  tagline: string
  supportEmail: string
  supportWhatsapp: string | null
  businessAddress: string | null
  legalName: string
  copyright: string
  unsubscribe: string
  brandUrl: string
}> {
  const [tagline, supportEmail, whatsapp, address, legal, copyrightOverride, unsubscribe] = await Promise.all([
    getSetting('email.brand_tagline'),
    getSetting('email.support_email'),
    getSetting('email.support_whatsapp'),
    getSetting('email.business_address'),
    getSetting('email.legal_name'),
    getSetting('email.copyright_line'),
    getSetting('email.unsubscribe_text'),
  ])
  const year = new Date().getFullYear()
  return {
    tagline: tagline ?? 'Offline-first POS + business software for Kenyan SMEs.',
    supportEmail: supportEmail ?? 'support@omnix.co.ke',
    supportWhatsapp: whatsapp ?? null,
    businessAddress: address ?? null,
    legalName: legal ?? 'Omnix',
    copyright: copyrightOverride ?? `© ${year} Omnix. Built in Nairobi.`,
    unsubscribe: unsubscribe ?? "You're receiving this because you have an active Omnix account.",
    brandUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'https://omnix.co.ke',
  }
}

/**
 * Public site-wide branding read by the marketing site (footer, contact
 * page, structured-data Organization schema). All admin-editable from
 * /admin/settings → Site category.
 */
export async function siteBranding(): Promise<{
  tagline: string
  supportEmail: string
  salesEmail: string
  phoneKenya: string | null
  phoneIntl: string | null
  whatsapp: string | null
  whatsappUrl: string | null
  addressKenya: string | null
  addressIntl: string | null
  social: { twitter: string | null; linkedin: string | null; facebook: string | null; youtube: string | null; instagram: string | null; github: string | null }
  legalName: string
  kraPin: string | null
  brandUrl: string
}> {
  const [
    tagline, supportEmail, salesEmail, phoneKE, phoneIntl, whatsapp,
    addressKE, addressIntl,
    twitter, linkedin, facebook, youtube, instagram, github,
    legalName, kraPin,
  ] = await Promise.all([
    getSetting('site.tagline'),
    getSetting('site.support_email'),
    getSetting('site.sales_email'),
    getSetting('site.phone_kenya'),
    getSetting('site.phone_intl'),
    getSetting('site.whatsapp'),
    getSetting('site.address_kenya'),
    getSetting('site.address_intl'),
    getSetting('site.twitter_url'),
    getSetting('site.linkedin_url'),
    getSetting('site.facebook_url'),
    getSetting('site.youtube_url'),
    getSetting('site.instagram_url'),
    getSetting('site.github_url'),
    getSetting('site.legal_name'),
    getSetting('site.kra_pin'),
  ])
  const supportE = supportEmail ?? 'support@omnix.co.ke'
  const wa = whatsapp ?? null
  const waDigits = wa ? wa.replace(/\D/g, '') : null
  return {
    tagline: tagline ?? 'Offline-first POS + business software for Kenyan SMEs',
    supportEmail: supportE,
    salesEmail: salesEmail ?? supportE,
    phoneKenya: phoneKE ?? null,
    phoneIntl: phoneIntl ?? null,
    whatsapp: wa,
    whatsappUrl: waDigits ? `https://wa.me/${waDigits}` : null,
    addressKenya: addressKE ?? null,
    addressIntl: addressIntl ?? null,
    social: {
      twitter: twitter ?? null,
      linkedin: linkedin ?? null,
      facebook: facebook ?? null,
      youtube: youtube ?? null,
      instagram: instagram ?? null,
      github: github ?? null,
    },
    legalName: legalName ?? 'Omnix',
    kraPin: kraPin ?? null,
    brandUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke',
  }
}

export async function googleOAuthConfig() {
  const [id, sec] = await Promise.all([
    getSetting('google.client_id'),
    getSetting('google.client_secret'),
  ])
  return { clientId: id, clientSecret: sec }
}
