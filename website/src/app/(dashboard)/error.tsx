'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Dashboard route-group error boundary.
 *
 * Catches any unhandled error thrown by the dashboard layout / pages so the
 * user lands on a styled, recoverable UI instead of the unstyled global-error
 * fallback. The most common cause is a stale session, so the safe-navigation
 * escape points at /login (which clears any stale cookie and returns here).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      scope="dashboard"
      description="The error has been logged. The most common cause is a stale session — sign in again to refresh, or retry."
      secondaryHref="/login?reason=session-expired&next=/dashboard"
      secondaryLabel="Sign in again"
    />
  )
}
