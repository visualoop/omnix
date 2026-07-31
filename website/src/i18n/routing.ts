import { defineRouting } from 'next-intl/routing'

import type { DisplayCurrency } from '@/lib/currency'

/** Publicly launched, selectable, renderable and indexable markets. */
export const COUNTRY_LOCALES = ['ke', 'ug', 'tz', 'rw'] as const
export type LaunchMarketLocale = (typeof COUNTRY_LOCALES)[number]

/** Historical prefixes accepted only so middleware can issue a one-hop 308. */
export const LEGACY_COUNTRY_LOCALES = ['us', 'gb', 'ng', 'gh', 'za', 'in', 'eg', 'ae'] as const
export const LANGUAGE_LOCALES = ['en', 'sw', 'fr', 'pt', 'es', 'ar'] as const
export const LEGACY_LOCALES = [...LEGACY_COUNTRY_LOCALES, ...LANGUAGE_LOCALES] as const

/** All prefixes that route helpers must recognize and strip. */
export const ROUTABLE_COUNTRY_LOCALES = [...COUNTRY_LOCALES, ...LEGACY_LOCALES] as const

export const COUNTRY_TO_LANG: Readonly<Record<LaunchMarketLocale, 'en'>> = {
  ke: 'en',
  ug: 'en',
  tz: 'en',
  rw: 'en',
}

/** Country route → local list-price display currency. This is not settlement configuration. */
export const COUNTRY_TO_CURRENCY: Readonly<Record<LaunchMarketLocale, DisplayCurrency>> = {
  ke: 'KES',
  ug: 'UGX',
  tz: 'TZS',
  rw: 'RWF',
}

/** Public route families whose authored content and integrations are Kenya-specific. */
export const KENYA_ONLY_ROUTE_FAMILIES = [
  'guides',
  'locations',
  'etims',
  'sha',
  'mpesa',
  'blog',
  'docs',
] as const

const KENYA_ONLY_ROUTE_SET = new Set<string>(KENYA_ONLY_ROUTE_FAMILIES)

export function isLaunchMarketLocale(locale: string): locale is LaunchMarketLocale {
  return (COUNTRY_LOCALES as readonly string[]).includes(locale.toLowerCase())
}

/**
 * Build an internal public URL without inventing a non-Kenya copy of authored
 * Kenya-only content. Query and fragment suffixes are preserved verbatim from
 * trusted, code-defined hrefs.
 */
export function publicMarketHref(locale: string, href: string): string {
  const normalizedHref = href.startsWith('/') ? href : `/${href}`
  const family = normalizedHref.split(/[/?#]/).filter(Boolean)[0] ?? ''
  const market = KENYA_ONLY_ROUTE_SET.has(family)
    ? 'ke'
    : isLaunchMarketLocale(locale)
      ? locale.toLowerCase()
      : 'ke'
  return `/${market}${normalizedHref === '/' ? '' : normalizedHref}`
}

export function isKenyaOnlyRoutePath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]?.toLowerCase() ?? ''
  const familyIndex = (ROUTABLE_COUNTRY_LOCALES as readonly string[]).includes(first) ? 1 : 0
  return KENYA_ONLY_ROUTE_SET.has(parts[familyIndex]?.toLowerCase() ?? '')
}

export function displayCurrencyForLocale(locale: string | null | undefined): DisplayCurrency {
  const normalized = (locale ?? '').toLowerCase()
  return isLaunchMarketLocale(normalized) ? COUNTRY_TO_CURRENCY[normalized] : 'KES'
}

/** Geo routing is launch-market-only. Unknown and legacy geos land on /ke. */
export function localeForGeoCountry(country: string | null | undefined): LaunchMarketLocale {
  const normalized = (country ?? '').toLowerCase()
  return isLaunchMarketLocale(normalized) ? normalized : 'ke'
}

export const routing = defineRouting({
  locales: COUNTRY_LOCALES,
  defaultLocale: 'ke',
  localePrefix: 'always',
  // Page metadata supplies valid en-KE/en-UG/en-TZ/en-RW alternates.
  alternateLinks: false,
})
