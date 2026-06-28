/**
 * Root layout for the entire Next.js app.
 *
 * Provides <html>, <body>, every Google Font, and the Tailwind v4 stylesheet
 * import. Every nested route-group layout (frontend, auth, dashboard,
 * checkout, admin, onboarding) renders its own chrome on top of this; none
 * of them need to re-declare html/body or re-import globals.css.
 *
 * Why root: Next.js requires a single root layout. Putting one here means
 * any new top-level page (e.g. /signup, /onboarding, /something-new)
 * automatically inherits Tailwind + fonts without the author having to
 * remember to wrap in a shell component.
 *
 * Per-locale RTL/`dir` handling: the LTR languages we currently ship
 * (en, en-KE, en-US, en-GB, sw, etc.) don't need dir overrides. If we
 * ever add Arabic, the [locale] segment can set it via its own <html>
 * attributes through Next's metadata API or a per-locale wrapper.
 */
import type { Metadata } from 'next'
import { Fraunces, Geist, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/theme-provider'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
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
  // Per-locale metadata is generated in [locale]/(frontend)/layout.tsx;
  // this is just the fallback for routes that don't live under a locale
  // segment (e.g. /login, /onboarding, /buy, /admin/*, /dashboard/*).
  title: { default: 'Omnix', template: '%s · Omnix' },
}

const FONT_VARIABLES = `${fraunces.variable} ${geist.variable} ${jakarta.variable} ${jetbrainsMono.variable}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={FONT_VARIABLES}>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-fg)] antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
