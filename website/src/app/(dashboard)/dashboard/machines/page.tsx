import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike, or, inArray } from 'drizzle-orm'
import { db, machines, activations, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/dashboard/status-utils'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { ListPagination, ListSearch } from '@/components/dashboard/list-controls'
import { ReleaseSeatButton } from '@/components/dashboard/release-seat-button'
import { cn } from '@/lib/cn'

export const metadata = { title: 'Devices' }

const PAGE_SIZE = 25

/** Heartbeat freshness — token-backed, always paired with a text label so
 *  colour is never the sole signal. */
function HeartbeatPill({ lastSeenAt }: { lastSeenAt: Date | string | null }) {
  if (!lastSeenAt) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        Never seen
      </span>
    )
  }
  const ts = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt
  const ageMin = (Date.now() - ts.getTime()) / 60_000
  const ageHrs = ageMin / 60
  const ageDays = ageHrs / 24

  let tone: string
  let label: string
  if (ageMin < 5) {
    tone = 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]'
    label = 'Live'
  } else if (ageHrs < 24) {
    tone = 'bg-[var(--color-positive)]/12 text-[var(--color-positive)]'
    label = ageHrs < 1 ? `${Math.round(ageMin)}m ago` : `${Math.round(ageHrs)}h ago`
  } else if (ageDays < 7) {
    tone = 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]'
    label = `${Math.round(ageDays)}d ago`
  } else {
    tone = 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]'
    label = `${Math.round(ageDays)}d ago`
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]',
        tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  )
}

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/machines')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  const where = q
    ? and(
        eq(machines.userId, session.user.id),
        or(ilike(machines.hostname, `%${q}%`), ilike(machines.machineId, `%${q}%`)),
      )
    : eq(machines.userId, session.user.id)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(machines)
      .where(where)
      .orderBy(desc(machines.lastSeenAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(machines).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  // A single PC can hold several trade licences (Dawa + Retail + Hardware),
  // so the last-written machines.activeModule under-reports. Join through
  // activations to list every variant installed on each machine.
  const machineIds = rows.map((m) => m.id)
  const variantRows = machineIds.length
    ? await db
        .selectDistinct({ machineId: activations.machineId, variant: licenses.variant })
        .from(activations)
        .innerJoin(licenses, eq(activations.licenseId, licenses.id))
        .where(inArray(activations.machineId, machineIds))
    : []
  const variantsByMachine = new Map<string, string[]>()
  for (const r of variantRows) {
    if (!r.machineId) continue
    const list = variantsByMachine.get(r.machineId) ?? []
    if (!list.includes(r.variant)) list.push(r.variant)
    variantsByMachine.set(r.machineId, list)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Your software"
        title="Devices"
        description="Every computer and till that has activated Omnix against one of your licences."
      />

      <ListSearch label="Search devices" placeholder="Search hostname or device ID…" />

      {rows.length === 0 ? (
        q ? (
          <FilteredEmptyState query={q} clearHref="/dashboard/machines" entityLabel="devices" />
        ) : (
          <EmptyState
            title="No devices activated yet"
            body="Install Omnix on your till and paste your licence key on first launch — it will show up here within minutes."
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/downloads">Get the installer</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="min-w-[160px]">
                    <Link
                      href={`/dashboard/machines/${m.id}`}
                      className="font-medium text-[var(--color-fg)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
                    >
                      {m.hostname ?? '—'}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                    {(variantsByMachine.get(m.id) ?? (m.activeModule ? [m.activeModule] : ['core'])).join(' · ')}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {m.os} · v{m.currentVersion ?? '?'}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-[12px] text-[var(--color-fg-muted)]">
                    {m.branchName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <HeartbeatPill lastSeenAt={m.lastSeenAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      {m.status !== 'revoked' ? (
                        <ReleaseSeatButton machineId={m.id} hostname={m.hostname} variant="compact" />
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                          Revoked
                        </span>
                      )}
                      <Link
                        href={`/dashboard/machines/${m.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        Open →
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListPagination page={page} pageSize={PAGE_SIZE} total={total} label="Device pages" />
        </div>
      )}
    </div>
  )
}
