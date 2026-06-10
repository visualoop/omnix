import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, Plus } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { EmptyState, formatDate, PageHeading, StatusPill } from '@/components/dashboard/status-utils'
import { safePayloadFind, emptyPage, getDashboardCustomer } from '@/lib/dashboard-helpers'

export const metadata = { title: 'Licences' }

type Variant = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

const VARIANT_NAME: Record<Variant, string> = {
  pro: 'Omnix Pro',
  dawa: 'Omnix Dawa',
  retail: 'Omnix Retail',
  hospitality: 'Omnix Hospitality',
  hardware: 'Omnix Hardware',
}

interface License {
  id: string
  licenseKey: string
  tier: string
  variant?: Variant
  status: string
  modules?: string[]
  maxBranches?: number
  maxMachines?: number
  trialEndsAt?: string
  paidAt?: string
  maintenanceUntil?: string
  majorVersionCap?: number
  createdAt: string
}

export default async function LicensesPage() {
  const reqHeaders = await headers()
  const customer = await getDashboardCustomer(reqHeaders)
  const user = customer as unknown as { id: string | number; email: string; fullName?: string; businessName?: string; collection?: string }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await safePayloadFind(
    () =>
      payload.find({
        collection: 'licenses',
        where: { customer: { equals: user.id } },
        sort: '-createdAt',
        limit: 100,
      }),
    emptyPage(),
    'licenses-list',
  )

  const licenses = res.docs as unknown as License[]

  return (
    <div className="space-y-8">
      <PageHeading
        title="Licences"
        subtitle="Every Omnix licence on your account, with status, modules, and quick actions."
        actions={
          <Button asChild>
            <Link href="/pricing">
              <Plus className="size-4" />
              Buy another licence
            </Link>
          </Button>
        }
      />

      {licenses.length === 0 ? (
        <EmptyState
          title="No licences yet."
          body="Start a free trial or pay for a licence to begin running your duka."
          action={
            <Button asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {licenses.map((license) => (
            <li
              key={license.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-7"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <code className="font-mono text-[18px] tabular-nums text-[var(--color-fg)]">
                      {license.licenseKey}
                    </code>
                    <StatusPill kind="license" status={license.status} />
                    <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-hover)]">
                      {VARIANT_NAME[(license.variant as Variant) ?? 'pro']}
                    </span>
                    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                      {license.tier}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
                    {(license.modules ?? []).map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 font-medium text-[var(--color-accent-hover)]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-[12px] sm:grid-cols-4">
                    <Stat label="Branches" value={String(license.maxBranches ?? 1)} />
                    <Stat label="Machines" value={String(license.maxMachines ?? 3)} />
                    <Stat
                      label="Maintenance"
                      value={formatDate(license.maintenanceUntil)}
                    />
                    <Stat
                      label={license.status === 'trial' ? 'Trial ends' : 'Paid on'}
                      value={formatDate(
                        license.status === 'trial' ? license.trialEndsAt : license.paidAt,
                      )}
                    />
                  </dl>
                </div>

                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/dashboard/licenses/${license.id}`}>
                    Manage
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono tabular-nums text-[var(--color-fg)]">{value}</dd>
    </div>
  )
}
