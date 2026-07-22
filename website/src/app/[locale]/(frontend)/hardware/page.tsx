import type { Metadata } from 'next'

import {
  HardwareWebsite,
  type HardwareMedia,
  type HardwareVideo,
} from '@/components/marketing/hardware-website'
import { pricing } from '@/config/pricing'
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
  const canonical = `${SITE_URL}/${locale}/hardware`
  const kenyaTerms = locale === 'ke' ? ', configured M-Pesa and KRA eTIMS workflows' : ''

  return {
    title: 'Hardware shop POS, quotations, stock and contractor accounts · Omnix',
    description: `Omnix Hardware & Equipment is Windows desktop software for hardware-shop POS, stock, supplier purchasing, bulk prices, quotations, delivery notes and customer credit${kenyaTerms}.`,
    alternates: { canonical, languages: buildAlternatesLanguages('/hardware') },
    keywords: [
      'hardware shop POS', 'hardware inventory software', 'hardware quotations software',
      'contractor account software', 'delivery note software', 'bulk pricing software',
      ...(locale === 'ke' ? ['hardware shop POS Kenya', 'M-Pesa hardware POS', 'KRA eTIMS hardware shop'] : []),
    ],
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Hardware & Equipment for the counter, stockroom and trade account',
      description:
        'Hardware-shop POS, stock, purchasing, bulk prices, quotations, delivery notes and contractor credit in one Windows desktop product.',
      type: 'website',
    }),
  }
}

export default async function HardwarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()
  let heroImage: HardwareMedia | null = null
  let heroVideo: HardwareVideo | null = null

  try {
    const [image, video, poster] = await Promise.all([
      getSlotImage('module.hardware.hero'),
      getSlotMedia('module.hardware.video'),
      getSlotImage('module.hardware.video-poster'),
    ])
    heroImage = image ? { url: image.url, alt: image.alt } : null
    heroVideo = video && poster
      ? { url: video.url, alt: video.alt, mimeType: video.mimeType, posterUrl: poster.url }
      : null
  } catch {
    // Approved media fails closed; the page keeps a useful no-media demo docket.
  }

  // Admin-managed YouTube demo video (fail-closed: null when unpublished/unavailable).
  const demoVideo = await getPublishedModuleDemoVideo('hardware')

  return (
    <>
      <SoftwareJsonLd product="hardware" currency={currencyForCountry(locale)} locale={locale} />
      <HardwareWebsite
        locale={locale}
        heroImage={heroImage}
        heroVideo={heroVideo}
        demoVideo={demoVideo}
        licencePriceKes={pricing.starter.oneTimeFee.KES}
        whatsappUrl={settings.whatsappUrl}
      />
    </>
  )
}
