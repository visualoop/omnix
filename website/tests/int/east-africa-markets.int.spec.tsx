import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/ke/pricing',
  useRouter: () => ({ replace }),
}))

import { MarketSwitcher, MARKET_OPTIONS, marketPath } from '@/components/layout/language-switcher'
import { Homepage } from '@/components/landing/homepage'
import { ONBOARDING_MARKETS } from '@/components/dashboard/onboarding-wizard'
import { SoftwareJsonLd } from '@/components/seo/jsonld'
import { displayPricingFor, pricing } from '@/config/pricing'
import { MARKET_PROFILES, getMarketProfile } from '@/config/market-profiles'
import { generateMetadata as generateMarketMetadata } from '@/app/[locale]/(frontend)/layout'
import {
  COUNTRY_LOCALES,
  COUNTRY_TO_CURRENCY,
  LANGUAGE_LOCALES,
  LEGACY_COUNTRY_LOCALES,
  displayCurrencyForLocale,
  localeForGeoCountry,
  publicMarketHref,
} from '@/i18n/routing'
import {
  DISPLAY_CURRENCIES,
  PAYSTACK_SETTLEMENT_CURRENCIES,
  checkoutSettlementPreflight,
  currencyForCountry,
  formatPrice,
  isSettlementCurrency,
  type DisplayCurrency,
} from '@/lib/currency'
import { canonicalPublicRedirectPath } from '@/lib/canonical-public-redirect'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import sitemap from '@/app/sitemap'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const EXPECTED_MARKETS = [
  { locale: 'ke', country: 'KE', currency: 'KES', formatted: 'KES 30,000' },
  { locale: 'ug', country: 'UG', currency: 'UGX', formatted: 'UGX 850,000' },
  { locale: 'tz', country: 'TZ', currency: 'TZS', formatted: 'TZS 570,000' },
  { locale: 'rw', country: 'RW', currency: 'RWF', formatted: 'RWF 300,000' },
] as const

const PRICE_TABLES = [
  pricing.starter.oneTimeFee,
  pricing.starter.maintenanceYearly,
  pricing.business.oneTimeFee,
  pricing.business.maintenanceYearly,
  pricing.cloudBackupMonthly,
  pricing.extraBranchOneTime,
  pricing.extraMachineOneTime,
] as const

afterEach(() => {
  cleanup()
  replace.mockClear()
})

