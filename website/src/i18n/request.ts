import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing, COUNTRY_TO_LANG, COUNTRY_LOCALES } from './routing'

/**
 * Per-request config — runs server-side for every page render.
 *
 * Validates the locale segment against the routing config, falls back
 * to defaultLocale if invalid. Country-code locales (ke, us, gb, ...)
 * load the language-specific messages bundle via COUNTRY_TO_LANG, so
 * /ke and /us both load messages/en.json without duplicating files.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  // Country-code locales map to a language for messages lookup.
  const isCountry = (COUNTRY_LOCALES as readonly string[]).includes(locale)
  const messagesKey = isCountry ? (COUNTRY_TO_LANG[locale] ?? 'en') : locale

  return {
    locale,
    messages: (await import(`../messages/${messagesKey}.json`)).default,
  }
})
