import { and, count, desc, eq, ilike, or, sql, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { Desktop } from '@phosphor-icons/react/dist/ssr'
import { db, machines, user, licenses, activations } from '@/db'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminPagination,
  AdminSearch,
  AdminSelectFilter,
} from '@/components/admin/data-controls'

export const metadata = { title: 'Admin · Machines' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'rebinding', label: 'Rebinding' },
]

const MODULE_OPTIONS = [
  { value: 'dawa', label: 'Dawa' },
  { value: 'retail', label: 'Retail' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'salon', label: 'Salon & Spa' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'core', label: 'Core' },
]

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

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : status === 'revoked'
        ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
        : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      {status}
    </span>
  )
}

export default async function AdminMachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; activeModule?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? ''
  const activeModule = sp.activeModule ?? ''

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const whereClauses = [
    q
      ? or(
          ilike(machines.hostname, `%${q}%`),
          ilike(machines.machineId, `%${q}%`),
          ilike(user.email, `%${q}%`),
        )
      : null,
    status ? eq(machines.status, status) : null,
    activeModule ? eq(machines.activeModule, activeModule) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses)

  const [rows, totalRow, liveCount, recentCount, idleCount, downCount] = await Promise.all([
    db
      .select({
        id: machines.id,
        hostname: machines.hostname,
        machineId: machines.machineId,
        os: machines.os,
        currentVersion: machines.currentVersion,
        activeModule: machines.activeModule,
        status: machines.status,
        lastSeenAt: machines.lastSeenAt,
        customerEmail: user.email,
        licenseKey: licenses.licenseKey,
      })
      .from(machines)
      .leftJoin(user, eq(user.id, machines.userId))
      .leftJoin(licenses, eq(licenses.id, machines.licenseId))
      .where(where)
      .orderBy(desc(machines.lastSeenAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(machines).leftJoin(user, eq(user.id, machines.userId)).where(where),
    db.select({ n: sql<number>`count(*)::int` }).from(machines).where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(machines)
      .where(sql`${machines.lastSeenAt} > ${oneHourAgo} AND ${machines.lastSeenAt} <= ${fiveMinAgo}`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(machines)
      .where(sql`${machines.lastSeenAt} > ${oneDayAgo} AND ${machines.lastSeenAt} <= ${oneHourAgo}`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(machines)
      .where(sql`${machines.lastSeenAt} <= ${oneDayAgo} OR ${machines.lastSeenAt} IS NULL`),
  ])

  const total = totalRow[0]?.n ?? 0

  // All variants activated on each listed machine (a PC can hold
  // several trade licences). machines.activeModule only stores the
  // last-activated one, so we join through activations to list them.
  const mIds = rows.map((m) => m.id)
  const variantRows = mIds.length
    ? await db
        .selectDistinct({ machineId: activations.machineId, variant: licenses.variant })
        .from(activations)
        .innerJoin(licenses, eq(activations.licenseId, licenses.id))
        .where(inArray(activations.machineId, mIds))
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
      <PageHeader
        eyebrow="Platform"
        title="Machines"
        description="Every Omnix install in the field. Filter by status or active module, search by hostname / machine ID / customer email."
      />

      {/* Status legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Legend label="Live" hint="last 5 min" count={liveCount[0].n} dotColor="var(--color-accent)" pulse />
        <Legend label="Recent" hint="last hour" count={recentCount[0].n} dotColor="var(--color-positive)" />
        <Legend label="Idle" hint="last 24h" count={idleCount[0].n} dotColor="var(--color-fg-subtle)" />
        <Legend label="Down" hint="silent" count={downCount[0].n} dotColor="var(--color-negative)" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search hostname, machine ID, or customer email…" />
        <div className="flex items-center gap-4">
          <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
          <AdminSelectFilter paramName="activeModule" label="Module" options={MODULE_OPTIONS} />
        </div>
      </div>

      {rows.length === 0 ? (
        q || status || activeModule ? (
          <FilteredEmptyState
            query={q || undefined}
            clearHref="/admin/machines"
            entityLabel="machines"
          />
        ) : (
          <EmptyState
            icon={<Desktop weight="regular" className="size-8" />}
            title="No machines yet."
            description="Once a customer activates an Omnix install, it phones home every 30s and appears here."
          />
        )
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="min-w-[160px]">
                    <Link
                      href={`/admin/machines/${m.id}`}
                      className="font-mono text-[12px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
                    >
                      {m.hostname || m.machineId.slice(0, 12) + '…'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[200px]">
                    {m.customerEmail ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                    {m.licenseKey ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em]">
                    {(variantsByMachine.get(m.id) ?? (m.activeModule ? [m.activeModule] : ['core'])).join(' · ')}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    v{m.currentVersion ?? '?'}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={m.status} />
                  </TableCell>
                  <TableCell>
                    <HeartbeatPill lastSeenAt={m.lastSeenAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/machines/${m.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      Open →
                    </Link>
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

function Legend({
  label,
  hint,
  count,
  dotColor,
  pulse,
}: {
  label: string
  hint: string
  count: number
  dotColor: string
  pulse?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className="relative inline-grid place-items-center size-3 shrink-0">
        {pulse && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: dotColor, opacity: 0.18, transform: 'scale(2.2)' }}
          />
        )}
        <span className="size-2 rounded-full" style={{ background: dotColor }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{label}</div>
        <div className="text-[12px] text-[var(--color-fg-subtle)]">{hint}</div>
      </div>
      <div className="font-mono tabular-nums text-[18px] text-[var(--color-fg)]">{count}</div>
    </div>
  )
}
