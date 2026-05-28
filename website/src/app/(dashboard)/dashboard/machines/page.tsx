import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, Monitor } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  EmptyState,
  formatRelative,
  PageHeading,
  StatusPill,
} from '@/components/dashboard/status-utils'

export const metadata = { title: 'Machines' }

export default async function MachinesPage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  const licenseRes = await payload.find({
    collection: 'licenses',
    where: { customer: { equals: user.id } },
    limit: 50,
  })
  const licenseIds = licenseRes.docs.map((l: unknown) => (l as { id: string }).id)

  const res = await payload.find({
    collection: 'machines',
    where: { license: { in: licenseIds } },
    sort: '-lastSeenAt',
    limit: 100,
  })
  const machines = res.docs as unknown as {
    id: string
    hostname?: string
    os?: string
    osVersion?: string
    arch?: string
    currentVersion?: string
    activeModule?: string
    branchName?: string
    status: string
    city?: string
    county?: string
    lastSeenAt?: string
  }[]

  return (
    <div className="space-y-8">
      <PageHeading
        title="Machines"
        subtitle="Every PC running Duka against your licences. Deactivate from a machine to free a seat."
      />

      {machines.length === 0 ? (
        <EmptyState
          title="No machines registered yet."
          body="Once you install Duka and activate with a licence key, the machine appears here."
        />
      ) : (
        <ul className="space-y-3">
          {machines.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Monitor className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                    {m.hostname ?? 'Unknown host'}
                  </h3>
                  <StatusPill kind="machine" status={m.status} />
                  {m.branchName ? (
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
                      {m.branchName}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-4">
                  <Stat label="OS" value={`${m.os ?? '?'} ${m.osVersion ?? ''}`.trim()} />
                  <Stat label="Version" value={`v${m.currentVersion ?? '?'}`} />
                  <Stat
                    label="Location"
                    value={m.city ? `${m.city}, ${m.county ?? 'KE'}` : '—'}
                  />
                  <Stat label="Last seen" value={formatRelative(m.lastSeenAt)} />
                </dl>
              </div>
              <Link
                href={`/dashboard/machines/${m.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
              >
                Detail
                <ArrowRight className="size-3.5" />
              </Link>
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
      <dd className="mt-0.5 font-mono tabular-nums text-[var(--color-fg)]">{value}</dd>
    </div>
  )
}
