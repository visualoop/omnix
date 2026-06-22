import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq, asc } from 'drizzle-orm'
import { db, supportTickets, supportMessages } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  const tRows = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, session.user.id)))
    .limit(1)
  const ticket = tRows[0]
  if (!ticket) notFound()

  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticket.id))
    .orderBy(asc(supportMessages.createdAt))

  return (
    <div className="space-y-6">
      <PageHeading
        title={ticket.subject}
        subtitle={`${ticket.category} · ${ticket.priority} · ${ticket.status}`}
      />

      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
              <span className="font-mono">{m.senderId === session.user.id ? 'You' : 'Support'}</span>
              <time>{m.createdAt.toISOString()}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.55]">{m.body}</p>
          </li>
        ))}
        {messages.length === 0 ? (
          <li className="text-[13px] text-[var(--color-fg-muted)] italic">No replies yet.</li>
        ) : null}
      </ul>
    </div>
  )
}
