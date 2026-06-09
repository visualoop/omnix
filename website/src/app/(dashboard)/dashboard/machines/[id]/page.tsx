import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Monitor } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { formatDate, formatRelative, StatusPill } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Machine detail' }

interface MachineDoc {
  id: string
  machineId: string
  hostname?: string
  os?: string
  osVersion?: string
  arch?: string
  currentVersion?: string
  activeModule?: string
  branchName?: string
  productCount?: number
  employeeCount?: number
  salesCountLast30d?: number
  salesValueLast30d?: number
  lastSyncAt?: string
  firstSeenAt?: string
  lastSeenAt?: string
  city?: string
  county?: string
  networkMode?: string
  status: string
  integrations?: {
    etimsConfigured?: boolean
    mpesaConfigured?: boolean
    paystackConfigured?: boolean
    shaConfigured?: boolean
  }
  license: string | { id: string; customer: string | { id: string } }
}

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Defensive auth — stale-cookie sessions otherwise 500 the page.
  type Authed = { id?: string | number; collection?: string }
  let raw: Authed | null = null
  try {
    const r = await payload.auth({ headers: reqHeaders })
    raw = (r.user ?? null) as Authed | null
  } catch {
    raw = null
  }
  if (!raw || raw.collection !== 'customers' || raw.id == null) {
    notFound()
  }
  const user = raw as { id: string | number; collection: 'customers' }

  let machine: MachineDoc
  try {
    machine = (await payload.findByID({
      collection: 'machines',
      id,
      depth: 1,
    })) as unknown as MachineDoc
    const license = typeof machine.license === 'string' ? null : machine.license
    const ownerId =
      license == null
        ? null
        : typeof license.customer === 'string'
          ? license.customer
          : license.customer?.id
    if (String(ownerId) !== String(user.id)) notFound()
  } catch {
    notFound()
  }

  const integrations = [
    { key: 'etimsConfigured', label: 'KRA eTIMS' },
    { key: 'mpesaConfigured', label: 'M-Pesa' },
    { key: 'paystackConfigured', label: 'Paystack' },
    { key: 'shaConfigured', label: 'SHA / NHIF' },
  ] as const

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/machines"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All machines
      </Link>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="inline-flex size-12 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Monitor className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-[24px] font-medium text-[var(--color-fg)] sm:text-[28px]">
                  {machine.hostname ?? 'Unknown host'}
                </h1>
                <StatusPill kind="machine" status={machine.status} />
              </div>
              <p className="mt-1 font-mono text-[11px] text-[var(--color-fg-subtle)]">
                {machine.machineId}
              </p>
            </div>
          </div>

          {machine.status !== 'deactivated' ? (
            <Button variant="outline" size="sm">
              Deactivate seat
            </Button>
          ) : null}
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[var(--color-border)] pt-7 sm:grid-cols-3 lg:grid-cols-4">
          <Stat
            label="Operating system"
            value={`${machine.os ?? '?'} ${machine.osVersion ?? ''}`.trim()}
          />
          <Stat label="Architecture" value={machine.arch ?? '—'} />
          <Stat label="Omnix version" value={`v${machine.currentVersion ?? '?'}`} />
          <Stat label="Active module" value={machine.activeModule ?? '—'} />
          <Stat label="Branch" value={machine.branchName ?? '—'} />
          <Stat label="Network mode" value={machine.networkMode ?? '—'} />
          <Stat
            label="Location"
            value={machine.city ? `${machine.city}, ${machine.county ?? 'KE'}` : '—'}
          />
          <Stat label="Last seen" value={formatRelative(machine.lastSeenAt)} />
          <Stat label="First seen" value={formatDate(machine.firstSeenAt)} />
        </dl>
      </section>

      {/* Telemetry rollups */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7">
        <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
          Activity (last 30 days)
        </h2>
        <p className="mt-1 text-[12px] text-[var(--color-fg-subtle)]">
          Counts only — never the underlying business records.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Products" value={String(machine.productCount ?? 0)} />
          <Stat label="Employees" value={String(machine.employeeCount ?? 0)} />
          <Stat label="Sales count" value={String(machine.salesCountLast30d ?? 0)} />
          <Stat
            label="Sales value"
            value={`KES ${(machine.salesValueLast30d ?? 0).toLocaleString()}`}
          />
        </dl>
      </section>

      {/* Integrations */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7">
        <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
          Integrations
        </h2>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {integrations.map((i) => {
            const configured = Boolean(
              (machine.integrations ?? {})[i.key as keyof typeof machine.integrations],
            )
            return (
              <li
                key={i.key}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[13px]"
              >
                <span className="text-[var(--color-fg)]">{i.label}</span>
                <span
                  className={
                    configured
                      ? 'rounded-full bg-[var(--color-positive)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-positive)]'
                      : 'rounded-full bg-[var(--color-fg-subtle)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]'
                  }
                >
                  {configured ? 'Configured' : 'Not set'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
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
