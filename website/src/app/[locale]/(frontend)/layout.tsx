import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { OrgJsonLd } from '@/components/seo/jsonld'
import { WhatsAppWidget } from '@/components/marketing/whatsapp-widget'
import { SiteAnalytics } from '@/components/analytics/site-analytics'
import { resolveGaId } from '@/lib/analytics/ga'
import { routing, COUNTRY_LOCALES } from '@/i18n/routing'

/**
 * Per-locale metadata.
 *
 * Was: a single static `metadata` block with Kenya-specific copy and
 * og:locale='en_KE' served on every locale, hurting search relevance for
 * /us, /gb, /in, /ng, /gh, /za visitors.
 *
 * Now: generateMetadata reads the [locale] segment and emits
 *   - country-aware title + description
 *   - country-specific keyword set (Kenya keywords on /ke only)
 *   - og:locale that matches the country
 *   - alternates.languages for hreflang (one entry per country locale + x-default)
 */

interface LocaleCopy {
  title: string
  description: string
  ogLocale: string
  keywords: string[]
}

const KENYA_KEYWORDS = [
  'POS with M-Pesa', 'M-Pesa POS', 'POS system Kenya', 'Lipa na M-Pesa POS',
  'M-Pesa STK push POS', 'Paybill POS', 'Till number POS', 'Buy Goods POS',
  'KRA eTIMS POS', 'eTIMS receipt', 'pharmacy POS Kenya', 'restaurant POS Kenya',
  'hardware POS Kenya', 'retail POS Kenya', 'offline POS Kenya', 'duka POS',
  'pharmacy software Kenya', 'NHIF SHA billing', 'POS software Nairobi',
]
const GLOBAL_KEYWORDS = [
  'POS software', 'small business POS', 'pharmacy POS',
  'retail POS', 'restaurant POS', 'bar POS', 'mini-mart POS',
  'hardware store software', 'offline POS', 'inventory management software',
  'point of sale system', 'duka software',
]
const NIGERIA_KEYWORDS = ['POS Nigeria', 'pharmacy software Nigeria', 'restaurant POS Nigeria', 'Lagos POS', 'FIRS compliance']
const GHANA_KEYWORDS = ['POS Ghana', 'pharmacy software Ghana', 'restaurant POS Ghana', 'Accra POS']
const SOUTH_AFRICA_KEYWORDS = ['POS South Africa', 'pharmacy software South Africa', 'restaurant POS South Africa', 'SARS compliance', 'Johannesburg POS']
const INDIA_KEYWORDS = ['POS India', 'small business POS India', 'pharmacy software India', 'GST POS software']

const LOCALE_COPY: Record<string, LocaleCopy> = {
  ke: {
    title: `${BRAND_NAME} — POS with M-Pesa for Kenyan businesses · eTIMS, pharmacy, retail, hospitality`,
    description: 'POS with M-Pesa for Kenyan businesses. Lipa na M-Pesa (STK push, Paybill & Till), KRA eTIMS receipts, inventory and SHA insurance billing — built in. Works offline. Pay once, no subscription.',
    ogLocale: 'en_KE',
    keywords: KENYA_KEYWORDS,
  },
  us: {
    title: `${BRAND_NAME} — Offline POS & business software for small business`,
    description: 'Offline-first POS and business software for pharmacies, retail, restaurants, bars and hardware stores. One-time licence, perpetual ownership, no subscription. Windows.',
    ogLocale: 'en_US',
    keywords: GLOBAL_KEYWORDS,
  },
  gb: {
    title: `${BRAND_NAME} — Offline POS & business software for SMEs`,
    description: 'Offline-first POS and business software for pharmacies, retail, hospitality and hardware. One-time licence, no monthly subscription. Runs on Windows.',
    ogLocale: 'en_GB',
    keywords: GLOBAL_KEYWORDS,
  },
  ng: {
    title: `${BRAND_NAME} — POS & business software for Nigerian SMEs`,
    description: 'Offline-first POS and business software for Nigerian pharmacies, retail shops, restaurants, bars and hardware stores. Pay once, use forever.',
    ogLocale: 'en_NG',
    keywords: [...NIGERIA_KEYWORDS, ...GLOBAL_KEYWORDS],
  },
  gh: {
    title: `${BRAND_NAME} — POS & business software for Ghanaian SMEs`,
    description: 'Offline-first POS and business software for Ghanaian retailers, pharmacies, restaurants and bars. One-time licence, no recurring fees.',
    ogLocale: 'en_GH',
    keywords: [...GHANA_KEYWORDS, ...GLOBAL_KEYWORDS],
  },
  za: {
    title: `${BRAND_NAME} — POS & business software for South African SMEs`,
    description: 'Offline-first POS and business software for South African pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_ZA',
    keywords: [...SOUTH_AFRICA_KEYWORDS, ...GLOBAL_KEYWORDS],
  },
  in: {
    title: `${BRAND_NAME} — Offline POS & business software for Indian SMEs`,
    description: 'Offline-first POS and business software for Indian retailers, pharmacies, restaurants and small businesses. One-time licence, no monthly fees.',
    ogLocale: 'en_IN',
    keywords: [...INDIA_KEYWORDS, ...GLOBAL_KEYWORDS],
  },
  rw: {
    title: `${BRAND_NAME} — POS & business software for Rwandan SMEs`,
    description: 'Offline-first POS and business software for Rwandan pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_RW',
    keywords: GLOBAL_KEYWORDS,
  },
  tz: {
    title: `${BRAND_NAME} — POS & business software for Tanzanian SMEs`,
    description: 'Offline-first POS and business software for Tanzanian pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_TZ',
    keywords: GLOBAL_KEYWORDS,
  },
  ug: {
    title: `${BRAND_NAME} — POS & business software for Ugandan SMEs`,
    description: 'Offline-first POS and business software for Ugandan pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_UG',
    keywords: GLOBAL_KEYWORDS,
  },
  eg: {
    title: `${BRAND_NAME} — POS & business software for Egyptian SMEs`,
    description: 'Offline-first POS and business software for Egyptian pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_EG',
    keywords: GLOBAL_KEYWORDS,
  },
  ae: {
    title: `${BRAND_NAME} — Offline POS & business software for UAE SMEs`,
    description: 'Offline-first POS and business software for UAE pharmacies, retail, restaurants, bars and hardware stores. Pay once, own forever.',
    ogLocale: 'en_AE',
    keywords: GLOBAL_KEYWORDS,
  },
}

