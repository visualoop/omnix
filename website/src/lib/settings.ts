/**
 * Runtime settings resolver — env-var only.
 *
 * Was previously CMS-first with env fallback (so the owner could rotate
 * Paystack keys via /admin without a redeploy). Now env-only since the
 * Payload global is gone. Rotating a key means updating Vercel env vars
 * and redeploying — slower but simpler and keeps secrets out of the DB.
 *
 * Cache kept for shape compatibility; effectively a no-op since env
 * doesn't change at runtime.
 */

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

let cache: ResolvedSettings | null = null

export async function resolveSettings(): Promise<ResolvedSettings> {
  if (cache) return cache
  cache = {
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? undefined,
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? undefined,
    paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? undefined,
    resendApiKey: process.env.RESEND_API_KEY ?? undefined,
    resendFromEmail: process.env.RESEND_FROM ?? undefined,
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID ?? undefined,
    cloudBackupEnabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
    cloudBackupPriceMonthly: process.env.CLOUD_BACKUP_PRICE_MONTHLY
      ? Number(process.env.CLOUD_BACKUP_PRICE_MONTHLY)
      : undefined,
    cloudBackupRetentionDays: process.env.CLOUD_BACKUP_RETENTION_DAYS
      ? Number(process.env.CLOUD_BACKUP_RETENTION_DAYS)
      : 30,
  }
  return cache
}
