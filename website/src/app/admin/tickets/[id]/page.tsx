import { notFound } from 'next/navigation'
import { eq, asc } from 'drizzle-orm'
import { db, supportTickets, supportMessages, user } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminTicketDetailPage({ params }: PageProps) {
  const { id } = await params
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, id) })
  if (!ticket) notFound()

  const [reporter, assignee, messages] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, ticket.userId) }),
    ticket.assignedTo ? db.query.user.findFirst({ where: eq(user.id, ticket.assignedTo) }) : null,
    db
      .select({ msg: supportMessages, sender: user })
      .from(supportMessages)
      .innerJoin(user, eq(user.id, supportMessages.senderId))
      .where(eq(supportMessages.ticketId, id))
      .orderBy(asc(supportMessages.createdAt)),
  ])

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
          { label: 'Messages', value: messages.length },
        ]}
      />

      <ol className="flex flex-col gap-4">
        {messages.map((m) => (
          <li key={m.msg.id} className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-baseline justify-between gap-3 border-b border-foreground/5 pb-2 mb-3">
              <span className="text-[13px] font-medium">{m.sender.name}</span>
              <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {formatDateShort(m.msg.createdAt)}
              </time>
            </div>
            <div className="text-[13px] leading-[1.55] text-foreground/85 whitespace-pre-wrap">{m.msg.body}</div>
          </li>
        ))}
        {messages.length === 0 && <li className="text-sm text-muted-foreground">No replies yet.</li>}
      </ol>
    </div>
  )
}
