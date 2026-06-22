import { desc } from 'drizzle-orm'
import { db, supportTickets } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Tickets' }

export default async function AdminTicketsPage() {
  const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Support tickets" description="Open + recent tickets across all customers." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          None yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((t) => (
            <li key={t.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-baseline gap-3 px-4 py-3 text-[13px]">
              <span className="text-[var(--color-fg)] font-medium truncate">{t.subject}</span>
              <span className="text-[var(--color-fg-muted)]">{t.category}</span>
              <span className="text-[var(--color-fg-muted)]">{t.priority}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{t.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
