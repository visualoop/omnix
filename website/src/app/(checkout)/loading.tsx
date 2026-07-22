import { LoadingState, SkeletonBar } from '@/components/ui/loading-skeleton'

/**
 * Checkout route-group loading state. Streams while the buy pages resolve the
 * owned licence + live Paystack status server-side. Structural only — no fake
 * price, no fake receipt — so nothing about the order is implied before it is
 * verified.
 */
export default function CheckoutLoading() {
  return (
    <LoadingState label="Loading checkout…" className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="space-y-6">
        <SkeletonBar className="mx-auto h-14 w-14 rounded-[var(--radius-pill)]" />
        <div className="space-y-3 text-center">
          <SkeletonBar className="mx-auto h-8 w-72 max-w-full" />
          <SkeletonBar className="mx-auto h-4 w-96 max-w-full" />
        </div>
        <SkeletonBar className="h-40 w-full rounded-[var(--radius-lg)]" />
      </div>
    </LoadingState>
  )
}
