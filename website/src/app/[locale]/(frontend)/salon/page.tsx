import type { Metadata } from 'next'

import { SalonWebsite, type SalonMedia, type SalonVideo } from '@/components/marketing/salon-website'
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/salon`
  const kenyaTerms = locale === 'ke' ? ', configured M-Pesa and KRA eTIMS workflows' : ''

  return {
    title: 'Salon appointment diary, POS, packages and commissions · Omnix',
    description: `Omnix Salon & Spa is Windows desktop software for staff-entered local appointments, services, client history, packages, commissions, checkout and stock${kenyaTerms}. Public internet self-booking is not included.`,
    alternates: { canonical, languages: buildAlternatesLanguages('/salon') },
    keywords: [
      'salon appointment software', 'salon POS', 'spa booking diary', 'salon commission software',
      'salon package software', 'beauty salon client history', 'salon stock software',
      ...(locale === 'ke' ? ['salon POS Kenya', 'spa software Kenya', 'M-Pesa salon POS', 'KRA eTIMS salon'] : []),
    ],
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Salon & Spa for appointments, checkout, and the working day',
      description:
        'A local Windows appointment diary with services, staff skills, resources, client history, packages, commissions, POS checkout, and stock records.',
      type: 'website',
    }),
  }
}

export default async function SalonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()
  let heroImage: SalonMedia | null = null
  let heroVideo: SalonVideo | null = null

  try {
    const [image, video, poster] = await Promise.all([
      getSlotImage('module.salon.hero'),
      getSlotMedia('module.salon.video'),
      getSlotImage('module.salon.video-poster'),
    ])
    heroImage = image ? { url: image.url, alt: image.alt } : null
    heroVideo = video && poster
      ? { url: video.url, alt: video.alt, mimeType: video.mimeType, posterUrl: poster.url }
      : null
  } catch {
    // Approved media fails closed; the useful demo docket remains visible.
  }

  // Admin-managed YouTube demo video (fail-closed: null when unpublished/unavailable).
  const demoVideo = await getPublishedModuleDemoVideo('salon')

  return (
    <>
      <SoftwareJsonLd product="salon" currency={currencyForCountry(locale)} locale={locale} />
      <SalonWebsite locale={locale} heroImage={heroImage} heroVideo={heroVideo} demoVideo={demoVideo} whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
