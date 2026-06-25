import type { Metadata } from 'next'
import { Globe } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Region unavailable',
  robots: { index: false, follow: false },
}

/**
 * Standalone page rendered when a visitor's IP geolocates to a
 * sanctioned country. No nav, no footer, no further CTAs that
 * could lead them around the block — just a plain explanation
 * and a contact link if they think it's an error.
 *
 * Renders under the root layout (app/layout.tsx) which already
 * provides <html>, <body>, fonts, and globals.css.
 */
export default function RegionUnavailablePage() {
  return (
    <main className="min-h-screen grid place-items-center">
      <div className="max-w-md text-center p-8">
        <Globe className="mx-auto size-12 text-[var(--color-fg-subtle)]" />
        <h1 className="mt-6 font-display text-[28px] font-medium">
          We don&apos;t currently serve your region.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-fg-muted)]">
          Omnix is unavailable in your country due to international trade
          restrictions. If you believe this is an error, please get in touch.
        </p>
        <a
          href="mailto:support@omnix.co.ke"
          className="mt-6 inline-block text-[14px] font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          support@omnix.co.ke
        </a>
      </div>
    </main>
  )
}