describe('East African launch market pricing', () => {
  it('maps /ke, /ug, /tz and /rw to KES, UGX, TZS and RWF with no USD fallback', () => {
    expect(COUNTRY_LOCALES).toEqual(['ke', 'ug', 'tz', 'rw'])
    expect(COUNTRY_TO_CURRENCY).toEqual({ ke: 'KES', ug: 'UGX', tz: 'TZS', rw: 'RWF' })

    for (const market of EXPECTED_MARKETS) {
      const currency = displayCurrencyForLocale(market.locale)
      expect(currency).toBe(market.currency)
      expect(currencyForCountry(market.country)).toBe(market.currency)
      expect(formatPrice(displayPricingFor(currency).starter.oneTimeFee, currency)).toBe(market.formatted)
      expect(localeForGeoCountry(market.country)).toBe(market.locale)
    }

    expect(displayCurrencyForLocale('us')).toBe('KES')
    expect(currencyForCountry('US')).toBe('KES')
    expect(localeForGeoCountry('US')).toBe('ke')
    expect(Object.values(COUNTRY_TO_CURRENCY)).not.toContain('USD')
  })

  it('configures every public price category for every launch display currency', () => {
    expect(DISPLAY_CURRENCIES).toEqual(['KES', 'UGX', 'TZS', 'RWF'])
    for (const table of PRICE_TABLES) {
      for (const currency of DISPLAY_CURRENCIES) {
        expect(table[currency], `${currency} has an explicit positive price`).toBeGreaterThan(0)
      }
    }

    const source = read('src/config/pricing.ts')
    expect(source).toContain('type ConfiguredPrices = Readonly<Record<PricingCurrency, number>>')
    expect(source).toContain('defaultDisplayCurrency')
    expect(source).toContain('defaultSettlementCurrency')
  })

  it('keeps list-price display currencies separate from Paystack settlement currencies', () => {
    expect(PAYSTACK_SETTLEMENT_CURRENCIES).toEqual(['KES', 'USD', 'NGN', 'GHS', 'ZAR'])
    expect(checkoutSettlementPreflight('KES')).toEqual({
      kind: 'paystack',
      displayCurrency: 'KES',
      settlementCurrency: 'KES',
    })
    for (const currency of ['UGX', 'TZS', 'RWF'] satisfies DisplayCurrency[]) {
      expect(isSettlementCurrency(currency)).toBe(false)
      expect(checkoutSettlementPreflight(currency)).toEqual({
        kind: 'manual',
        displayCurrency: currency,
        settlementCurrency: null,
      })
    }

    const initRoute = read('src/app/api/paystack/init/route.ts')
    const paystackClient = read('src/lib/paystack.ts')
    const pricingPage = read('src/components/marketing/pricing-website.tsx')
    const orderReview = read('src/app/(checkout)/buy/[licenseId]/page.tsx')
    expect(initRoute).toContain("code: 'manual_settlement_required'")
    expect(initRoute).toContain('settlementCurrency: null')
    expect(initRoute).toContain('checkoutSettlementPreflight(storedDisplayCurrency)')
    expect(paystackClient).toContain('currency: SettlementCurrency')
    expect(orderReview).toContain("settlement.kind === 'paystack'")
    expect(orderReview).toContain('<ManualSettlementState')
    expect(orderReview).not.toContain("license.currency as 'KES'")
    expect(pricingPage).toContain('Display currency is separate from payment settlement')
    expect(pricingPage).toContain('currency charged are confirmed before payment')
  })
})

describe('East African market selector', () => {
  it('shows exactly the four launch markets and their display currencies', () => {
    render(<MarketSwitcher locale="ke" />)
    const selector = screen.getByRole('combobox', { name: 'Select market' })
    const options = Array.from(selector.querySelectorAll('option'))
    expect(options).toHaveLength(4)
    expect(options.map((option) => option.value)).toEqual(['ke', 'ug', 'tz', 'rw'])
    expect(options.map((option) => option.textContent)).toEqual([
      'KE — Kenya · KES',
      'UG — Uganda · UGX',
      'TZ — Tanzania · TZS',
      'RW — Rwanda · RWF',
    ])
    expect(MARKET_OPTIONS).toHaveLength(4)
    expect(
      MARKET_OPTIONS.map(({ locale, currency }) => ({ locale, currency })),
    ).toEqual(
      COUNTRY_LOCALES.map((locale) => ({ locale, currency: COUNTRY_TO_CURRENCY[locale] })),
    )
    expect(ONBOARDING_MARKETS).toEqual([
      { value: 'KE', label: 'Kenya', currency: 'KES' },
      { value: 'UG', label: 'Uganda', currency: 'UGX' },
      { value: 'TZ', label: 'Tanzania', currency: 'TZS' },
      { value: 'RW', label: 'Rwanda', currency: 'RWF' },
    ])
    for (const legacy of LEGACY_COUNTRY_LOCALES) {
      expect(options.map((option) => option.value)).not.toContain(legacy)
    }
    for (const language of LANGUAGE_LOCALES) {
      expect(options.map((option) => option.value)).not.toContain(language)
    }
  })

  it('keeps Kenya-only internal links canonical instead of emitting duplicate market URLs', () => {
    expect(publicMarketHref('ug', '/docs')).toBe('/ke/docs')
    expect(publicMarketHref('tz', '/blog/offline-first-architecture')).toBe('/ke/blog/offline-first-architecture')
    expect(publicMarketHref('rw', '/locations/nairobi')).toBe('/ke/locations/nairobi')
    expect(publicMarketHref('ug', '/pricing')).toBe('/ug/pricing')
    expect(publicMarketHref('rw', '/contact?type=demo')).toBe('/rw/contact?type=demo')
    expect(marketPath('/ke/docs/getting-started', 'ug')).toBe('/ug')
  })

  it('routes immediately to the same page under the selected market prefix', () => {
    render(<MarketSwitcher locale="ke" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Select market' }), {
      target: { value: 'ug' },
    })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/ug/pricing')

    expect(marketPath('/tz/pharmacy', 'rw')).toBe('/rw/pharmacy')
    expect(marketPath('/us/pricing', 'ke')).toBe('/ke/pricing')
  })
})

