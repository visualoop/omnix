import { Fraunces, Geist, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'

// Single source of truth for the root html/body + globals.css + fonts.
// Every route-group layout (frontend, auth, dashboard, checkout, …) wraps
// its content in <RootShell> so Tailwind, fonts, and base body styling
// apply uniformly. New route groups should NEVER duplicate this setup —
// just call <RootShell>{children}</RootShell>.
//
// The (payload) admin group is the only exception: it uses Payload's own
// RootLayout (which provides its own html/body), so it must NOT use this.
import '../../app/(frontend)/globals.css'

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

export const FONT_VARIABLES = `${fraunces.variable} ${geist.variable} ${jakarta.variable} ${jetbrainsMono.variable}`

/**
 * Provides html, body, fonts, and globals.css for any route-group layout.
 *
 * Usage:
 *   export default function FooLayout({ children }) {
 *     return <RootShell>{children}</RootShell>
 *   }
 *
 * Add chrome (header/footer/sidebar) as children inside the wrapper:
 *   return (
 *     <RootShell>
 *       <SiteHeader />
 *       <main>{children}</main>
 *       <SiteFooter />
 *     </RootShell>
 *   )
 */
export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={FONT_VARIABLES}>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-fg)] antialiased">
        {children}
      </body>
    </html>
  )
}
