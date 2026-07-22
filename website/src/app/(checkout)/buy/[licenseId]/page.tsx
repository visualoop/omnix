import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft, ReceiptText, ShieldCheck } from '@/components/icons'
import { auth } from '@/lib/auth'
import { db, licenses } from '@/db'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { pricingFor } from '@/config/pricing'
import { PUBLIC_PRODUCTS, publicProductName } from '@/lib/buy-resolver'

export const metadata = { title: 'Order review', robots: { index: false } }

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ licenseId: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { licenseId } = await params
  const { type } = await searchParams
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect(`/login?next=/buy/${licenseId}`)

  const rows = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, licenseId), eq(licenses.userId, session.user.id)))
    .limit(1)
  const license = rows[0]
  if (!license) notFound()

  // Pro short-circuit. The legacy Pro variant is not on the public
  // catalogue, but old Pro trial licences still exist on dashboards.
  // Rather than charge for a product we don't sell, point the buyer at
  // the five catalogue products. Existing PAID Pro owners keep their
  // licence and never pass through this page.
  if (license.variant === 'pro' && license.status !== 'active') {
    return <ProPausedNotice />
  }

  const purpose = type ?? 'license_fee'
  const p = pricingFor((license.currency as 'KES') ?? 'KES')
  const lines = computeLines({ purpose, variant: license.variant, p })
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const isPro = license.variant === 'pro'
  const maintenanceYearly = isPro ? p.business.maintenanceYearly : p.starter.maintenanceYearly

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard/licenses"
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-fg-muted)] outline-none transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to licences
        </Link>

        <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Order review
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--color-fg)]">
          {purposeLabel(purpose)}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
          Review the licence and total below, then pay securely with M-Pesa, card or bank via Paystack.
        </p>

        {/* Variant lock — the product is fixed by the licence row so the
            buyer can't pay for the wrong one. Changing product means
            picking again on the pricing page. */}
        <div className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-4 py-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Product
          </span>
          <span className="font-display text-[16px] font-semibold text-[var(--color-fg)]">
            {publicProductName(license.variant)}
          </span>
          <Link
            href="/pricing"
            className="rounded-[var(--radius-xs)] font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)] underline-offset-4 outline-none hover:text-[var(--color-fg)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Change product
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <aside className="self-start rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
              <ReceiptText className="size-3.5 text-[var(--color-accent)]" />
              Order summary
            </h2>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
              <code className="truncate font-mono text-[12px] tabular-nums text-[var(--color-fg)]">
                {license.licenseKey}
              </code>
              <span className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                {license.tier}
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {lines.map((l) => (
                <li key={l.label} className="flex items-baseline justify-between gap-4 text-[14px]">
                  <span className="text-[var(--color-fg)]">{l.label}</span>
                  <span className="font-mono tabular-nums text-[var(--color-fg-muted)]">
                    {p.currency} {l.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-[var(--color-border)] pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">Total</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[44px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--color-accent)]">
                  {total.toLocaleString()}
                </span>
                <span className="font-mono text-[14px] tabular-nums text-[var(--color-fg-muted)]">{p.currency}</span>
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                One-time · Perpetual licence · No subscription
              </div>
            </div>

            {purpose === 'license_fee' ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12px] leading-[1.6] text-[var(--color-fg-muted)]">
                Compliance updates ({p.currency} {maintenanceYearly.toLocaleString()}/year) are{' '}
                <strong className="text-[var(--color-fg)]">optional</strong> and billed separately.{' '}
                Skipping them does not deactivate your perpetual licence.
              </div>
            ) : null}

            <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12px] leading-[1.55] text-[var(--color-fg-muted)]">
              <ShieldCheck className="mb-2 size-4 text-[var(--color-accent)]" />
              14-day refund window after payment. Read the{' '}
              <Link
                href="/refund-policy"
                className="text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                refund policy
              </Link>
              .
            </div>
          </aside>

          <section>
            <CheckoutForm licenseId={license.id} purpose={purpose} amount={total} currency={p.currency} />
          </section>
        </div>
      </div>
    </div>
  )
}

function ProPausedNotice() {
  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/licenses"
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-fg-muted)] outline-none transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>

        <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 lg:p-10">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Omnix Pro
          </span>
          <h1 className="mt-3 font-display text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-[var(--color-fg)]">
            Pro isn&rsquo;t available for new purchases right now.
          </h1>
          <p className="mt-4 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
            We&rsquo;ve paused public sales of the multi-trade Pro licence. Your current Pro trial keeps working until
            expiry, but the trial can&rsquo;t be converted to a paid Pro licence today.
          </p>
          <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
            To keep using Omnix after the trial, pick the product you actually run — each is a one-time perpetual
            licence, no subscription.
          </p>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PUBLIC_PRODUCTS.map((product) => (
              <Link
                key={product.variant}
                href={`/buy?variant=${product.variant}`}
                className="inline-flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-4 py-3 outline-none transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                <span className="font-display text-[15px] font-semibold text-[var(--color-fg)]">{product.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
                  Choose &rarr;
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-7 text-[12px] text-[var(--color-fg-subtle)]">
            Run more than one trade?{' '}
            <Link href="/contact" className="text-[var(--color-fg)] underline-offset-4 hover:underline">
              Get in touch
            </Link>{' '}
            — we still issue Pro for genuine multi-trade operations on request.
          </p>
        </div>
      </div>
    </div>
  )
}

function purposeLabel(purpose: string): string {
  const map: Record<string, string> = {
    license_fee: 'Buy your perpetual licence',
    maintenance_renewal: 'Renew compliance updates',
    major_upgrade: 'Major version upgrade',
    cloud_backup: 'Enable cloud backup',
    extra_branch: 'Add an extra branch',
    extra_machine: 'Add an extra machine seat',
  }
  return map[purpose] ?? 'Pay'
}

function computeLines({
  purpose,
  variant,
  p,
}: {
  purpose: string
  variant: string
  p: ReturnType<typeof pricingFor>
}): { label: string; amount: number }[] {
  // Pricing is driven by VARIANT. Public products (dawa / retail /
  // hospitality / hardware / salon) are the single "starter" price. The
  // legacy Pro variant maps to the "business" price but never reaches a
  // priced checkout (it is paused above).
  const isPro = variant === 'pro'
  switch (purpose) {
    case 'license_fee': {
      const fee = isPro ? p.business.oneTimeFee : p.starter.oneTimeFee
      return [{ label: isPro ? 'Omnix Pro · all trades (one-time)' : 'Omnix licence (one-time)', amount: fee }]
    }
    case 'maintenance_renewal': {
      const yearly = isPro ? p.business.maintenanceYearly : p.starter.maintenanceYearly
      return [{ label: '1 year compliance updates', amount: yearly }]
    }
    case 'major_upgrade': {
      const fee = isPro ? p.business.oneTimeFee : p.starter.oneTimeFee
      const discounted = Math.round(fee * (1 - p.majorUpgradeDiscount / 100))
      return [{ label: `Major version upgrade (${p.majorUpgradeDiscount}% off ${isPro ? 'Pro' : 'trade'})`, amount: discounted }]
    }
    case 'cloud_backup':
      return [{ label: 'Cloud backup · 1 month / 1 branch', amount: p.cloudBackupMonthly }]
    case 'extra_branch':
      return [{ label: 'Extra branch (one-time)', amount: p.extraBranchOneTime }]
    case 'extra_machine':
      return [{ label: 'Extra machine seat (one-time)', amount: p.extraMachineOneTime }]
    default:
      return []
  }
}
