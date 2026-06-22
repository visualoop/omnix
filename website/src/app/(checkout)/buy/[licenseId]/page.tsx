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

  const purpose = type ?? 'license_fee'
  const p = pricingFor((license.currency as 'KES') ?? 'KES')
  const lines = computeLines({ purpose, tier: license.tier, p })
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

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Order summary
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <code className="font-mono text-[14px] tabular-nums text-[var(--color-fg)]">
                {license.licenseKey}
              </code>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
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

            <div className="mt-6 flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
              <span className="text-[14px] font-medium">Total</span>
              <span className="font-display text-[28px] font-medium tabular-nums">
                {p.currency} {total.toLocaleString()}
              </span>
            </div>

            <div className="mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12px] leading-[1.55] text-[var(--color-fg-muted)]">
              <ShieldCheck className="mb-2 size-4 text-[var(--color-accent)]" />
              14-day refund window after payment. Read the{' '}
              <a href="/refund-policy" className="text-[var(--color-accent)] underline-offset-4 hover:underline">refund policy</a>.
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

function computeLines({ purpose, tier, p }: {
  purpose: string
  tier: string
  p: ReturnType<typeof pricingFor>
}): { label: string; amount: number }[] {
  switch (purpose) {
    case 'license_fee': {
      const fee = tier === 'business' ? p.business.oneTimeFee : p.starter.oneTimeFee
      return [{ label: 'Omnix licence (one-time)', amount: fee }]
    }
    case 'maintenance_renewal': {
      const yearly = tier === 'business' ? p.business.maintenanceYearly : p.starter.maintenanceYearly
      return [{ label: '1 year compliance updates', amount: yearly }]
    }
    case 'major_upgrade': {
      const fee = tier === 'business' ? p.business.oneTimeFee : p.starter.oneTimeFee
      const discounted = Math.round(fee * (1 - p.majorUpgradeDiscount / 100))
      return [{ label: `Major version upgrade (${p.majorUpgradeDiscount}% off ${tier})`, amount: discounted }]
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
