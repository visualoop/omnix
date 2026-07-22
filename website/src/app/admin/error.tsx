'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Operator console error boundary. Complements admin/loading.tsx so an
 * unhandled error inside the console lands on a styled, recoverable surface
 * instead of the unstyled global-error fallback. Retry, or fall back to the
 * console home. No error.message is rendered (operator data / PII safe).
 */
export default function AdminError({
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
      scope="operator console"
      homeHref="/admin"
      homeLabel="Back to console"
    />
  )
}
