import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-logo'
import { Lock } from '@/components/icons'
import type { Metadata } from 'next'

/**
 * Checkout route-group chrome.
 *
 * /buy, /buy/[licenseId], /buy/success, /buy/cancelled share one quiet
 * counter header — brand mark + a plain "secure checkout" marker — and no
 * marketing footer, so the payment flow stays distraction-free. The
 * Working Counter system (light-first surfaces, one copper accent,
 * rounded controls) is inherited from the root layout; nothing new is
 * introduced here.
 */

// Checkout is a private payment flow (protected installer + Paystack) and must
// never be indexed. robots.ts also disallows /buy — this is defence in depth.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-[var(--color-bg)]">
      {/* Keyboard/screen-reader users skip the counter header straight to checkout. */}
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-[var(--radius-pill)] bg-[var(--color-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--color-bg)] focus:not-sr-only"
      >
        Skip to main content
      </a>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link
            href="/dashboard"
            className="rounded-[var(--radius-sm)] text-[18px] text-[var(--color-fg)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            aria-label="Omnix — back to dashboard"
          >
            <BrandWordmark />
          </Link>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
            <Lock className="size-3 text-[var(--color-accent)]" />
            Secure checkout
          </span>
        </div>
      </header>
      <main id="main-content" className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
