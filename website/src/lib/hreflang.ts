import { COUNTRY_LOCALES } from '@/i18n/routing'

const BRAND_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

interface AlternateLink {
  hreflang: string
  href: string
}

/**
 * Build hreflang alternates for the current path.
 *
 * Strips the leading locale segment from `pathname` and emits one
 * `<link rel="alternate" hreflang="...">` per country locale, plus
 * `x-default` pointing to the home market (/ke).
 *
 * Example: pathname='/us/dawa' returns
 *   ke → /ke/dawa
 *   us → /us/dawa
 *   gb → /gb/dawa
 *   ...
 *   x-default → /ke/dawa
 */
/**
 * Country route → valid BCP-47 hreflang. Google rejects bare country
 * codes like "ke"; it needs a language(-REGION) form. Every market is
 * English-language, so we emit en-KE / en-US / etc.
 */
const HREFLANG_BY_COUNTRY: Record<string, string> = {
  ke: 'en-KE', us: 'en-US', gb: 'en-GB', ng: 'en-NG', gh: 'en-GH',
  za: 'en-ZA', in: 'en-IN', rw: 'en-RW', tz: 'en-TZ', ug: 'en-UG',
  eg: 'en-EG', ae: 'en-AE',
}

export function buildHreflangLinks(pathname: string): AlternateLink[] {
  // Strip leading slash + first segment if it's a known country locale.
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]?.toLowerCase()
  const restPath = (COUNTRY_LOCALES as readonly string[]).includes(first ?? '')
    ? '/' + parts.slice(1).join('/')
    : pathname
  const cleanRest = restPath === '/' ? '' : restPath

  const out: AlternateLink[] = COUNTRY_LOCALES.map((cc) => ({
    hreflang: HREFLANG_BY_COUNTRY[cc] ?? `en-${cc.toUpperCase()}`,
    href: `${BRAND_URL}/${cc}${cleanRest}`,
  }))
  out.push({ hreflang: 'x-default', href: `${BRAND_URL}/ke${cleanRest}` })
  return out
}

/**
 * Render-only — meant to be embedded in a Next metadata `alternates.languages`
 * map. Returns the same data shape as buildHreflangLinks but keyed by locale.
 */
export function buildAlternatesLanguages(pathname: string): Record<string, string> {
  const links = buildHreflangLinks(pathname)
  return Object.fromEntries(links.map((l) => [l.hreflang, l.href]))
}

/**
 * Kenya-only alternates for content that must NOT be duplicated across the 12
 * market locales — national buyer guides (/guides) and local city hubs
 * (/locations). These pages describe the Kenyan market only; emitting them
 * under /us, /gb, … with 12-way hreflang would be duplicate / scaled local
 * SEO (a doorway pattern). So we emit exactly two alternates — `en-KE` and
 * `x-default` — both pointing at the single canonical /ke path.
 *
 * Use this instead of `buildHreflangLinks` for guide/location surfaces; keep
 * the general helper for genuinely multi-market pages (products, pricing, …).
 */
export function buildKenyaOnlyHreflangLinks(pathname: string): AlternateLink[] {
  // Strip a leading country-locale segment so callers can pass either a
  // locale-free path ('/guides') or a locale-prefixed one ('/us/guides').
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]?.toLowerCase()
  const restPath = (COUNTRY_LOCALES as readonly string[]).includes(first ?? '')
    ? '/' + parts.slice(1).join('/')
    : pathname
  const cleanRest = restPath === '/' ? '' : restPath
  const href = `${BRAND_URL}/ke${cleanRest}`
  return [
    { hreflang: 'en-KE', href },
    { hreflang: 'x-default', href },
  ]
}

/**
 * Render-only variant of buildKenyaOnlyHreflangLinks, keyed by hreflang for a
 * Next metadata `alternates.languages` map.
 */
export function buildKenyaOnlyAlternatesLanguages(pathname: string): Record<string, string> {
  const links = buildKenyaOnlyHreflangLinks(pathname)
  return Object.fromEntries(links.map((l) => [l.hreflang, l.href]))
}
