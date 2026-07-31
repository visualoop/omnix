import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { COUNTRY_TO_LANG, routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  const messagesKey = COUNTRY_TO_LANG[locale]

  return {
    locale,
    messages: (await import(`../messages/${messagesKey}.json`)).default,
  }
})
