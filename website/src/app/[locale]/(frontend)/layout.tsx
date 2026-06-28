import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { OrgJsonLd } from '@/components/seo/jsonld'
import { WhatsAppWidget } from '@/components/marketing/whatsapp-widget'
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
  'AI for small business', 'point of sale system', 'duka software',
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
  // OG image is admin-editable via the og.default media slot (falls back
  // to the seeded R2 default). Resolved here so social cards update from
  // /admin/media with no redeploy.
  let ogImage = 'https://media.omnix.co.ke/marketing/og-default.jpg'
  try {
    const { getSlotImage } = await import('@/lib/media-slots')
    const og = await getSlotImage('og.default')
    if (og?.url) ogImage = og.url
  } catch {
    /* keep default */
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
  return {
    metadataBase: new URL(BRAND.url),
    title: { default: c.title, template: `%s · ${BRAND_NAME}` },
    description: c.description,
    applicationName: BRAND_NAME,
    authors: [{ name: BRAND_NAME }],
    keywords: c.keywords,
    openGraph: {
      type: 'website',
      siteName: BRAND_NAME,
      title: c.title,
      description: c.description,
      locale: c.ogLocale,
      images: [{ url: ogImage, width: 1200, height: 630, alt: BRAND_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.title,
      description: c.description,
      images: [ogImage],
    },
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
  const messages = await getMessages()

  const gaId = process.env.NEXT_PUBLIC_GA_ID

  // Server-side session probe so the header swaps "Sign in / Start trial"
  // for "Account / Open dashboard" when the visitor is already a signed-in
  // customer. Errors (stale token, server hiccup) treat the visitor as
  // signed-out and show the unauth chrome.
  let isAuthed = false
  try {
    const reqHeaders = await headers()
    const { auth } = await import('@/lib/auth')
    const session = await auth.api.getSession({ headers: reqHeaders })
    isAuthed = !!session
  } catch {
    isAuthed = false
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SiteHeader isAuthed={isAuthed} />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppWidget />
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <OrgJsonLd />
    </NextIntlClientProvider>
  )
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
