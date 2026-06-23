/**
 * Currency resolution per visitor.
 *
 * Paystack natively accepts these currencies — every other country
 * falls back to USD (also Paystack-supported as a universal currency).
 *
 * Country → currency mapping uses Vercel's `req.geo.country` header in
 * middleware, then is persisted in the `omnix_currency` cookie so the
 * visitor's choice survives navigation and a manual switcher (in nav).
 */

export type SupportedCurrency = 'KES' | 'USD' | 'NGN' | 'GHS' | 'ZAR'

export interface Currency {
  code: SupportedCurrency
  symbol: string
  /** Where the symbol goes relative to the number. */
  position: 'prefix' | 'suffix'
  /** Decimal places shown by default. */
  decimals: number
}

export const CURRENCIES: Record<SupportedCurrency, Currency> = {
  KES: { code: 'KES', symbol: 'KSh', position: 'prefix', decimals: 0 },
  USD: { code: 'USD', symbol: '$', position: 'prefix', decimals: 2 },
  NGN: { code: 'NGN', symbol: '₦', position: 'prefix', decimals: 0 },
  GHS: { code: 'GHS', symbol: '₵', position: 'prefix', decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R', position: 'prefix', decimals: 2 },
}

/**
 * ISO-3166 country code → primary currency for that visitor.
 *
 * Paystack natively supports KES, NGN, GHS, ZAR and USD. We charge in
 * the visitor's local currency only when Paystack supports it; everyone
 * else (the rest of the world, including Tanzania/Uganda/Rwanda/Egypt/
 * UK/EU/US/India/Asia/the Americas) sees USD prices and pays USD.
 *
 *   KE  → KES (home market)
 *   NG  → NGN
 *   GH  → GHS
 *   ZA  → ZAR
 *   *   → USD
 */
export function currencyForCountry(countryCode: string | null | undefined): SupportedCurrency {
  const cc = (countryCode ?? '').toUpperCase()
  switch (cc) {
    case 'KE': return 'KES'
    case 'NG': return 'NGN'
    case 'GH': return 'GHS'
    case 'ZA': return 'ZAR'
    default:   return 'USD'
  }
}

/** "KSh 50,000" / "$350" / "₦60,000". */
export function formatPrice(amount: number, currency: SupportedCurrency): string {
  const c = CURRENCIES[currency]
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  })
  return c.position === 'prefix' ? `${c.symbol} ${formatted}` : `${formatted} ${c.symbol}`
}

/**
 * Pull the right per-currency value off a tier in the Pricing global.
 * Falls back to oneTimeFee (legacy KES-only) when the per-currency
 * field is empty.
 */
export interface PricingTierShape {
  oneTimeFee?: number
  priceKES?: number | null
  priceUSD?: number | null
  priceNGN?: number | null
  priceGHS?: number | null
  priceZAR?: number | null
}

export function tierPrice(tier: PricingTierShape | undefined, currency: SupportedCurrency): number {
  if (!tier) return 0
  const directField = ({
    KES: tier.priceKES,
    USD: tier.priceUSD,
    NGN: tier.priceNGN,
    GHS: tier.priceGHS,
    ZAR: tier.priceZAR,
  } as Record<SupportedCurrency, number | null | undefined>)[currency]
  if (typeof directField === 'number' && directField > 0) return directField
  // Legacy fallback — oneTimeFee is in KES.
  if (currency === 'KES' && typeof tier.oneTimeFee === 'number') return tier.oneTimeFee
  // Last resort: rough heuristic so the page renders something even if
  // owner hasn't configured this currency yet. Owner sees a notice in
  // /admin → Pricing → tab to fill in actual values.
  if (typeof tier.oneTimeFee === 'number') {
    const RATES: Record<SupportedCurrency, number> = {
      KES: 1,
      USD: 1 / 130,
      NGN: 12,
      GHS: 0.13,
      ZAR: 0.13,
    }
    return Math.round(tier.oneTimeFee * RATES[currency])
  }
  return 0
}
