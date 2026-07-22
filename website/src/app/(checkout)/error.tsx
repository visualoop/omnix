'use client'

import { ErrorState } from '@/components/ui/error-state'

/**
 * Checkout route-group error boundary.
 *
 * A fault here must never imply a charge happened. The copy is deliberately
 * neutral about money — it points the buyer at their dashboard (the source of
 * truth for licences + payments) and offers a retry. The shared ErrorState
 * also distinguishes an offline/network failure (the buyer's connection
 * dropped) from a server-side fault where it can tell them apart.
 */
export default function CheckoutError({
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
      scope="checkout"
      description="We couldn’t load this checkout step. No extra charge is made by retrying — your licences and payments are always listed in your dashboard."
      homeHref="/dashboard/licenses"
      homeLabel="Go to dashboard"
    />
  )
}
