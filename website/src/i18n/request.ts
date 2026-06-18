import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

/**
 * Per-request config — runs server-side for every page render.
 *
 * Validates the locale segment against the routing config, falls back
 * to defaultLocale if invalid, and lazy-loads the matching messages
 * JSON. Each locale's messages live in src/messages/<locale>.json.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
