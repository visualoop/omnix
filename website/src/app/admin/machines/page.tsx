import { desc } from 'drizzle-orm'
import { db, machines } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Machines' }

export default async function AdminMachinesPage() {
  const rows = await db.select().from(machines).orderBy(desc(machines.lastSeenAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Machines" description="Every desktop install across all customers." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          None yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((m) => (
            <li key={m.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-baseline gap-3 px-4 py-3 text-[13px]">
              <span className="text-[var(--color-fg)] font-medium">{m.hostname ?? '—'}</span>
              <span className="text-[var(--color-fg-muted)]">{m.os} · v{m.currentVersion ?? '?'}</span>
              <span className="text-[var(--color-fg-muted)]">{m.city ?? '—'}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{m.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
