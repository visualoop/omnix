import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { PricingWebsite } from '@/components/marketing/pricing-website'
import { pricing } from '@/config/pricing'
import { COUNTRY_TO_CURRENCY } from '@/i18n/routing'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { CURRENCIES, currencyForCountry, type SupportedCurrency } from '@/lib/currency'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/pricing`

  return {
    title: 'Omnix pricing — KES 30,000 one-time perpetual licence',
    description: 'A KES 30,000 one-time starter licence for one Omnix product on one device. The licence is perpetual; optional compliance updates are not required to keep it working.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/pricing'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix pricing — pay once for a perpetual licence',
      description:
        'Choose one of five Omnix products. The starter licence is perpetual, with compliance updates available separately.',
      type: 'website',
    }),
  }
}

async function resolveCurrency(locale: string | undefined): Promise<SupportedCurrency> {
  if (locale) {
    const fromLocale = COUNTRY_TO_CURRENCY[locale.toLowerCase()]
    if (fromLocale && fromLocale in CURRENCIES) return fromLocale as SupportedCurrency
  }

  const cookieStore = await cookies()
  const savedCurrency = cookieStore.get('omnix_currency')?.value
  if (savedCurrency && savedCurrency in CURRENCIES) return savedCurrency as SupportedCurrency
  return currencyForCountry(undefined)
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [settings, currency] = await Promise.all([
    getSiteSettings(),
    resolveCurrency(locale),
  ])

  return (
    <PricingWebsite
      locale={locale}
      currency={currency}
      oneTimeFee={pricing.starter.oneTimeFee[currency]}
      maintenanceYearly={pricing.starter.maintenanceYearly[currency]}
      cloudBackupMonthly={pricing.cloudBackupMonthly[currency]}
      extraBranchOneTime={pricing.extraBranchOneTime[currency]}
      extraMachineOneTime={pricing.extraMachineOneTime[currency]}
      whatsappUrl={settings.whatsappUrl}
    />
  )
}
