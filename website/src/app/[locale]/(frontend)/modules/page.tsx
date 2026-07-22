import type { Metadata } from 'next'

import { ModulesWebsite } from '@/components/marketing/modules-website'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/modules`

  return {
    title: 'Omnix products — Pharmacy, Retail, Hospitality, Hardware and Salon',
    description: 'Explore five Omnix products: Pharmacy, Retail, Hospitality, Hardware & Equipment, and Salon & Spa. Each is shaped around the work at the counter.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/modules'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Five Omnix products for five kinds of working day',
      description:
        'Choose the Omnix product designed for your pharmacy, shop, hospitality business, hardware operation, or salon and spa.',
      type: 'website',
    }),
  }
}

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const settings = await getSiteSettings()

  return <ModulesWebsite locale={locale} whatsappUrl={settings.whatsappUrl} />
}
