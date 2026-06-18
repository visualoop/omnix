import { defineRouting } from 'next-intl/routing'

/**
 * Locale routing config — used by middleware and createSharedPathnames.
 *
 * localePrefix: 'as-needed' means:
 *   - Default locale (en) stays at root paths: /, /pricing, /pro
 *   - Other locales get prefixed: /sw/pricing, /fr/pro
 *
 * Existing inbound links (omnix.co.ke/pricing) keep working without
 * 301 redirects. Only the foreign-language traffic gets prefixes.
 */
export const routing = defineRouting({
  // BCP-47 language tags. Add more as the global rollout expands.
  locales: ['en', 'sw', 'fr', 'pt', 'es', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
