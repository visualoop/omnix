import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { CheckoutForm } from '@/components/checkout/checkout-form'

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
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  type Authed = { id?: string | number; collection?: string }
  let user: Authed | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = (result.user ?? null) as Authed | null
  } catch (err) {
    console.error('[checkout] auth error:', err)
    user = null
  }
  if (!user || user.collection !== 'customers' || user.id == null) {
    redirect(`/login?next=/buy/${licenseId}`)
  }
  // After redirect type-narrows to never; preserve the broader type for downstream usage.
  const customer = user as { id: string | number; collection: 'customers' }

  let license: {
    id: string
    licenseKey: string
    tier: string
    status: string
    customer: string | { id: string }
  }
  try {
    license = (await payload.findByID({
      collection: 'licenses',
      id: licenseId,
    })) as unknown as typeof license
    const ownerId = typeof license.customer === 'string' ? license.customer : license.customer?.id
    if (String(ownerId) !== String(customer.id)) notFound()
  } catch {
    notFound()
  }

  // Pricing global
  const pricing = (await payload.findGlobal({
    slug: 'pricing',
  })) as unknown as {
    starter: { oneTimeFee: number; maintenanceYearly: number }
    business: { oneTimeFee: number; maintenanceYearly: number }
    cloudBackupMonthly: number
    extraBranchOneTime: number
    extraMachineOneTime: number
    majorUpgradeDiscount: number
    currency: string
  }

  // Compute the line items based on purpose
  const purpose = type ?? 'license_fee'
  const lines = computeLines({
    purpose,
    tier: license.tier,
    pricing,
  })
  const total = lines.reduce((sum, l) => sum + l.amount, 0)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pt-12 pb-20">
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <Link
          href="/dashboard/licenses"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to licences
        </Link>

        <h1 className="mt-8 font-display text-[clamp(28px,3vw,40px)] font-medium leading-tight text-[var(--color-fg)]">
          {purposeLabel(purpose)}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] text-[var(--color-fg-muted)]">
          Pay via M-Pesa, card, or bank transfer. Secure checkout via Paystack.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          {/* Order summary */}
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
              {lines.map((line) => (
                <li
                  key={line.label}
                  className="flex items-baseline justify-between gap-4 text-[14px]"
                >
                  <span className="text-[var(--color-fg)]">{line.label}</span>
                  <span className="font-mono tabular-nums text-[var(--color-fg-muted)]">
                    {pricing.currency} {line.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
              <span className="text-[14px] font-medium text-[var(--color-fg)]">
                Total
              </span>
              <span className="font-display text-[28px] font-medium tabular-nums text-[var(--color-fg)]">
                {pricing.currency} {total.toLocaleString()}
              </span>
            </div>

            <div className="mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12px] leading-[1.55] text-[var(--color-fg-muted)]">
              <ShieldCheck className="mb-2 size-4 text-[var(--color-accent)]" />
              14-day refund window after payment. We don't keep money we haven't earned —{' '}
              <a
                href="/refund-policy"
                className="text-[var(--color-accent)] underline-offset-4 hover:underline"
              >
                refund policy
              </a>
              .
            </div>
          </aside>

          {/* Form */}
          <section>
            <CheckoutForm
              licenseId={license.id}
              purpose={purpose}
              amount={total}
              currency={pricing.currency}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function purposeLabel(purpose: string): string {
  const map: Record<string, string> = {
    license_fee: 'Buy your licence',
    maintenance_renewal: 'Renew maintenance',
    major_upgrade: 'Major version upgrade',
    cloud_backup: 'Enable cloud backup',
    extra_branch: 'Add an extra branch',
    extra_machine: 'Add an extra machine seat',
  }
  return map[purpose] ?? 'Pay'
}

function computeLines({
  purpose,
  tier,
  pricing,
}: {
  purpose: string
  tier: string
  pricing: {
    starter: { oneTimeFee: number; maintenanceYearly: number }
    business: { oneTimeFee: number; maintenanceYearly: number }
    cloudBackupMonthly: number
    extraBranchOneTime: number
    extraMachineOneTime: number
    majorUpgradeDiscount: number
  }
}): { label: string; amount: number }[] {
  switch (purpose) {
    case 'license_fee': {
      const fee = tier === 'business' ? pricing.business.oneTimeFee : pricing.starter.oneTimeFee
      return [{ label: `${tier} licence (one-time)`, amount: fee }]
    }
    case 'maintenance_renewal': {
      const yearly =
        tier === 'business' ? pricing.business.maintenanceYearly : pricing.starter.maintenanceYearly
      return [{ label: '1 year maintenance', amount: yearly }]
    }
    case 'major_upgrade': {
      const fee = tier === 'business' ? pricing.business.oneTimeFee : pricing.starter.oneTimeFee
      const discounted = Math.round(fee * (1 - pricing.majorUpgradeDiscount / 100))
      return [
        {
          label: `Major version upgrade (50 % off ${tier})`,
          amount: discounted,
        },
      ]
    }
    case 'cloud_backup':
      return [
        {
          label: 'Cloud backup · 1 month / 1 branch',
          amount: pricing.cloudBackupMonthly,
        },
      ]
    case 'extra_branch':
      return [{ label: 'Extra branch (one-time)', amount: pricing.extraBranchOneTime }]
    case 'extra_machine':
      return [{ label: 'Extra machine seat (one-time)', amount: pricing.extraMachineOneTime }]
    default:
      return []
  }
}
