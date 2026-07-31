import {
  KENYA_ONLY_ROUTE_FAMILIES,
  LEGACY_LOCALES,
  ROUTABLE_COUNTRY_LOCALES,
} from '@/i18n/routing'
import { publishedGuideSlugs } from '@/config/guides'
import { publishedLocationSlugs } from '@/config/locations'

const KNOWN_LOCALES = new Set<string>(ROUTABLE_COUNTRY_LOCALES)
const LEGACY_PREFIXES = new Set<string>(LEGACY_LOCALES)

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

export function isUnknownKenyaOnlyDetailPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 3) return false

  const [locale, family, detail] = segments
  if (locale !== 'ke' || !family || !detail) return false

  const published = PUBLISHED_KENYA_DETAILS[family]
  return published ? !published.has(detail) : false
}

const KENYA_ONLY_FAMILIES = new Set<string>(KENYA_ONLY_ROUTE_FAMILIES)

/**
 * Resolve public routes that must issue a real HTTP 308 before React streams.
 * Legacy country prefixes collapse directly to /ke and legacy page aliases are
 * canonicalized in the same hop. Middleware preserves only allowlisted query
 * parameters when applying this result.
 */
export function canonicalPublicRedirectPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  const [locale, family, detail] = segments

  if (!locale || !KNOWN_LOCALES.has(locale)) return null

  const destinationLocale = LEGACY_PREFIXES.has(locale) ? 'ke' : locale

  if (!family) {
    return destinationLocale !== locale ? `/${destinationLocale}` : null
  }

  if (segments.length === 2) {
    const legacyTarget = LEGACY_PAGE_REDIRECTS[family]
    if (legacyTarget) return `/${destinationLocale}/${legacyTarget}`
  }

  if (segments.length === 3 && family === 'modules' && detail) {
    return `/${destinationLocale}/${LEGACY_MODULE_REDIRECTS[detail] ?? 'modules'}`
  }

  if (
    destinationLocale !== 'ke' &&
    KENYA_ONLY_FAMILIES.has(family) &&
    (segments.length === 2 || segments.length === 3)
  ) {
    return `/ke/${segments.slice(1).join('/')}`
  }

  if (destinationLocale !== locale) {
    return `/${destinationLocale}/${segments.slice(1).join('/')}`
  }

  return null
}
