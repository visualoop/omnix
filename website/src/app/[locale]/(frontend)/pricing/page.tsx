import type { Metadata } from 'next'

import { PricingWebsite } from '@/components/marketing/pricing-website'
import { displayPricingFor } from '@/config/pricing'
import {
  displayCurrencyForLocale,
  isLaunchMarketLocale,
  type LaunchMarketLocale,
} from '@/i18n/routing'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { formatPrice } from '@/lib/currency'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

const MARKET_NAMES: Readonly<Record<LaunchMarketLocale, string>> = {
  ke: 'Kenya',
  ug: 'Uganda',
  tz: 'Tanzania',
  rw: 'Rwanda',
}

function marketName(locale: string): string {
  return MARKET_NAMES[isLaunchMarketLocale(locale) ? locale : 'ke']
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const currency = displayCurrencyForLocale(locale)
  const prices = displayPricingFor(currency)
  const country = marketName(locale)
  const formattedPrice = formatPrice(prices.starter.oneTimeFee, currency)
  const canonical = `${SITE_URL}/${locale}/pricing`
  const title = `Omnix pricing in ${country} — ${formattedPrice} one-time licence`
  const description = `${formattedPrice} is the configured one-time starter price displayed for ${country}. The licence is perpetual; optional compliance updates are priced separately.`

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/pricing'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title,
      description,
      type: 'website',
    }),
  }
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const currency = displayCurrencyForLocale(locale)
  const prices = displayPricingFor(currency)
  const settings = await getSiteSettings()

  return (
    <PricingWebsite
      locale={locale}
      marketName={marketName(locale)}
      currency={currency}
      oneTimeFee={prices.starter.oneTimeFee}
      maintenanceYearly={prices.starter.maintenanceYearly}
      cloudBackupMonthly={prices.cloudBackupMonthly}
      extraBranchOneTime={prices.extraBranchOneTime}
      extraMachineOneTime={prices.extraMachineOneTime}
      whatsappUrl={settings.whatsappUrl}
    />
  )
}
