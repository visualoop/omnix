'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Localized marketing error boundary. Renders inside the site chrome so a
 * failed content/guide/location page recovers in place instead of falling
 * through to the unstyled global-error. Retry, or head back home. The shared
 * ErrorState distinguishes an offline/network drop from a server fault.
 */
export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState error={error} reset={reset} scope="page" homeHref="/" homeLabel="Back to home" />
}
