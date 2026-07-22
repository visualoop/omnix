import type { Metadata } from 'next'

import {
  HospitalityWebsite,
  type HospitalityMedia,
  type HospitalityVideo,
} from '@/components/marketing/hospitality-website'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSlotImage, getSlotMedia } from '@/lib/media-slots'
import { getPublishedModuleDemoVideo } from '@/lib/module-demo-video'
import { getSiteSettings } from '@/lib/site-settings'
import { SoftwareJsonLd } from '@/components/seo/jsonld'
import { currencyForCountry } from '@/lib/currency'
import { setRequestLocale } from 'next-intl/server'

// No force-dynamic: this product page has no request-specific input (locale is
// a route param) and its DB-backed public content (site settings, approved
// media, published module demo video) revalidates on the bounded ISR window.
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/hospitality`
  const isKenya = locale === 'ke'
  const connectedCopy = isKenya ? ', configured M-Pesa, and KRA eTIMS workflows' : ''

  return {
    title: 'Restaurant POS, kitchen orders, rooms and bookings · Omnix Hospitality',
    description: `Hospitality software for restaurant POS, tables, KOT and kitchen orders, recipe costing, stock, rooms, bookings, guest folios${connectedCopy}.`,
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/hospitality'),
    },
    keywords: [
      'restaurant POS',
      'restaurant POS Kenya',
      'KOT kitchen order software',
      'restaurant table management',
      'recipe costing software',
      'hotel room booking software',
      'guest folio software',
      'hospitality stock software',
      ...(isKenya ? ['M-Pesa restaurant POS', 'KRA eTIMS restaurant POS'] : []),
    ],
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Hospitality for the table, kitchen, and guest stay',
      description:
        'Restaurant POS, tables, KOT and kitchen orders, recipe costing, stock, rooms, bookings, and guest folios in one Windows desktop product.',
      type: 'website',
    }),
  }
}

export default async function HospitalityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()

  let heroImage: HospitalityMedia | null = null
  let heroVideo: HospitalityVideo | null = null

  try {
    const [image, video, poster] = await Promise.all([
      getSlotImage('module.hospitality.hero'),
      getSlotMedia('module.hospitality.video'),
      getSlotImage('module.hospitality.video-poster'),
    ])

    heroImage = image ? { url: image.url, alt: image.alt } : null
    heroVideo = video && poster
      ? { url: video.url, alt: video.alt, mimeType: video.mimeType, posterUrl: poster.url }
      : null
  } catch {
    // Licensed media fails closed. The service-pass demo docket remains useful without it.
  }

  // Admin-managed YouTube demo video (fail-closed: null when unpublished/unavailable).
  const demoVideo = await getPublishedModuleDemoVideo('hospitality')

  return (
    <>
      <SoftwareJsonLd product="hospitality" currency={currencyForCountry(locale)} locale={locale} />
      <HospitalityWebsite
        locale={locale}
        heroImage={heroImage}
        heroVideo={heroVideo}
        demoVideo={demoVideo}
        whatsappUrl={settings.whatsappUrl}
      />
    </>
  )
}
