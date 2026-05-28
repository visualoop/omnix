'use client'

import Link from 'next/link'
import { RefreshCw } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 py-20 text-[var(--color-fg)]"
        style={{
          // Inline minimal palette in case globals.css fails to load
          backgroundColor: '#0a0a0b',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div className="text-center">
          <div className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--color-negative)]">
            500 — Something went wrong
          </div>
          <h1 className="mt-4 font-display text-[clamp(36px,6vw,64px)] font-medium leading-[1.05] tracking-[-0.02em]">
            We hit a snag.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-[16px] leading-[1.55] text-[var(--color-fg-muted)]">
            The error has been logged. Try again, or reach out if it keeps happening.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-[11px] text-[var(--color-fg-subtle)]">
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
        </div>
      </body>
    </html>
  )
}
