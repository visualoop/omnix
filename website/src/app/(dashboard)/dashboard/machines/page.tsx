import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike, or, inArray } from 'drizzle-orm'
import { db, machines, activations, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { ReleaseSeatButton } from '@/components/dashboard/release-seat-button'

export const metadata = { title: 'Machines' }

const PAGE_SIZE = 25

function HeartbeatPill({ lastSeenAt }: { lastSeenAt: Date | string | null }) {
  if (!lastSeenAt) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        Never
      </span>
    )
  }
  const ts = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt
  const ageMin = (Date.now() - ts.getTime()) / 60_000
  const ageHrs = ageMin / 60
  const ageDays = ageHrs / 24
  let tone = ''
  let label = ''
  if (ageMin < 5) {
    tone = 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    label = 'Live'
  } else if (ageHrs < 1) {
    tone = 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 border-emerald-500/20'
    label = `${Math.round(ageMin)}m`
  } else if (ageHrs < 24) {
    tone = 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
    label = `${Math.round(ageHrs)}h`
  } else {
    tone = 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
    label = `${Math.round(ageDays)}d`
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
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

  // Every variant activated on each machine. A single PC can hold
  // several trade licences (Dawa + Retail + Hardware), so the lone
  // machines.activeModule column (last-written) under-reports what's
  // really installed. Join through the activations table to list them
  // all per machine.
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
    <div className="space-y-6">
      <PageHeading title="Machines" subtitle="Every desktop install activated against your licences." />

      <AdminSearch placeholder="Search hostname or machine ID…" />

      {rows.length === 0 && total === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          {q
            ? 'No machines match that search.'
            : 'No machines yet. Install Omnix on your till and paste your licence key on first launch.'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead className="text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="min-w-[160px]">
                    <Link
                      href={`/dashboard/machines/${m.id}`}
                      className="font-medium hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
                    >
                      {m.hostname ?? '—'}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                    {(() => {
                      const vs = variantsByMachine.get(m.id) ?? (m.activeModule ? [m.activeModule] : ['core'])
                      return vs.join(' · ')
                    })()}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {m.os} · v{m.currentVersion ?? '?'}
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[160px]">
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
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                          Revoked
                        </span>
                      )}
                      <Link
                        href={`/dashboard/machines/${m.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      >
                        Open →
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}
