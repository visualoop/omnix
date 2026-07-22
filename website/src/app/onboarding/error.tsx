'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Onboarding error boundary. Retry, or fall back to the dashboard (the
 * onboarding step is skippable and the account already exists by this point).
 */
export default function OnboardingError({
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
      scope="onboarding"
      homeHref="/dashboard"
      homeLabel="Skip to dashboard"
    />
  )
}
