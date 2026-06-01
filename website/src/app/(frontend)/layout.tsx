import type { Metadata } from 'next'
import { Fraunces, Geist, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'

import { BRAND, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

import './globals.css'

/**
 * Type stack — picked deliberately to NOT look like every SaaS:
 *  - Fraunces (display): variable serif with optical sizing + italic — editorial,
 *    not the Inter+Space Grotesk default. One italic word per headline.
 *  - Geist (body): Vercel's premium sans, replaces Inter.
 *  - Plus Jakarta Sans (UI): per ui-ux-pro-max generator recommendation,
 *    used in narrow places like nav, labels, eyebrows.
 *  - JetBrains Mono (numbers/code): tabular-nums-friendly mono.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // Fraunces is a variable font — omit `weight` to enable the full variable
  // weight axis (100..900) alongside the SOFT/WONK/opsz custom axes.
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
})

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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geist.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-fg)] antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
