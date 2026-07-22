import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Hourglass,
  KeyRound,
  Lifebuoy,
  TriangleAlert,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { CheckoutView } from '@/lib/checkout-status'

interface CheckoutOutcomeProps {
  view: CheckoutView
  /** Opaque Paystack reference, shown for the buyer's records only. */
  reference?: string | null
  /** Catalogue product name, only rendered once ownership is verified. */
  productName?: string | null
  /** Assisted-installation contact (WhatsApp or mailto), already resolved. */
  supportHref?: string
  supportLabel?: string
}

/**
 * Confirmation / receipt surface for the checkout flow.
 *
 * Purely presentational: the caller derives `view` server-side from the
 * owned payment row (+ a live Paystack verify) — this component never
 * decides success on its own. Each state is an accessible region:
 * `success`/`pending`/`unknown` announce politely, `failed` announces
 * assertively. Installer and licence actions appear only in `success`,
 * i.e. only after verified ownership.
 */
export function CheckoutOutcome({
  view,
  reference = null,
  productName = null,
  supportHref,
  supportLabel = 'Book assisted installation',
}: CheckoutOutcomeProps) {
  return (
    <div data-checkout-view={view} className="min-w-0">
      {view === 'success' ? (
        <SuccessPanel
          reference={reference}
          productName={productName}
          supportHref={supportHref}
          supportLabel={supportLabel}
        />
      ) : view === 'pending' ? (
        <PendingPanel reference={reference} />
      ) : view === 'failed' ? (
        <FailedPanel reference={reference} />
      ) : (
        <UnknownPanel />
      )}
    </div>
  )
}

function ReferenceChip({ reference }: { reference: string }) {
  return (
    <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-1.5 font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
      <span className="font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">Ref</span>
      {reference}
    </div>
  )
}

function OutcomeHeader({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'success' | 'pending' | 'failed' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  const ring =
    tone === 'success'
      ? 'border-[var(--color-accent-line)] bg-[var(--color-accent-soft)]'
      : tone === 'failed'
        ? 'border-[var(--color-negative)]/35 bg-[var(--color-negative)]/8'
        : tone === 'pending'
          ? 'border-[var(--color-info)]/30 bg-[var(--color-info)]/8'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
  const badge =
    tone === 'success'
      ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
      : tone === 'failed'
        ? 'bg-[var(--color-negative)] text-white'
        : tone === 'pending'
          ? 'bg-[var(--color-info)] text-white'
          : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]'

  return (
    <div className={`rounded-[var(--radius-lg)] border ${ring} p-8 text-center sm:p-10`}>
      <div className={`mx-auto inline-flex size-14 items-center justify-center rounded-[var(--radius-pill)] ${badge}`}>
        <Icon className="size-7" />
      </div>
      <h1 className="mt-6 font-display text-[clamp(1.6rem,3.5vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--color-fg)]">
        {title}
      </h1>
      <div className="mx-auto mt-3 max-w-xl text-balance text-[15px] leading-[1.6] text-[var(--color-fg-muted)]">
        {children}
      </div>
    </div>
  )
}

function SuccessPanel({
  reference,
  productName,
  supportHref,
  supportLabel,
}: {
  reference: string | null
  productName: string | null
  supportHref?: string
  supportLabel: string
}) {
  return (
    <section aria-labelledby="checkout-outcome-title" aria-live="polite">
      <div id="checkout-outcome-title">
        <OutcomeHeader tone="success" icon={CheckCircle2} title="Payment confirmed.">
          Your {productName ? <strong className="text-[var(--color-fg)]">{productName}</strong> : 'Omnix'} licence
          is active. We&rsquo;ve emailed the receipt and licence key, and your licence key stays in your dashboard.
        </OutcomeHeader>
      </div>

      {reference ? (
        <div className="text-center">
          <ReferenceChip reference={reference} />
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        <NextStep
          icon={Download}
          title="Download the installer"
          body="Get Omnix for Windows from your dashboard — only your verified products appear there."
          cta="Open downloads"
          href="/dashboard/downloads"
        />
        <NextStep
          icon={KeyRound}
          title="Manage your licence"
          body="Your licence key, activated machines and seats, all in one place."
          cta="Open dashboard"
          href="/dashboard/licenses"
        />
        <NextStep
          icon={Lifebuoy}
          title="Prefer we set it up?"
          body="Request assisted installation and we&rsquo;ll walk through setup with you."
          cta={supportLabel}
          href={supportHref ?? '/contact'}
          external={Boolean(supportHref && !supportHref.startsWith('/'))}
        />
      </div>

      <p className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center text-[12px] leading-[1.6] text-[var(--color-fg-muted)]">
        Payment is confirmed online through Paystack; installer downloads unlock here now that your ownership is
        verified. Your licence is <strong className="text-[var(--color-fg)]">perpetual</strong> — optional compliance
        updates are billed separately and are not required to keep it working.
      </p>
    </section>
  )
}

function PendingPanel({ reference }: { reference: string | null }) {
  return (
    <section role="status" aria-live="polite" aria-labelledby="checkout-outcome-title">
      <div id="checkout-outcome-title">
        <OutcomeHeader tone="pending" icon={Hourglass} title="Confirming your payment…">
          Paystack hasn&rsquo;t confirmed this charge yet. M-Pesa and bank transfers can take a minute to settle. No
          licence is issued until the payment is confirmed — you don&rsquo;t need to pay again.
        </OutcomeHeader>
      </div>

      {reference ? (
        <div className="text-center">
          <ReferenceChip reference={reference} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href={reference ? `/buy/success?ref=${encodeURIComponent(reference)}` : '/buy/success'}>
            Check again
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard/licenses">Go to dashboard</Link>
        </Button>
      </div>
    </section>
  )
}

function FailedPanel({ reference }: { reference: string | null }) {
  return (
    <section role="alert" aria-live="assertive" aria-labelledby="checkout-outcome-title">
      <div id="checkout-outcome-title">
        <OutcomeHeader tone="failed" icon={TriangleAlert} title="We couldn&rsquo;t confirm a completed payment.">
          This charge didn&rsquo;t go through, so no licence was issued and nothing extra was charged. You can start the
          payment again from your dashboard.
        </OutcomeHeader>
      </div>

      {reference ? (
        <div className="text-center">
          <ReferenceChip reference={reference} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard/licenses">Back to licences</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contact">Need help?</Link>
        </Button>
      </div>
    </section>
  )
}

function UnknownPanel() {
  return (
    <section role="status" aria-live="polite" aria-labelledby="checkout-outcome-title">
      <div id="checkout-outcome-title">
        <OutcomeHeader tone="neutral" icon={Hourglass} title="We couldn&rsquo;t confirm this payment.">
          We don&rsquo;t have a confirmed payment on your account for this link. If you just paid, it may still be
          settling — open your dashboard to see your licences and payments.
        </OutcomeHeader>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard/licenses">Open dashboard</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard/payments">View payments</Link>
        </Button>
      </div>
    </section>
  )
}

function NextStep({
  icon: Icon,
  title,
  body,
  cta,
  href,
  external = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  cta: string
  href: string
  external?: boolean
}) {
  const inner = (
    <>
      <div className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-fg)]">{title}</h3>
        <p className="mt-1 text-[12px] leading-[1.5] text-[var(--color-fg-muted)]">{body}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-accent)]">
        {cta}
        {external ? (
          <ArrowUpRight className="size-3.5" />
        ) : (
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </>
  )

  const className =
    'group flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]'

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  )
}
