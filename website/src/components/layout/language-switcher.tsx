'use client'

import { usePathname, useRouter } from 'next/navigation'

import {
  COUNTRY_LOCALES,
  ROUTABLE_COUNTRY_LOCALES,
  isKenyaOnlyRoutePath,
  type LaunchMarketLocale,
} from '@/i18n/routing'

export const MARKET_OPTIONS: ReadonlyArray<{
  locale: LaunchMarketLocale
  country: string
  currency: string
}> = [
  { locale: 'ke', country: 'Kenya', currency: 'KES' },
  { locale: 'ug', country: 'Uganda', currency: 'UGX' },
  { locale: 'tz', country: 'Tanzania', currency: 'TZS' },
  { locale: 'rw', country: 'Rwanda', currency: 'RWF' },
]

/** Replace any current/legacy country prefix while preserving the page path. */
export function marketPath(pathname: string, next: LaunchMarketLocale): string {
  if (next !== 'ke' && isKenyaOnlyRoutePath(pathname)) return `/${next}`

  const parts = pathname.split('/').filter(Boolean)
  if ((ROUTABLE_COUNTRY_LOCALES as readonly string[]).includes(parts[0]?.toLowerCase() ?? '')) {
    parts.shift()
  }
  const rest = parts.length > 0 ? `/${parts.join('/')}` : ''
  return `/${next}${rest}`
}

/**
 * Four-market selector retained under its historical export name so header and
 * footer call sites do not fork. Changing it immediately replaces the current
 * route; display currency follows from the selected market prefix.
 */
export function MarketSwitcher({ locale, className }: { locale: string; className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const selected = (COUNTRY_LOCALES as readonly string[]).includes(locale) ? locale : 'ke'

  return (
    <select
      value={selected}
      onChange={(event) => {
        const next = event.currentTarget.value as LaunchMarketLocale
        if (next !== selected) router.replace(marketPath(pathname, next))
      }}
      className={className}
      aria-label="Select market"
    >
      {MARKET_OPTIONS.map((market) => (
        <option key={market.locale} value={market.locale}>
          {market.locale.toUpperCase()} — {market.country} · {market.currency}
        </option>
      ))}
    </select>
  )
}

/** @deprecated Use MarketSwitcher; this control selects a country market, not a language. */
export const LanguageSwitcher = MarketSwitcher
