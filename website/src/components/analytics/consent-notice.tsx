'use client'

/**
 * Analytics consent notice — Working Counter identity.
 *
 * A compact, non-modal notice pinned to the lower-left. It never blocks the
 * page, never traps focus, and offers two equally weighted choices: "Accept
 * analytics" and "No thanks". No pre-selected option, no nagging, no dark
 * pattern. The choice persists in localStorage only (handled upstream).
 *
 * When opened from the footer "Analytics preferences" control it also shows a
 * Close action and reflects the current setting. When a browser privacy signal
 * (Do Not Track / Global Privacy Control) is active it explains, minimally,
 * that analytics stays off and does not offer an enable button — the signal is
 * honoured, not overridden.
 *
 * The notice appears without an entrance animation so the consent boundary adds
 * no animation runtime to every public page.
 */
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { ConsentState } from '@/lib/analytics/consent'

export interface AnalyticsConsentNoticeProps {
  privacyHref: string
  privacySignal: boolean
  preferences: boolean
  currentChoice: ConsentState
  onAccept: () => void
  onDecline: () => void
  onClose: () => void
}

export function AnalyticsConsentNotice({
  privacyHref,
  privacySignal,
  preferences,
  currentChoice,
  onAccept,
  onDecline,
  onClose,
}: AnalyticsConsentNoticeProps) {
  return (
    <section
      role="region"
      aria-label="Analytics choice"
      data-analytics-consent
      data-state={privacySignal ? 'privacy-signal' : preferences ? 'preferences' : 'prompt'}
      className="fixed bottom-20 left-4 right-4 z-40 max-w-[27rem] rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-5 shadow-[0_1px_0_var(--color-border)] sm:bottom-5 sm:left-5 sm:right-auto print:hidden"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
        Analytics
      </p>

      {privacySignal ? (
        <>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-fg-muted)]">
            Your browser sends a Do Not Track signal, so Omnix analytics stays off. You do not
            need to do anything, and this has no effect on the product, your purchase, or support.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Link
              href={privacyHref}
              className="text-[12px] text-[var(--color-fg-subtle)] underline underline-offset-4 hover:text-[var(--color-fg)]"
            >
              What we measure
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-[13px] leading-6 text-[var(--color-fg-muted)]">
            Can we measure anonymous page visits? It shows us which pages help people choose Omnix.
            Nothing personal is sent, and the analytics script loads only if you accept.
          </p>
          {preferences && currentChoice !== 'unset' ? (
            <p className="mt-2 text-[12px] text-[var(--color-fg-subtle)]">
              Analytics is currently {currentChoice === 'granted' ? 'on' : 'off'}.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button type="button" size="sm" onClick={onAccept}>
              Accept analytics
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDecline}>
              No thanks
            </Button>
            {preferences ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Close
              </Button>
            ) : null}
            <Link
              href={privacyHref}
              className="ml-auto text-[12px] text-[var(--color-fg-subtle)] underline underline-offset-4 hover:text-[var(--color-fg)]"
            >
              What we measure
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
