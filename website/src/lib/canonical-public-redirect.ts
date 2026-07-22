import { COUNTRY_LOCALES, LANGUAGE_LOCALES } from '@/i18n/routing'
import { publishedGuideSlugs } from '@/config/guides'
import { publishedLocationSlugs } from '@/config/locations'

const KNOWN_LOCALES = new Set<string>([
  ...COUNTRY_LOCALES,
  ...LANGUAGE_LOCALES,
])

const LEGACY_PAGE_REDIRECTS: Readonly<Record<string, string>> = {
  dawa: 'pharmacy',
  pro: 'modules',
  ai: 'modules',
  'payroll-pack': 'modules',
}

const LEGACY_MODULE_REDIRECTS: Readonly<Record<string, string>> = {
  dawa: 'pharmacy',
  retail: 'retail',
  hospitality: 'hospitality',
  hardware: 'hardware',
  salon: 'salon',
  core: 'modules',
}


const PUBLISHED_KENYA_DETAILS: Readonly<Record<string, ReadonlySet<string>>> = {
  guides: new Set(publishedGuideSlugs()),
  locations: new Set(publishedLocationSlugs()),
}

/**
 * Dynamic Kenya-only detail pages read request-specific public settings, so
 * Next renders them on demand even though they declare `dynamicParams=false`.
 * Detect an unknown /ke slug before React can stream a not-found boundary as a
 * 200 response. Non-Kenya requests are intentionally excluded here: the
 * canonical redirect runs first and sends them to the matching /ke URL.
 */
export function isUnknownKenyaOnlyDetailPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 3) return false

  const [locale, family, detail] = segments
  if (locale !== 'ke' || !family || !detail) return false

  const published = PUBLISHED_KENYA_DETAILS[family]
  return published ? !published.has(detail) : false
}
const KENYA_ONLY_FAMILIES = new Set(['guides', 'locations'])

/**
 * Resolve public routes that must issue a real HTTP 308 before React starts
 * streaming. Page-level permanentRedirect remains as a fallback, but a Server
 * Component redirect can become a 200 response with a client redirect once a
 * parent layout has streamed. Keeping this request-layer map makes the status,
 * destination, and no-chain contract deterministic for crawlers and browsers.
 */
export function canonicalPublicRedirectPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  const [locale, family, detail] = segments

  if (!locale || !KNOWN_LOCALES.has(locale) || !family) return null

  if (segments.length === 2) {
    const legacyTarget = LEGACY_PAGE_REDIRECTS[family]
    if (legacyTarget) return `/${locale}/${legacyTarget}`
  }

  if (segments.length === 3 && family === 'modules' && detail) {
    return `/${locale}/${LEGACY_MODULE_REDIRECTS[detail] ?? 'modules'}`
  }

  // Buyer guides and city guides are Kenya-only. Redirect both their index
  // and one-segment detail routes to the matching /ke URL without a chain.
  if (
    locale !== 'ke' &&
    KENYA_ONLY_FAMILIES.has(family) &&
    (segments.length === 2 || segments.length === 3)
  ) {
    return `/ke/${segments.slice(1).join('/')}`
  }

  return null
}
