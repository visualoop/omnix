import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Copy, Download, Sparkles } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { formatDate, StatusPill } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Licence detail' }

type Variant = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

interface License {
  id: string
  licenseKey: string
  tier: string
  status: string
  variant?: Variant
  modules?: string[]
  maxBranches?: number
  maxMachines?: number
  trialStartedAt?: string
  trialEndsAt?: string
  paidAt?: string
  maintenanceUntil?: string
  majorVersionCap?: number
  cloudBackupEnabled?: boolean
  cloudBackupExpiresAt?: string
  priceFeePaid?: number
  currency?: string
  createdAt: string
}

interface Machine {
  id: string
  hostname?: string
  os?: string
  currentVersion?: string
  status: string
  city?: string
  county?: string
  lastSeenAt?: string
}

interface Payment {
  id: string
  paystackReference: string
  amount: number
  currency: string
  status: string
  purpose: string
  createdAt: string
}

export default async function LicenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  let license: License
  try {
    const doc = (await payload.findByID({
      collection: 'licenses',
      id,
    })) as unknown as License & { customer: string | { id: string } }
    const ownerId = typeof doc.customer === 'string' ? doc.customer : doc.customer?.id
    if (String(ownerId) !== String(user.id)) notFound()
    license = doc
  } catch {
    notFound()
  }

  const machinesRes = await payload.find({
    collection: 'machines',
    where: { license: { equals: id } },
    limit: 50,
  })

  const paymentsRes = await payload.find({
    collection: 'payments',
    where: { license: { equals: id } },
    sort: '-createdAt',
    limit: 50,
  })

  const machines = machinesRes.docs as unknown as Machine[]
  const payments = paymentsRes.docs as unknown as Payment[]

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/licenses"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All licences
      </Link>

      {/* Hero card */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-baseline gap-3">
              <code className="font-mono text-[24px] font-medium tabular-nums text-[var(--color-fg)] sm:text-[28px]">
                {license.licenseKey}
              </code>
              <StatusPill kind="license" status={license.status} />
              <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                {license.tier}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(license.modules ?? []).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-accent-hover)]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {license.status === 'trial' || license.status === 'lapsed' ? (
              <Button asChild size="sm">
                <Link href={`/buy/${license.id}`}>
                  <Sparkles className="size-3.5" />
                  Upgrade to paid
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/downloads/${license.variant ?? 'pro'}`}>
                <Download className="size-3.5" />
                Download installer
              </Link>
            </Button>
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[var(--color-border)] pt-7 sm:grid-cols-4">
          <Stat label="Branches" value={String(license.maxBranches ?? 1)} />
          <Stat label="Machines" value={String(license.maxMachines ?? 3)} />
          <Stat label="Major-version cap" value={`v${license.majorVersionCap ?? 1}.x`} />
          <Stat label="Maintenance" value={formatDate(license.maintenanceUntil)} />
          {license.status === 'trial' ? (
            <>
              <Stat label="Trial started" value={formatDate(license.trialStartedAt)} />
              <Stat label="Trial ends" value={formatDate(license.trialEndsAt)} />
            </>
          ) : (
            <Stat label="Licence type" value="Perpetual" />
          )}
          <Stat label="Paid on" value={formatDate(license.paidAt)} />
          <Stat
            label="Cloud backup"
            value={license.cloudBackupEnabled ? 'Enabled' : 'Off'}
          />
        </dl>
      </section>

      {/* Machines */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
              Machines
            </h2>
            <p className="mt-1 text-[12px] text-[var(--color-fg-subtle)]">
              {machines.length} of {license.maxMachines ?? 3} seats used
            </p>
          </div>
        </header>
        {machines.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
            No machines have activated this licence yet. Install Omnix and paste the licence key
            on first launch.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {machines.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <div className="text-[14px] font-medium text-[var(--color-fg)]">
                    {m.hostname ?? '—'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
                    {m.os ?? 'unknown'} · v{m.currentVersion ?? '?'} ·{' '}
                    {m.city ? `${m.city}, ${m.county ?? 'KE'}` : 'no location'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                    Last seen {formatDate(m.lastSeenAt)}
                  </span>
                  <StatusPill kind="machine" status={m.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Payments */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <header className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
            Payments tied to this licence
          </h2>
        </header>
        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
            No payments yet for this licence.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-6 py-4 text-[13px]"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                    {p.paystackReference}
                  </span>
                  <span className="text-[var(--color-fg)]">
                    {p.purpose.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <time className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                    {formatDate(p.createdAt)}
                  </time>
                  <span className="font-mono tabular-nums text-[var(--color-fg)]">
                    {p.currency} {p.amount.toLocaleString()}
                  </span>
                  <StatusPill kind="payment" status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Major upgrade prompt */}
      {license.status === 'active' &&
      (license.majorVersionCap ?? 1) < 2 ? (
        <section className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-7">
          <h2 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
            v2.0 ships later this year.
          </h2>
          <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">
            Current owners pay 50 % off list price for major version upgrades. Stay on v1.x as
            long as you like — there's no rush.
          </p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link href="/changelog">See what's coming</Link>
          </Button>
        </section>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
        {value}
      </dd>
    </div>
  )
}
