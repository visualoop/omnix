import { COUNTRY_LOCALES, ROUTABLE_COUNTRY_LOCALES } from '@/i18n/routing'

const BRAND_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

interface AlternateLink {
  hreflang: string
  href: string
}

const HREFLANG_BY_COUNTRY: Readonly<Record<(typeof COUNTRY_LOCALES)[number], string>> = {
  ke: 'en-KE',
  ug: 'en-UG',
  tz: 'en-TZ',
  rw: 'en-RW',
}

function stripCountryPrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]?.toLowerCase()
  const restPath = (ROUTABLE_COUNTRY_LOCALES as readonly string[]).includes(first ?? '')
    ? `/${parts.slice(1).join('/')}`
    : pathname
  return restPath === '/' ? '' : restPath
}

/** Build four-country hreflang alternates plus x-default → /ke. */
export function buildHreflangLinks(pathname: string): AlternateLink[] {
  const cleanRest = stripCountryPrefix(pathname)
  const links: AlternateLink[] = COUNTRY_LOCALES.map((country) => ({
    hreflang: HREFLANG_BY_COUNTRY[country],
    href: `${BRAND_URL}/${country}${cleanRest}`,
  }))
  links.push({ hreflang: 'x-default', href: `${BRAND_URL}/ke${cleanRest}` })
  return links
}

export function buildAlternatesLanguages(pathname: string): Record<string, string> {
  return Object.fromEntries(buildHreflangLinks(pathname).map((link) => [link.hreflang, link.href]))
}

/** Kenya-only content gets no duplicated market variants. */
export function buildKenyaOnlyHreflangLinks(pathname: string): AlternateLink[] {
  const cleanRest = stripCountryPrefix(pathname)
  const href = `${BRAND_URL}/ke${cleanRest}`
  return [
    { hreflang: 'en-KE', href },
    { hreflang: 'x-default', href },
  ]
}

export function buildKenyaOnlyAlternatesLanguages(pathname: string): Record<string, string> {
  return Object.fromEntries(
    buildKenyaOnlyHreflangLinks(pathname).map((link) => [link.hreflang, link.href]),
  )
}
