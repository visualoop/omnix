import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq, asc } from 'drizzle-orm'
import { db, supportTickets, supportMessages } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { StatusPill } from '@/components/dashboard/status-utils'
import { formatDateLong } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Ownership gate — a ticket belonging to another account is
  // indistinguishable from one that does not exist.
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
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Support', href: '/dashboard/support' }, { label: ticket.subject }]} />
      <BackButton fallback="/dashboard/support" label="Back to support" />
      <EntityHero
        eyebrow="Support ticket"
        title={ticket.subject}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill kind="ticket" status={ticket.status} />
            <span className="capitalize text-[var(--color-fg-muted)]">
              {ticket.category} · {ticket.priority} priority
            </span>
          </span>
        }
      />

      <ol className="flex flex-col gap-3">
        {messages.map((m) => {
          const fromYou = m.senderId === session.user.id
          return (
            <li
              key={m.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-mono uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
                  {fromYou ? 'You' : 'Omnix support'}
                </span>
                <time className="font-mono text-[var(--color-fg-subtle)]">{formatDateLong(m.createdAt)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--color-fg)]">{m.body}</p>
            </li>
          )
        })}
        {messages.length === 0 ? (
          <li className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
            No replies yet. We reply on weekdays within 4 hours.
          </li>
        ) : null}
      </ol>
    </div>
  )
}
