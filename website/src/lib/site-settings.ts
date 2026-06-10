/**
 * Server-side site-settings reader.
 *
 * Reads the `settings` global once per request and surfaces the
 * brand/contact/social/footer copy that pages and shared components
 * (footer, dashboard sidebar, contact, support, docs, success) consume.
 *
 * Internally caches for 60s to avoid pounding the DB on hot pages.
 */
import { getPayload } from 'payload'
import config from '../payload.config'

export interface SiteSettings {
  brandName: string
  tagline: string
  kraPin: string | null
  supportEmail: string
  salesEmail: string | null
  whatsappNumber: string | null
  whatsappUrl: string | null
  whatsappDisplay: string | null
  phoneNumber: string | null
  office: {
    address: string | null
    mapEmbedUrl: string | null
    workingHours: string | null
  }
  social: {
    twitter: string | null
    linkedin: string | null
    youtube: string | null
    github: string | null
  }
}

const FALLBACK: SiteSettings = {
  brandName: 'Omnix',
  tagline: 'Offline-first ERP for Kenyan SMEs',
  kraPin: null,
  supportEmail: 'support@omnix.co.ke',
  salesEmail: null,
  whatsappNumber: null,
  whatsappUrl: null,
  whatsappDisplay: null,
  phoneNumber: null,
  office: { address: null, mapEmbedUrl: null, workingHours: null },
  social: { twitter: null, linkedin: null, youtube: null, github: null },
}

interface CacheEntry {
  value: SiteSettings
  expiresAt: number
}

const TTL_MS = 60_000
let cache: CacheEntry | null = null

/** Convert "+254712345678" → "https://wa.me/254712345678" (no plus, no spaces). */
function toWaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
}

/** Convert "+254712345678" → "+254 712 345 678" for human display. */
function toWaDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits.length < 9) return raw
  // Try Kenya format: +254 7XX XXX XXX
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  return `+${digits}`
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const g = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const office = (g.office as Record<string, unknown> | undefined) ?? {}
    const social = (g.social as Record<string, unknown> | undefined) ?? {}
    const wa = (g.whatsappNumber as string | null | undefined) ?? null

    const value: SiteSettings = {
      brandName: (g.brandName as string | undefined) ?? FALLBACK.brandName,
      tagline: (g.tagline as string | undefined) ?? FALLBACK.tagline,
      kraPin: (g.kraPin as string | undefined) ?? null,
      supportEmail: (g.supportEmail as string | undefined) ?? FALLBACK.supportEmail,
      salesEmail: (g.salesEmail as string | undefined) ?? null,
      whatsappNumber: wa,
      whatsappUrl: toWaUrl(wa),
      whatsappDisplay: toWaDisplay(wa),
      phoneNumber: (g.phoneNumber as string | undefined) ?? null,
      office: {
        address: (office.address as string | undefined) ?? null,
        mapEmbedUrl: (office.mapEmbedUrl as string | undefined) ?? null,
        workingHours: (office.workingHours as string | undefined) ?? null,
      },
      social: {
        twitter: (social.twitter as string | undefined) ?? null,
        linkedin: (social.linkedin as string | undefined) ?? null,
        youtube: (social.youtube as string | undefined) ?? null,
        github: (social.github as string | undefined) ?? null,
      },
    }
    cache = { value, expiresAt: Date.now() + TTL_MS }
    return value
  } catch {
    // DB unavailable on cold boot — render with safe fallbacks.
    return FALLBACK
  }
}

/** Force-refresh on next read. Called from settings afterChange hook. */
export function invalidateSiteSettingsCache(): void {
  cache = null
}
