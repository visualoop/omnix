import { defineRouting } from 'next-intl/routing'

/**
 * Locale routing — language codes + country codes in one list.
 *
 * Two kinds of locale here:
 *
 *   1. Language-only codes (en, sw, fr, pt, es, ar). Legacy. Users who
 *      want a translation regardless of country still hit /sw/pricing.
 *      Currency for these comes from geo / cookie.
 *
 *   2. Country codes (ke, us, gb, ng, gh, za, in, rw, tz, ug, eg, ae).
 *      New. The primary URL shape going forward. /ke/pricing renders in
 *      English with KES; /us/pricing renders in English with USD; /eg
 *      renders in Arabic with EGP.
 *
 * Country codes resolve to the right LANGUAGE through COUNTRY_TO_LANG
 * in i18n/request.ts. Currency is read in the price layer from
 * COUNTRY_TO_CURRENCY.
 *
 * defaultLocale = 'ke' because Kenya is the home market.
 *
 * localePrefix = 'always' so every URL is explicit. Bare /pricing
 * redirects to /{detected-country}/pricing in middleware.
 *
 * The locale segment is what Vercel sees in the URL. Visitors landing
 * cold from a Google search in the US get redirected to /us/...; the
 * page reads in English with USD; their geo cookie locks it in.
 */
export const COUNTRY_LOCALES = [
  'ke', 'us', 'gb', 'ng', 'gh', 'za',
  'in', 'rw', 'tz', 'ug', 'eg', 'ae',
] as const

export const LANGUAGE_LOCALES = ['en', 'sw', 'fr', 'pt', 'es', 'ar'] as const

/** Country code → language code for message loading.
 *
 * Country codes are CURRENCY ROUTES, not language routes. Every country
 * loads English copy; the only thing that changes per country prefix is
 * the currency on the price components (KES vs USD vs NGN vs ...).
 *
 * Users who want a translated experience pick a LANGUAGE locale
 * (/sw/pricing, /fr/pricing, /ar/pricing). They can pick currency
 * separately via cookie / settings.
 */
export const COUNTRY_TO_LANG: Record<string, string> = {
  ke: 'en', us: 'en', gb: 'en', ng: 'en', gh: 'en', za: 'en',
  in: 'en', rw: 'en', tz: 'en', ug: 'en', eg: 'en', ae: 'en',
}

/** Country code → ISO 4217 currency for price components. */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ke: 'KES', tz: 'TZS', ug: 'UGX', rw: 'RWF',
  us: 'USD', gb: 'GBP', ng: 'NGN', gh: 'GHS',
  za: 'ZAR', in: 'INR', eg: 'EGP', ae: 'AED',
}

/** Geo header value (ISO 3166-1 alpha-2) → routed locale. */
export function localeForGeoCountry(country: string | null | undefined): string {
  if (!country) return 'ke'
  const lc = country.toLowerCase()
  return (COUNTRY_LOCALES as readonly string[]).includes(lc) ? lc : 'ke'
}

export const routing = defineRouting({
  locales: [...COUNTRY_LOCALES, ...LANGUAGE_LOCALES],
  defaultLocale: 'ke',
  // 'always' — bare /pricing without a country prefix is invalid; the
  // middleware redirects it to /{geo-detected}/pricing on first hit.
  // 'as-needed' would clash with the redirect by stripping the default
  // locale prefix, causing a redirect loop.
  localePrefix: 'always',
})
