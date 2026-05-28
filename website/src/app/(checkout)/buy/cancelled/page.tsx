import Link from 'next/link'
import { ArrowLeft, AlertCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Payment cancelled' }

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; reason?: string }>
}) {
  const { ref, reason } = await searchParams

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pt-12 pb-20">
      <div className="mx-auto max-w-2xl px-6 sm:px-8">
        <div className="rounded-2xl border border-[var(--color-caution)] bg-[var(--color-caution)]/5 p-10 text-center lg:p-14">
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-[var(--color-caution)]/15 text-[var(--color-caution)]">
            <AlertCircle className="size-7" />
          </div>
          <h1 className="mt-6 font-display text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] text-[var(--color-fg)]">
            Payment didn't go through.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-[15px] leading-[1.55] text-[var(--color-fg-muted)]">
            No money was charged. {reason ? translateReason(reason) : "It happens — let's try again."}
          </p>
          {ref ? (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
              Reference {ref}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard/licenses">
              <ArrowLeft className="size-4" />
              Back to licences
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Need help?</Link>
          </Button>
        </div>

        <div className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-fg)]">Common reasons:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You cancelled the M-Pesa STK prompt or didn't enter the PIN in time</li>
            <li>Your card was declined by your bank — try another or call them</li>
            <li>Insufficient balance on the M-Pesa account or card</li>
            <li>Network issue between Paystack and your bank — usually clears in minutes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function translateReason(reason: string): string {
  const map: Record<string, string> = {
    declined: 'Your card was declined. Try another card or call your bank.',
    insufficient_funds: 'Insufficient balance on the source account.',
    timeout: 'The payment prompt timed out before confirmation.',
    cancelled: 'You cancelled the payment.',
  }
  return map[reason] ?? "It happens — let's try again."
}
