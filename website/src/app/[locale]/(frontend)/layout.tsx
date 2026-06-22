import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { RootShell } from '@/components/layout/root-shell'
import { routing } from '@/i18n/routing'

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    template: `%s · ${BRAND_NAME}`,
  },
  description:
    'All-in-one ERP for Kenyan businesses. One installer, one fee, every module included. Built in Nairobi for pharmacies, retailers, hardware shops, and hospitality.',
  applicationName: BRAND_NAME,
  authors: [{ name: BRAND_NAME }],
  keywords: [
    'ERP Kenya',
    'POS Kenya',
    'pharmacy software Kenya',
    'KRA eTIMS',
    'M-Pesa POS',
    'NHIF SHA billing',
    'Nairobi business software',
  ],
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: 'Run your duka properly. Offline-first ERP, built in Nairobi.',
    locale: 'en_KE',
  },
  twitter: { card: 'summary_large_image', title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
  icons: { icon: '/favicon.ico' },
  robots: { index: true, follow: true },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
}

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
      <RootShell locale={locale}>
        <SiteHeader isAuthed={isAuthed} />
        <main>{children}</main>
        <SiteFooter />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </RootShell>
    </NextIntlClientProvider>
  )
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
