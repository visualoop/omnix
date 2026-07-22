import Link from 'next/link'
import { AlertCircle, ArrowLeft } from '@/components/icons'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Payment cancelled', robots: { index: false } }

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; reason?: string }>
}) {
  const { ref, reason } = await searchParams

  return (
    <div className="px-6 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <section
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-lg)] border border-[var(--color-caution)]/35 bg-[var(--color-caution)]/8 p-8 text-center sm:p-10"
        >
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-caution)]/15 text-[var(--color-caution)]">
            <AlertCircle className="size-7" />
          </div>
          <h1 className="mt-6 font-display text-[clamp(1.6rem,3.5vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--color-fg)]">
            Payment didn&rsquo;t go through.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-[15px] leading-[1.6] text-[var(--color-fg-muted)]">
            No money was charged. {reason ? translateReason(reason) : 'It happens — you can try again whenever you\u2019re ready.'}
          </p>
          {ref ? (
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
              <span className="font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Ref</span>
              {ref}
            </div>
          ) : null}
        </section>

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

        <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-fg)]">Common reasons:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You closed the M-Pesa STK prompt or didn&rsquo;t enter the PIN in time</li>
            <li>Your card was declined by your bank — try another or call them</li>
            <li>Insufficient balance on the M-Pesa account or card</li>
            <li>A network issue between Paystack and your bank — usually clears in minutes</li>
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
    cancelled: 'You closed the payment window.',
  }
  return map[reason] ?? 'It happens — you can try again whenever you\u2019re ready.'
}
