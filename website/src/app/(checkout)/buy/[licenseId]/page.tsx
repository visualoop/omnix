import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft, ShieldCheck } from '@/components/icons'
import { auth } from '@/lib/auth'
import { db, licenses } from '@/db'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { pricingFor } from '@/config/pricing'

export const metadata = { title: 'Buy a licence' }

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

  // Pro short-circuit. The legacy Pro variant is no longer on sale
  // publicly, but old Pro trial licences still exist on customer
  // dashboards. Clicking through to checkout used to show
  // "Upgrade · Omnix Pro · all four trades · KES 150,000" — that
  // payment can't be honoured, so we render a clear "Pro is no longer
  // available for new purchases" notice and point the user at the
  // trade variants instead. Existing PAID Pro owners keep their
  // licence; they don't pass through this page.
  if (license.variant === 'pro' && license.status !== 'active') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] pt-12 pb-20">
        <div className="mx-auto max-w-2xl px-6 sm:px-8">
          <Link
            href="/dashboard/licenses"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>

          <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 lg:p-10">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Omnix Pro
            </span>
            <h1 className="mt-3 font-display text-[clamp(24px,3vw,32px)] font-medium leading-tight text-[var(--color-fg)]">
              Pro isn&rsquo;t available for new purchases right now.
            </h1>
            <p className="mt-4 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
              We&rsquo;ve paused public sales of the multi-trade Pro licence while we focus on the
              four trade variants. Your current Pro trial keeps working until expiry, so you can
              continue evaluating every module on this machine — but the trial cannot be converted
              to a paid Pro licence today.
            </p>
            <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
              To keep using Omnix after the trial, pick the trade you actually run. Each trade
              licence is KES 30,000 once — perpetual, no subscription.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['dawa', 'retail', 'hospitality', 'hardware'] as const).map((v) => (
                <Link
                  key={v}
                  href={`/buy?variant=${v}`}
                  className="inline-flex items-center justify-between rounded-md border border-[var(--color-border)] bg-transparent px-4 py-3 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                >
                  <span className="font-display text-[15px] font-medium text-[var(--color-fg)]">
                    {variantDisplayName(v)}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                    Choose &rarr;
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-7 text-[12px] text-[var(--color-fg-subtle)]">
              Run more than one trade in your business? Get in touch via{' '}
              <Link href="/contact" className="text-[var(--color-fg)] underline-offset-4 hover:underline">
                /contact
              </Link>{' '}
              — we still issue Pro for genuine multi-trade operations on request.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const purpose = type ?? 'license_fee'
  const p = pricingFor((license.currency as 'KES') ?? 'KES')
  const lines = computeLines({ purpose, variant: license.variant, p })
  const total = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pt-12 pb-20">
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <Link
          href="/dashboard/licenses"
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>

        <h1 className="mt-8 font-display text-[clamp(28px,3vw,40px)] font-medium leading-tight text-[var(--color-fg)]">
          {purposeLabel(purpose)}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-[var(--color-fg-muted)]">
          Pay via M-Pesa, card, or bank transfer. Secure checkout via Paystack.
        </p>

        {/* Variant lock — makes it impossible for the user to mistakenly
            pay for the wrong module. The variant is fixed by the licence
            row; if they want a different module they go back to /pricing
            and pick again (which issues / finds the right licence). */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Upgrading
          </span>
          <span className="font-display text-[16px] font-medium text-[var(--color-fg)]">
            {variantDisplayName(license.variant)}
          </span>
          <Link
            href="/pricing"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] underline-offset-4 hover:underline hover:text-[var(--color-fg)]"
          >
            Change module
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8 self-start">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
              Order summary
            </h2>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
              <code className="font-mono text-[12px] tabular-nums text-[var(--color-fg)] truncate">
                {license.licenseKey}
              </code>
              <span
                className="shrink-0 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]"
              >
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
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                Total
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                  className="text-[44px] font-medium leading-none tabular-nums tracking-[-0.02em]"
                >
                  {total.toLocaleString()}
                </span>
                <span className="font-mono text-[14px] text-[var(--color-fg-muted)] tabular-nums">
                  {p.currency}
                </span>
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                One-time · No subscription
              </div>
            </div>

            <div className="mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12px] leading-[1.55] text-[var(--color-fg-muted)]">
              <ShieldCheck className="mb-2 size-4 text-[var(--color-accent)]" />
              14-day refund window after payment. Read the{' '}
              <a href="/refund-policy" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                refund policy
              </a>
              .
            </div>
          </aside>

          <section>
            <CheckoutForm
              licenseId={license.id}
              purpose={purpose}
              amount={total}
              currency={p.currency}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function purposeLabel(purpose: string): string {
  const map: Record<string, string> = {
    license_fee: 'Upgrade to a paid licence',
    maintenance_renewal: 'Renew compliance',
    major_upgrade: 'Major version upgrade',
    cloud_backup: 'Enable cloud backup',
    extra_branch: 'Add an extra branch',
    extra_machine: 'Add an extra machine seat',
  }
  return map[purpose] ?? 'Pay'
}

/**
 * Variant → display name for the checkout. The bare DB value ("dawa")
 * isn't friendly enough at this point in the funnel.
 */
function variantDisplayName(variant: string): string {
  const map: Record<string, string> = {
    pro: 'Omnix Pro · all four trades',
    dawa: 'Omnix Dawa · pharmacy',
    retail: 'Omnix Retail · shops + mini-marts',
    hospitality: 'Omnix Hospitality · restaurants + lodges',
    hardware: 'Omnix Hardware · stores + contractors',
  }
  return map[variant] ?? `Omnix ${variant.charAt(0).toUpperCase()}${variant.slice(1)}`
}

function computeLines({ purpose, variant, p }: {
  purpose: string
  variant: string
  p: ReturnType<typeof pricingFor>
}): { label: string; amount: number }[] {
  // Pro multi-trade licence is sold at the "business" price (KES 150k).
  // Every other variant (dawa / retail / hospitality / hardware) is the
  // single "starter" price (KES 30k). Tier on the licence row is just
  // a state flag (trial / starter / business) — pricing is driven by
  // VARIANT so a Pro trial upgrades to KES 150k, not 30k.
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