describe('East African market SEO', () => {
  it('emits only four launch hreflangs plus x-default', () => {
    const alternates = buildAlternatesLanguages('/pricing')
    expect(Object.keys(alternates).sort()).toEqual(['en-KE', 'en-RW', 'en-TZ', 'en-UG', 'x-default'])
    expect(alternates['en-KE']).toMatch(/\/ke\/pricing$/)
    expect(alternates['en-UG']).toMatch(/\/ug\/pricing$/)
    expect(alternates['en-TZ']).toMatch(/\/tz\/pricing$/)
    expect(alternates['en-RW']).toMatch(/\/rw\/pricing$/)
    expect(alternates['x-default']).toBe(alternates['en-KE'])
    expect(buildAlternatesLanguages('/us/pricing')).toEqual(alternates)
  })

  it('indexes launch-market pages and excludes legacy country prefixes', () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname)
    for (const market of EXPECTED_MARKETS) {
      expect(urls).toContain(`/${market.locale}/pricing`)
    }
    for (const legacy of LEGACY_COUNTRY_LOCALES) {
      expect(urls.some((path) => path === `/${legacy}` || path.startsWith(`/${legacy}/`))).toBe(false)
    }
  })

  it('emits each route display currency in SoftwareApplication offers', () => {
    for (const market of EXPECTED_MARKETS) {
      const { container, unmount } = render(
        <SoftwareJsonLd product="retail" currency={market.currency} locale={market.locale} />,
      )
      const script = container.querySelector('script[type="application/ld+json"]')
      const data = JSON.parse(script?.textContent ?? '{}') as {
        offers?: { price?: string; priceCurrency?: string; url?: string }
      }
      expect(data.offers?.priceCurrency).toBe(market.currency)
      expect(data.offers?.price).toBe(String(pricing.starter.oneTimeFee[market.currency]))
      expect(data.offers?.url).toMatch(new RegExp(`/${market.locale}/retail$`))
      unmount()
    }
  })

  it('redirects legacy country URLs directly to /ke while preserving canonical route planning', () => {
    expect(canonicalPublicRedirectPath('/us')).toBe('/ke')
    expect(canonicalPublicRedirectPath('/gb/pricing')).toBe('/ke/pricing')
    expect(canonicalPublicRedirectPath('/ng/dawa')).toBe('/ke/pharmacy')
    expect(canonicalPublicRedirectPath('/za/modules/salon')).toBe('/ke/salon')
    expect(canonicalPublicRedirectPath('/ug/dawa')).toBe('/ug/pharmacy')
  })
})


