import type { Metadata } from 'next'

import {
  PharmacyWebsite,
  type PharmacyMedia,
  type PharmacyVideo,
} from '@/components/marketing/pharmacy-website'
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
  const canonical = `${SITE_URL}/${locale}/pharmacy`

  return {
    title: 'Pharmacy software and pharmacy POS for Kenya · Omnix',
    description:
      'Pharmacy software for dispensing, pharmacy POS, prescriptions and patient records, batch and expiry stock, controlled register, M-Pesa, KRA eTIMS, SHA and private insurance workflows.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/pharmacy'),
    },
    keywords: [
      'pharmacy software Kenya',
      'pharmacy POS Kenya',
      'dispensing software Kenya',
      'batch expiry pharmacy stock',
      'pharmacy prescription records',
      'controlled register pharmacy',
      'M-Pesa pharmacy POS',
      'KRA eTIMS pharmacy',
      'SHA pharmacy billing',
    ],
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Pharmacy software for the counter and dispensary',
      description:
        'Dispensing, pharmacy POS, stock, prescriptions, patient records, payments, tax, and insurance workflows in one desktop product.',
      type: 'website',
    }),
  }
}

export default async function PharmacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()

  let heroImage: PharmacyMedia | null = null
  let heroVideo: PharmacyVideo | null = null

  try {
    const [image, video, poster] = await Promise.all([
      getSlotImage('module.dawa.hero'),
      getSlotMedia('module.dawa.video'),
      getSlotImage('module.dawa.video-poster'),
    ])

    heroImage = image ? { url: image.url, alt: image.alt } : null
    heroVideo = video && poster
      ? { url: video.url, alt: video.alt, mimeType: video.mimeType, posterUrl: poster.url }
      : null
  } catch {
    // Licensed media fails closed. The page's demo docket remains useful without it.
  }

  // Admin-managed YouTube demo video (fail-closed: null when unpublished/unavailable).
  const demoVideo = await getPublishedModuleDemoVideo('pharmacy')

  return (
    <>
      <SoftwareJsonLd product="pharmacy" currency={currencyForCountry(locale)} locale={locale} />
      <PharmacyWebsite
        locale={locale}
        heroImage={heroImage}
        heroVideo={heroVideo}
        demoVideo={demoVideo}
        whatsappUrl={settings.whatsappUrl}
      />
    </>
  )
}
