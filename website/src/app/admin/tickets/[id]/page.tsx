import { notFound } from 'next/navigation'
import { and, asc, count, eq, ilike } from 'drizzle-orm'
import { db, supportTickets, supportMessages, user } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { buildClearHref } from '@/lib/list-query'
import { formatDate, formatDateShort } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Conversation threads stay in chronological order (oldest first). Pagination
// walks forward through the thread and the visible range is always stated, so
// older messages are never silently hidden — just on an earlier page.
const PAGE_SIZE = 20

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msgPage?: string; msgQ?: string }>
}

const num = (v: string | undefined) => Math.max(1, parseInt(v ?? '1', 10) || 1)

export default async function AdminTicketDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, id) })
  if (!ticket) notFound()

  const msgPage = num(sp.msgPage), msgQ = sp.msgQ?.trim() ?? ''
  const msgWhere = and(
    eq(supportMessages.ticketId, id),
    msgQ ? ilike(supportMessages.body, `%${msgQ}%`) : undefined,
  )

  const [reporter, assignee, messages, msgCountRow] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, ticket.userId) }),
    ticket.assignedTo ? db.query.user.findFirst({ where: eq(user.id, ticket.assignedTo) }) : null,
    db
      .select({ msg: supportMessages, sender: user })
      .from(supportMessages)
      .innerJoin(user, eq(user.id, supportMessages.senderId))
      .where(msgWhere)
      .orderBy(asc(supportMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((msgPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(supportMessages).where(msgWhere),
  ])

  const msgTotal = msgCountRow[0]?.n ?? 0
  const from = msgTotal === 0 ? 0 : (msgPage - 1) * PAGE_SIZE + 1
  const to = Math.min(msgPage * PAGE_SIZE, msgTotal)
  const msgClearHref = buildClearHref(`/admin/tickets/${id}`, sp as Record<string, string | undefined>, { drop: ['msgQ', 'msgPage'] })

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Tickets', href: '/admin/tickets' }, { label: ticket.subject }]} />
      <BackButton fallback="/admin/tickets" label="Back to tickets" />
      <EntityHero
        eyebrow={`Ticket · ${ticket.priority}`}
        title={ticket.subject}
        subtitle={
          <>
            {reporter && (
              <>
                Opened by <Link className="underline" href={`/admin/users/${reporter.id}`}>{reporter.name}</Link>
              </>
            )}
            {assignee && (
              <>
                {' '}
                · assigned to <Link className="underline" href={`/admin/users/${assignee.id}`}>{assignee.name}</Link>
              </>
            )}
          </>
        }
        badges={[
          { label: ticket.status, variant: ticket.status === 'resolved' || ticket.status === 'closed' ? 'default' : 'secondary' },
          { label: ticket.category, variant: 'outline' },
          { label: ticket.priority, variant: ticket.priority === 'urgent' || ticket.priority === 'high' ? 'destructive' : 'outline' },
        ]}
        stats={[
          { label: 'Opened', value: formatDate(ticket.createdAt, true) },
          { label: 'Updated', value: formatDate(ticket.updatedAt, true) },
          { label: 'Messages', value: msgTotal },
        ]}
      />

      <section aria-labelledby="ticket-thread-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="ticket-thread-title" className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">Conversation</h2>
            <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
              {msgTotal === 0
                ? (msgQ ? 'No messages match your search — clear it below to see the full thread.' : 'No replies yet.')
                : `Showing messages ${from.toLocaleString()}–${to.toLocaleString()} of ${msgTotal.toLocaleString()} in chronological order (oldest first).`}
            </p>
          </div>
          <AdminSearch placeholder="Search this conversation…" label="Search ticket messages" paramName="msgQ" pageParamName="msgPage" />
        </div>

        <ol className="flex flex-col gap-4">
          {messages.map((m) => (
            <li key={m.msg.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] pb-2 mb-3">
                <span className="text-[13px] font-medium">{m.sender.name}</span>
                <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
                  {formatDateShort(m.msg.createdAt)}
                </time>
              </div>
              <div className="text-[13px] leading-[1.55] text-[var(--color-fg)] whitespace-pre-wrap">{m.msg.body}</div>
            </li>
          ))}
          {messages.length === 0 && (
            msgQ ? (
              <li><FilteredEmptyState query={msgQ} clearHref={msgClearHref} entityLabel="messages" /></li>
            ) : (
              <li className="text-sm text-[var(--color-fg-muted)]">No replies yet.</li>
            )
          )}
        </ol>

        <AdminPagination page={msgPage} pageSize={PAGE_SIZE} total={msgTotal} pageParamName="msgPage" label="Conversation pages" />
      </section>
    </div>
  )
}
