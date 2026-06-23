import { desc, sql } from 'drizzle-orm'
import { Desktop } from '@phosphor-icons/react/dist/ssr'
import { db, machines } from '@/db'
import { MachineCard } from '@/components/admin/machine-card'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Machines' }
export const dynamic = 'force-dynamic'

export default async function AdminMachinesPage() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [allRows, liveCount, recentCount, idleCount, downCount] = await Promise.all([
    db.select().from(machines).orderBy(desc(machines.lastSeenAt)).limit(200),
    db.select({ n: sql<number>`count(*)::int` }).from(machines).where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`),
    db.select({ n: sql<number>`count(*)::int` }).from(machines).where(sql`${machines.lastSeenAt} > ${oneHourAgo} AND ${machines.lastSeenAt} <= ${fiveMinAgo}`),
    db.select({ n: sql<number>`count(*)::int` }).from(machines).where(sql`${machines.lastSeenAt} > ${oneDayAgo} AND ${machines.lastSeenAt} <= ${oneHourAgo}`),
    db.select({ n: sql<number>`count(*)::int` }).from(machines).where(sql`${machines.lastSeenAt} <= ${oneDayAgo} OR ${machines.lastSeenAt} IS NULL`),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Machines"
        description="Every Omnix install in the field, drawn as a card so you can see the state at a glance. The header dot shows whether the machine has phoned home recently."
      />

      {/* Status legend / filter strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Legend label="Live" hint="last 5 min" count={liveCount[0].n} dotColor="var(--color-accent)" pulse />
        <Legend label="Recent" hint="last hour" count={recentCount[0].n} dotColor="var(--color-positive)" />
        <Legend label="Idle" hint="last 24h" count={idleCount[0].n} dotColor="var(--color-fg-subtle)" />
        <Legend label="Down" hint="silent" count={downCount[0].n} dotColor="var(--color-negative)" />
      </div>

      {allRows.length === 0 ? (
        <EmptyState
          icon={<Desktop weight="regular" className="size-8" />}
          title="No machines yet."
          description="Once a customer activates an Omnix install, it'll phone home every 30 seconds and appear here as a live card."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allRows.map((m) => (
            <MachineCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function Legend({
  label, hint, count, dotColor, pulse,
}: { label: string; hint: string; count: number; dotColor: string; pulse?: boolean }) {
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
