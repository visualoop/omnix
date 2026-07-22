'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Auth route-group error boundary. Keeps the sign-in / sign-up flow on a
 * styled, recoverable surface. Retry, or fall back to the login page.
 */
export default function AuthError({
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
      scope="sign-in"
      homeHref="/login"
      homeLabel="Back to sign in"
    />
  )
}
