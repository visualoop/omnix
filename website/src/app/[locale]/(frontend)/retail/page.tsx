import type { Metadata } from 'next'

import {
  RetailWebsite,
  type RetailMedia,
  type RetailVideo,
} from '@/components/marketing/retail-website'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSlotImage, getSlotMedia } from '@/lib/media-slots'
import { getPublishedModuleDemoVideo } from '@/lib/module-demo-video'
import { getSiteSettings } from '@/lib/site-settings'
import { SoftwareJsonLd } from '@/components/seo/jsonld'
import { displayCurrencyForLocale } from '@/i18n/routing'
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
  const canonical = `${SITE_URL}/${locale}/retail`
  const isKenya = locale === 'ke'
  const connectedCopy = isKenya ? ', configured M-Pesa and KRA eTIMS workflows' : ''

  return {
    title: `Retail POS and inventory software${isKenya ? ' for Kenyan shops' : ''} · Omnix`,
    description: `Retail POS for barcode sales, product variants, inventory, price lists, loyalty, promotions, layby, shelf labels, purchasing and cash${connectedCopy}.`,
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/retail'),
    },
    keywords: [
      'retail POS',
      'mini-mart POS',
      'barcode POS',
      'retail inventory software',
      'product variants POS',
      'retail price lists',
      'layby software',
      ...(isKenya ? ['retail POS Kenya', 'M-Pesa retail POS', 'KRA eTIMS retail POS'] : []),
    ],
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix Retail POS for the shelf and till',
      description: isKenya
        ? 'Barcode sales, variants, inventory, pricing, purchasing, payments, and configured eTIMS workflows in one Windows retail product.'
        : 'Barcode sales, variants, inventory, pricing, purchasing, and payment records in one offline-first Windows retail product.',
      type: 'website',
    }),
  }
}

export default async function RetailPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()

  let heroImage: RetailMedia | null = null
  let heroVideo: RetailVideo | null = null

  try {
    const [image, video, poster] = await Promise.all([
      getSlotImage('module.retail.hero'),
      getSlotMedia('module.retail.video'),
      getSlotImage('module.retail.video-poster'),
    ])

    heroImage = image ? { url: image.url, alt: image.alt } : null
    heroVideo = video && poster
      ? { url: video.url, alt: video.alt, mimeType: video.mimeType, posterUrl: poster.url }
      : null
  } catch {
    // Licensed media fails closed. The retail demo docket remains useful without it.
  }

  // Admin-managed YouTube demo video (fail-closed: null when unpublished/unavailable).
  const demoVideo = await getPublishedModuleDemoVideo('retail')

  return (
    <>
      <SoftwareJsonLd product="retail" currency={displayCurrencyForLocale(locale)} locale={locale} />
      <RetailWebsite
        locale={locale}
        heroImage={heroImage}
        heroVideo={heroVideo}
        demoVideo={demoVideo}
        whatsappUrl={settings.whatsappUrl}
      />
    </>
  )
}
