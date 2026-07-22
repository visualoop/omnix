'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw } from '@/components/icons'
import { Button } from '@/components/ui/button'

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, so
 * it must render its own <html>/<body> and cannot rely on globals.css having
 * loaded. The inline styles are the Working Counter light-first palette
 * (receipt paper + ledger ink), so the fallback still looks on-brand even if
 * the stylesheet failed. Never renders error.message (PII/secret-safe); only
 * the opaque digest reference, plus retry + support so it is never a dead end.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 py-20 text-[var(--color-fg)]"
        style={{
          // Inline light-first palette in case globals.css failed to load.
          backgroundColor: '#FAFAF7',
          color: '#171713',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main className="text-center">
          <div
            className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: '#A33A2A' }}
          >
            500 — Unexpected error
          </div>
          <h1 className="mt-4 font-display text-[clamp(32px,6vw,56px)] font-medium leading-[1.05] tracking-[-0.02em]">
            We hit a snag.
          </h1>
          <p
            className="mx-auto mt-4 max-w-md text-balance text-[16px] leading-[1.55]"
            style={{ color: '#57564F' }}
          >
            The error has been logged. Try again, or reach out if it keeps happening.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-[11px]" style={{ color: '#747168' }}>
              Reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button onClick={() => reset()} size="lg">
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Contact support</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}
