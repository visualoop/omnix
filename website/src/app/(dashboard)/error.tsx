'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, TriangleAlert } from '@/components/icons'
import { Button } from '@/components/ui/button'

/**
 * Dashboard route-group error boundary.
 *
 * Catches any unhandled error thrown by the dashboard layout / pages so
 * the user lands on a styled, recoverable error UI instead of the
 * unstyled global-error fallback. Also gives them a fast path to
 * /login (clears any stale session) and /support.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to whatever client-side logger is configured.
    if (typeof window !== 'undefined') {
      console.error('[dashboard error boundary]', error)
    }
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-128px)] items-center justify-center px-6 py-20">
      <div className="text-center max-w-md">
        <TriangleAlert className="mx-auto size-10 text-[var(--color-negative)]" />
        <div className="mt-5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-negative)]">
          Dashboard error
        </div>
        <h1 className="mt-3 font-display text-[28px] font-medium leading-tight text-[var(--color-fg)]">
          We hit a snag loading your dashboard.
        </h1>
        <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
          The error has been logged. The most common cause is a stale session — sign out and back in to refresh.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-[var(--color-fg-subtle)]">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} size="default">
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Button asChild size="default" variant="outline">
            <Link href="/login?next=/dashboard">
              <ArrowLeft className="size-4" />
              Sign in again
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-[12px] text-[var(--color-fg-subtle)]">
          Still stuck?{' '}
          <Link href="/contact" className="underline-offset-4 hover:underline">
            Contact support
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
