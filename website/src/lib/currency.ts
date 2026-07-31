/**
 * Currency contracts for public prices and payment settlement.
 *
 * Display currency answers only "what price does this market page show?".
 * Settlement currency answers "what currency may a configured payment rail
 * charge?". They are deliberately separate: showing UGX, TZS or RWF never
 * implies that Paystack will charge that currency.
 */

export const DISPLAY_CURRENCIES = ['KES', 'UGX', 'TZS', 'RWF'] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

export const PAYSTACK_SETTLEMENT_CURRENCIES = ['KES', 'USD', 'NGN', 'GHS', 'ZAR'] as const
export type SettlementCurrency = (typeof PAYSTACK_SETTLEMENT_CURRENCIES)[number]

export const PRICING_CURRENCIES = [
  'KES',
  'UGX',
  'TZS',
  'RWF',
  'USD',
  'NGN',
  'GHS',
  'ZAR',
] as const
export type PricingCurrency = (typeof PRICING_CURRENCIES)[number]

/** Legacy name retained for payment/admin call sites. Public UI should use DisplayCurrency. */
export type SupportedCurrency = SettlementCurrency

export interface Currency<C extends string = string> {
  code: C
  symbol: string
  position: 'prefix' | 'suffix'
  decimals: number
  locale: string
}

/** Formatting metadata is complete for every configured display or settlement price. */
export const CURRENCIES: Readonly<Record<PricingCurrency, Currency<PricingCurrency>>> = {
  KES: { code: 'KES', symbol: 'KES', position: 'prefix', decimals: 0, locale: 'en-KE' },
  UGX: { code: 'UGX', symbol: 'UGX', position: 'prefix', decimals: 0, locale: 'en-UG' },
  TZS: { code: 'TZS', symbol: 'TZS', position: 'prefix', decimals: 0, locale: 'en-TZ' },
  RWF: { code: 'RWF', symbol: 'RWF', position: 'prefix', decimals: 0, locale: 'en-RW' },
  USD: { code: 'USD', symbol: '$', position: 'prefix', decimals: 2, locale: 'en-US' },
  NGN: { code: 'NGN', symbol: '₦', position: 'prefix', decimals: 0, locale: 'en-NG' },
  GHS: { code: 'GHS', symbol: 'GH₵', position: 'prefix', decimals: 2, locale: 'en-GH' },
  ZAR: { code: 'ZAR', symbol: 'R', position: 'prefix', decimals: 2, locale: 'en-ZA' },
}

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value)
}

export function isSettlementCurrency(value: unknown): value is SettlementCurrency {
  return typeof value === 'string' && (PAYSTACK_SETTLEMENT_CURRENCIES as readonly string[]).includes(value)
}

/** ISO-3166 launch-country code → the currency displayed on that market route. */
export function currencyForCountry(countryCode: string | null | undefined): DisplayCurrency {
  const country = (countryCode ?? '').toUpperCase()
  switch (country) {
    case 'UG': return 'UGX'
    case 'TZ': return 'TZS'
    case 'RW': return 'RWF'
    case 'KE':
    default: return 'KES'
  }
}

/** "KES 30,000" / "UGX 850,000" / "TZS 570,000" / "RWF 300,000". */
export function formatPrice(amount: number, currency: DisplayCurrency): string {
  const config = CURRENCIES[currency]
  const formatted = amount.toLocaleString(config.locale, {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  })
  return config.position === 'prefix'
    ? `${config.symbol} ${formatted}`
    : `${formatted} ${config.symbol}`
}

/** Legacy CMS-compatible tier shape used by older public helpers. */
export interface PricingTierShape {
  oneTimeFee?: number
  priceKES?: number | null
  priceUGX?: number | null
  priceTZS?: number | null
  priceRWF?: number | null
}

/** Read an explicitly configured display price; never invent an FX fallback. */
export function tierPrice(tier: PricingTierShape | undefined, currency: DisplayCurrency): number {
  if (!tier) return 0
  const directField: Record<DisplayCurrency, number | null | undefined> = {
    KES: tier.priceKES,
    UGX: tier.priceUGX,
    TZS: tier.priceTZS,
    RWF: tier.priceRWF,
  }
  const direct = directField[currency]
  if (typeof direct === 'number' && direct > 0) return direct
  if (currency === 'KES' && typeof tier.oneTimeFee === 'number' && tier.oneTimeFee > 0) {
    return tier.oneTimeFee
  }
  return 0
}

export type ManualSettlementDisplayCurrency = Exclude<DisplayCurrency, 'KES'>

export type CheckoutSettlementPreflight =
  | {
      kind: 'paystack'
      displayCurrency: 'KES'
      settlementCurrency: 'KES'
    }
  | {
      kind: 'manual'
      displayCurrency: ManualSettlementDisplayCurrency
      settlementCurrency: null
    }

/**
 * Decide the payment rail before rendering or loading Paystack.
 *
 * There is deliberately no FX fallback here. The three non-KES launch-market
 * prices remain local display prices and require a manually confirmed
 * settlement method until a provider can charge those exact currencies.
 */
export function checkoutSettlementPreflight(
  displayCurrency: DisplayCurrency,
): CheckoutSettlementPreflight {
  if (displayCurrency === 'KES') {
    return { kind: 'paystack', displayCurrency, settlementCurrency: 'KES' }
  }

  return { kind: 'manual', displayCurrency, settlementCurrency: null }
}

/** Market route that owns a configured launch display currency. */
export function marketLocaleForDisplayCurrency(displayCurrency: DisplayCurrency): 'ke' | 'ug' | 'tz' | 'rw' {
  switch (displayCurrency) {
    case 'UGX': return 'ug'
    case 'TZS': return 'tz'
    case 'RWF': return 'rw'
    case 'KES': return 'ke'
  }
}
