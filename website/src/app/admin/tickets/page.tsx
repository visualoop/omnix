import { desc, eq } from 'drizzle-orm'
import { ChatCircle } from '@phosphor-icons/react/dist/ssr'
import { db, supportTickets, user } from '@/db'
import { TicketCard } from '@/components/admin/ticket-card'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Tickets' }
export const dynamic = 'force-dynamic'

const COLUMNS = [
  { key: 'open',     title: 'Open',     hint: 'awaiting first reply' },
  { key: 'pending',  title: 'Waiting',  hint: 'on customer or third party' },
  { key: 'resolved', title: 'Resolved', hint: 'closed in the last 30 days' },
] as const

export default async function AdminTicketsPage() {
  const rows = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      customerEmail: user.email,
    })
    .from(supportTickets)
    .leftJoin(user, eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(150)

  const buckets = COLUMNS.reduce<Record<string, typeof rows>>((acc, c) => {
    acc[c.key] = rows.filter((t) => t.status === c.key)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Support tickets"
        description="Every customer ticket, columned by status. Priority chip on each card; high priority reads in clay-red."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ChatCircle weight="regular" className="size-8" />}
          title="Inbox zero."
          description="No support tickets in the system yet. Customers can open one from /dashboard/support."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.key}>
              <header className="mb-3 flex items-baseline justify-between border-b border-[var(--color-border)] pb-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                  {c.title}
                  <span className="ml-2 font-mono tabular-nums text-[var(--color-fg-subtle)]">{buckets[c.key].length}</span>
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">{c.hint}</span>
              </header>
              {buckets[c.key].length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--color-border)] bg-transparent px-4 py-8 text-center text-[12px] text-[var(--color-fg-subtle)]">
                  None.
                </div>
              ) : (
                <div className="space-y-3">
                  {buckets[c.key].map((t) => <TicketCard key={t.id} t={t} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
