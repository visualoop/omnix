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
import { routing } from '@/i18n/routing'
import { getMarketProfile } from '@/config/market-profiles'
import { buildAlternatesLanguages } from '@/lib/hreflang'

/**
 * Per-locale metadata.
 *
 * generateMetadata reads the [locale] segment and emits:
 *   - country-aware title and description for KE/UG/TZ/RW
 *   - a market-specific keyword set (Kenya integrations on /ke only)
 *   - an Open Graph locale that matches the route
 *   - the four launch-market hreflangs plus x-default
 */

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const profile = getMarketProfile(locale)
  const marketLocale = profile.locale
  const c = profile.seo
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
  const altLanguages = buildAlternatesLanguages('/')
  const canonical = `${BRAND.url}/${marketLocale}`
  const social = buildSocialMetadata({
    locale: marketLocale,
    url: canonical,
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
    keywords: [...c.keywords],
    openGraph: social.openGraph,
    twitter: social.twitter,
    icons: { icon: '/favicon.ico' },
    robots: { index: true, follow: true },
    alternates: {
      canonical,
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