function copyFor(locale: string): LocaleCopy {
  return LOCALE_COPY[locale] ?? LOCALE_COPY.us
}

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const c = copyFor(locale)
  // Social media may use an approved licensed asset. Without one, the shared
  // helper falls back to the first-party generated /api/og card rather than an
  // unverified remote default. We only resolve the approved URL/alt here; the
  // helper fills in siteName, og:locale, dimensions, and the Twitter card.
  let approvedOg: string | undefined
  let approvedOgAlt: string | undefined
  try {
    const { getSlotImage } = await import('@/lib/media-slots')
    const og = await getSlotImage('og.default')
    if (og) {
      approvedOg = og.url
      approvedOgAlt = og.alt
    }
  } catch {
    /* fall back to the generated card */
  }
  // Valid BCP-47 hreflang codes (en-KE, not bare 'ke') so Google accepts
  // the alternates. Each country route still resolves to its /xx URL.
  const HREFLANG: Record<string, string> = {
    ke: 'en-KE', us: 'en-US', gb: 'en-GB', ng: 'en-NG', gh: 'en-GH',
    za: 'en-ZA', in: 'en-IN', rw: 'en-RW', tz: 'en-TZ', ug: 'en-UG',
    eg: 'en-EG', ae: 'en-AE',
  }
  const altLanguages: Record<string, string> = Object.fromEntries(
    COUNTRY_LOCALES.map((cc) => [HREFLANG[cc] ?? `en-${cc.toUpperCase()}`, `${BRAND.url}/${cc}`]),
  )
  altLanguages['x-default'] = `${BRAND.url}/ke`
  const social = buildSocialMetadata({
    locale,
    url: `${BRAND.url}/${locale}`,
    title: c.title,
    description: c.description,
    type: 'website',
    image: approvedOg,
    imageAlt: approvedOgAlt,
  })
  return {
    metadataBase: new URL(BRAND.url),
    title: { default: c.title, template: `%s · ${BRAND_NAME}` },
    description: c.description,
    applicationName: BRAND_NAME,
    authors: [{ name: BRAND_NAME }],
    keywords: c.keywords,
    openGraph: social.openGraph,
    twitter: social.twitter,
    icons: { icon: '/favicon.ico' },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BRAND.url}/${locale}`,
      languages: altLanguages,
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    },
  }
}

void BRAND_TAGLINE

export default async function FrontendLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)
  const nav = await getTranslations('nav')

  const gaId = resolveGaId(process.env.NEXT_PUBLIC_GA_ID)
  const { getSiteSettings } = await import('@/lib/site-settings')
  const siteSettings = await getSiteSettings()

  // No per-request session probe here on purpose. The marketing shell must be
  // identical for every visitor so public pages stay cacheable at the edge and
  // are never personalized. The header renders its stable public actions
  // ("Book a demo" + "Sign in"); signed-in customers reach their account chrome
  // from the dashboard/account shells, which keep their own auth checks.

  return (
    <>
      <SiteHeader locale={locale} signInLabel={nav('signIn')} />
      <main id="main-content" className="min-w-0">{children}</main>
      <SiteFooter locale={locale} settings={siteSettings} />
      {siteSettings.whatsappUrl ? (
        <WhatsAppWidget whatsappUrl={siteSettings.whatsappUrl} locale={locale} />
      ) : null}
      {gaId ? <SiteAnalytics gaId={gaId} privacyHref={`/${locale}/privacy`} /> : null}
      <OrgJsonLd />
    </>
  )
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
