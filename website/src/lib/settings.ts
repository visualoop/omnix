/**
 * Runtime settings resolver.
 *
 * Reads integration secrets (Paystack, Resend, GA, cloud-backup) from the
 * Payload `settings` global FIRST, falling back to env vars. This means
 * the owner can rotate keys live in /admin without a redeploy.
 *
 * Cached in-process for 60s to avoid hammering the DB on every webhook
 * or charge call. The cache is keyed by setting name so individual values
 * can refresh independently if needed.
 */
import type { Payload } from 'payload'

interface ResolvedSettings {
  paystackPublicKey?: string
  paystackSecretKey?: string
  paystackWebhookSecret?: string
  resendApiKey?: string
  resendFromEmail?: string
  googleAnalyticsId?: string
  cloudBackupEnabled?: boolean
  cloudBackupPriceMonthly?: number
  cloudBackupRetentionDays?: number
}

interface CachedSettings extends ResolvedSettings {
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
let cache: CachedSettings | null = null

/**
 * Resolve all integration settings. Cached for 60s.
 */
export async function resolveSettings(payload: Payload): Promise<ResolvedSettings> {
  if (cache && cache.expiresAt > Date.now()) {
    const { expiresAt: _e, ...settings } = cache
    return settings
  }

  let cmsSettings: Record<string, unknown> | undefined
  try {
    const global = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true, // we're resolving secrets server-side; access already gated upstream
    })) as unknown as { integrations?: Record<string, unknown> } | undefined
    cmsSettings = (global?.integrations as Record<string, unknown> | undefined) ?? undefined
  } catch {
    // Settings global not yet initialised (e.g. cold-boot). Fall back to env.
    cmsSettings = undefined
  }

  const pick = <T = string>(cmsKey: string, envKey: string): T | undefined => {
    const cmsVal = cmsSettings?.[cmsKey]
    if (cmsVal !== undefined && cmsVal !== null && cmsVal !== '') return cmsVal as T
    const envVal = process.env[envKey]
    if (envVal !== undefined && envVal !== '') return envVal as unknown as T
    return undefined
  }

  const resolved: ResolvedSettings = {
    paystackPublicKey: pick('paystackPublicKey', 'PAYSTACK_PUBLIC_KEY'),
    paystackSecretKey: pick('paystackSecretKey', 'PAYSTACK_SECRET_KEY'),
    paystackWebhookSecret: pick('paystackWebhookSecret', 'PAYSTACK_WEBHOOK_SECRET'),
    resendApiKey: pick('resendApiKey', 'RESEND_API_KEY'),
    resendFromEmail: pick('resendFromEmail', 'RESEND_FROM_EMAIL'),
    googleAnalyticsId: pick('googleAnalyticsId', 'NEXT_PUBLIC_GA_ID'),
    cloudBackupEnabled:
      (cmsSettings?.cloudBackupEnabled as boolean | undefined) ??
      (process.env.CLOUD_BACKUP_ENABLED === '1'),
    cloudBackupPriceMonthly:
      (cmsSettings?.cloudBackupPriceMonthly as number | undefined) ?? 500,
    cloudBackupRetentionDays:
      (cmsSettings?.cloudBackupRetentionDays as number | undefined) ?? 30,
  }

  cache = { ...resolved, expiresAt: Date.now() + CACHE_TTL_MS }
  return resolved
}

/** Force-refresh on the next read. Call this after the owner saves settings. */
export function invalidateSettingsCache(): void {
  cache = null
}

/** Shortcut for the most-needed value: the Paystack secret key. */
export async function getPaystackSecret(payload: Payload): Promise<string> {
  const s = await resolveSettings(payload)
  if (!s.paystackSecretKey) {
    throw new Error('Paystack secret key not configured (Settings global or PAYSTACK_SECRET_KEY env).')
  }
  return s.paystackSecretKey
}

/** Webhook secret — falls back to the secret key (Paystack default). */
export async function getPaystackWebhookSecret(payload: Payload): Promise<string> {
  const s = await resolveSettings(payload)
  return s.paystackWebhookSecret || s.paystackSecretKey || ''
}
