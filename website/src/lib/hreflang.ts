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
export function buildHreflangLinks(pathname: string): AlternateLink[] {
  // Strip leading slash + first segment if it's a known country locale.
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]?.toLowerCase()
  const restPath = (COUNTRY_LOCALES as readonly string[]).includes(first ?? '')
    ? '/' + parts.slice(1).join('/')
    : pathname
  const cleanRest = restPath === '/' ? '' : restPath

  const out: AlternateLink[] = COUNTRY_LOCALES.map((cc) => ({
    hreflang: cc,
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
