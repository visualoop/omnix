import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { RootShell } from '@/components/layout/root-shell'

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

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  return (
    <RootShell>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </RootShell>
  )
}