describe('East African market homepage content', () => {
  it('defines one complete, typed profile per launch market', () => {
    expect(Object.keys(MARKET_PROFILES)).toEqual(COUNTRY_LOCALES)
    expect(
      COUNTRY_LOCALES.map((locale) => ({
        locale,
        currency: MARKET_PROFILES[locale].currency,
        authority: MARKET_PROFILES[locale].taxAuthority.name,
      })),
    ).toEqual([
      { locale: 'ke', currency: 'KES', authority: 'Kenya Revenue Authority' },
      { locale: 'ug', currency: 'UGX', authority: 'Uganda Revenue Authority' },
      { locale: 'tz', currency: 'TZS', authority: 'Tanzania Revenue Authority' },
      { locale: 'rw', currency: 'RWF', authority: 'Rwanda Revenue Authority' },
    ])

    for (const locale of COUNTRY_LOCALES) {
      const profile = getMarketProfile(locale)
      expect(profile.paymentMethods.length).toBeGreaterThanOrEqual(4)
      expect(profile.businessTerms.length).toBeGreaterThanOrEqual(4)
      expect(profile.useCases).toHaveLength(3)
      expect(profile.faq).toHaveLength(3)
      expect(profile.seo.title).toContain('Omnix')
      expect(profile.seo.description.length).toBeGreaterThan(100)
    }
  })

  it('renders materially distinct hero, terminology, use cases and visible FAQs', () => {
    const renderedCopy = new Set<string>()

    for (const locale of COUNTRY_LOCALES) {
      const profile = MARKET_PROFILES[locale]
      const { container, unmount } = render(<Homepage locale={locale} />)
      const market = container.querySelector(`[data-market-profile="${locale}"]`)
      const text = market?.textContent ?? ''

      expect(screen.getByRole('heading', { level: 1, name: profile.hero.title })).toBeTruthy()
      expect(text).toContain(profile.currency)
      expect(text).toContain(profile.taxAuthority.name)
      expect(text).toContain(profile.businessTerms[0])
      for (const useCase of profile.useCases) expect(text).toContain(useCase.title)
      for (const entry of profile.faq) expect(text).toContain(entry.question)

      renderedCopy.add(`${profile.hero.title}\n${profile.marketIntro}\n${profile.faq[0].question}`)
      unmount()
    }

    expect(renderedCopy.size).toBe(4)
  })

  it('states non-Kenyan mobile-money and fiscal boundaries without invented integrations', () => {
    for (const locale of ['ug', 'tz', 'rw'] as const) {
      const profile = MARKET_PROFILES[locale]
      const { container, unmount } = render(<Homepage locale={locale} />)
      const marketText = container.querySelector(`[data-market-profile="${locale}"]`)?.textContent ?? ''

      expect(profile.taxContext).toContain('does not currently claim an integration')
      expect(profile.paymentContext).toMatch(/does not claim a direct|does not claim direct|not as a claim of direct/i)
      expect(marketText).toContain('does not currently claim an integration')
      expect(marketText).not.toContain('KRA eTIMS')
      expect(marketText).not.toContain('SHA')
      unmount()
    }
  })

  it('keeps rendered FAQs and FAQPage structured data identical for each market', () => {
    for (const locale of COUNTRY_LOCALES) {
      const profile = MARKET_PROFILES[locale]
      const { container, unmount } = render(<Homepage locale={locale} />)
      const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
      const faqData = scripts
        .map((script) => JSON.parse(script.textContent ?? '{}') as {
          '@type'?: string
          mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>
        })
        .find((entry) => entry['@type'] === 'FAQPage')

      expect(faqData?.mainEntity?.map((entry) => entry.name)).toEqual(
        profile.faq.map((entry) => entry.question),
      )
      expect(faqData?.mainEntity?.map((entry) => entry.acceptedAnswer?.text)).toEqual(
        profile.faq.map((entry) => entry.answer),
      )
      unmount()
    }
  })

  it('generates distinct titles, descriptions and Open Graph locales for all four homepages', async () => {
    const titles = new Set<string>()
    const descriptions = new Set<string>()

    for (const locale of COUNTRY_LOCALES) {
      const profile = MARKET_PROFILES[locale]
      const metadata = await generateMarketMetadata({ params: Promise.resolve({ locale }) })
      const title = typeof metadata.title === 'object' && metadata.title && 'default' in metadata.title
        ? String(metadata.title.default)
        : String(metadata.title)

      expect(title).toBe(profile.seo.title)
      expect(metadata.description).toBe(profile.seo.description)
      expect(metadata.openGraph?.locale).toBe(profile.seo.ogLocale)
      expect(metadata.alternates?.canonical).toMatch(new RegExp(`/${locale}$`))
      titles.add(title)
      descriptions.add(String(metadata.description))
    }

    expect(titles.size).toBe(4)
    expect(descriptions.size).toBe(4)
  })
})
