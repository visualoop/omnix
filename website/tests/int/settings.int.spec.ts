/**
 * Settings resolver tests.
 *
 * The resolver reads runtime secrets (Paystack, Resend, GA, cloud-backup) from
 * the Payload `settings` global FIRST, falling back to env vars. Cached for 60s.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveSettings, invalidateSettingsCache } from '@/lib/settings'

const ORIG_ENV = { ...process.env }

beforeEach(() => {
  invalidateSettingsCache()
  process.env = { ...ORIG_ENV }
  delete process.env.PAYSTACK_PUBLIC_KEY
  delete process.env.PAYSTACK_SECRET_KEY
  delete process.env.PAYSTACK_WEBHOOK_SECRET
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
  delete process.env.NEXT_PUBLIC_GA_ID
  delete process.env.CLOUD_BACKUP_ENABLED
})
afterEach(() => {
  process.env = { ...ORIG_ENV }
  invalidateSettingsCache()
  vi.restoreAllMocks()
})

const fakePayload = (integrations: Record<string, unknown> | null = null) => ({
  findGlobal: vi.fn(async () => (integrations === null ? {} : { integrations })),
}) as unknown as Parameters<typeof resolveSettings>[0]

describe('resolveSettings: precedence', () => {
  it('Settings value overrides env', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_env'
    const out = await resolveSettings(fakePayload({ paystackSecretKey: 'sk_cms' }))
    expect(out.paystackSecretKey).toBe('sk_cms')
  })

  it('env wins when Settings is empty string', async () => {
    process.env.PAYSTACK_PUBLIC_KEY = 'pk_env'
    const out = await resolveSettings(fakePayload({ paystackPublicKey: '' }))
    expect(out.paystackPublicKey).toBe('pk_env')
  })

  it('falls back to env when Settings has no integrations group', async () => {
    process.env.RESEND_API_KEY = 're_env_key'
    const out = await resolveSettings(fakePayload(null))
    expect(out.resendApiKey).toBe('re_env_key')
  })

  it('returns undefined when neither source has the value', async () => {
    const out = await resolveSettings(fakePayload({}))
    expect(out.paystackSecretKey).toBeUndefined()
    expect(out.googleAnalyticsId).toBeUndefined()
  })
})

describe('resolveSettings: cloudBackupEnabled', () => {
  it('reads boolean from Settings', async () => {
    const out = await resolveSettings(fakePayload({ cloudBackupEnabled: true }))
    expect(out.cloudBackupEnabled).toBe(true)
  })

  it('falls back to CLOUD_BACKUP_ENABLED=1 env', async () => {
    process.env.CLOUD_BACKUP_ENABLED = '1'
    const out = await resolveSettings(fakePayload({}))
    expect(out.cloudBackupEnabled).toBe(true)
  })

  it('returns false when neither set', async () => {
    const out = await resolveSettings(fakePayload({}))
    expect(out.cloudBackupEnabled).toBe(false)
  })

  it('exposes price + retention with sensible defaults', async () => {
    const out = await resolveSettings(fakePayload({}))
    expect(out.cloudBackupPriceMonthly).toBe(500)
    expect(out.cloudBackupRetentionDays).toBe(30)
  })

  it('accepts overrides for price and retention', async () => {
    const out = await resolveSettings(
      fakePayload({ cloudBackupPriceMonthly: 750, cloudBackupRetentionDays: 60 }),
    )
    expect(out.cloudBackupPriceMonthly).toBe(750)
    expect(out.cloudBackupRetentionDays).toBe(60)
  })
})

describe('resolveSettings: cache', () => {
  it('does not call findGlobal again within TTL', async () => {
    const p = fakePayload({ paystackSecretKey: 'sk_cms' }) as unknown as { findGlobal: ReturnType<typeof vi.fn> }
    await resolveSettings(p as never)
    await resolveSettings(p as never)
    await resolveSettings(p as never)
    expect(p.findGlobal).toHaveBeenCalledTimes(1)
  })

  it('invalidateSettingsCache forces a fresh read', async () => {
    const p = fakePayload({ paystackSecretKey: 'sk_cms' }) as unknown as { findGlobal: ReturnType<typeof vi.fn> }
    await resolveSettings(p as never)
    invalidateSettingsCache()
    await resolveSettings(p as never)
    expect(p.findGlobal).toHaveBeenCalledTimes(2)
  })
})

describe('resolveSettings: graceful failure', () => {
  it('returns env fallbacks when findGlobal throws (cold-boot before bootstrap)', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_env'
    const p = {
      findGlobal: vi.fn(async () => {
        throw new Error('settings global not yet seeded')
      }),
    } as unknown as Parameters<typeof resolveSettings>[0]
    const out = await resolveSettings(p)
    expect(out.paystackSecretKey).toBe('sk_env')
  })
})
