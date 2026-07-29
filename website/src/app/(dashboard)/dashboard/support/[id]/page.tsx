import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, asc, count, eq, ilike } from 'drizzle-orm'
import { db, supportTickets, supportMessages } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { StatusPill } from '@/components/dashboard/status-utils'
import { ListPagination, ListSearch } from '@/components/dashboard/list-controls'
import { SupportMessageForm } from '@/components/dashboard/support-message-form'
import { formatDateLong } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const num = (value: string | undefined) => Math.max(1, parseInt(value ?? '1', 10) || 1)

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msgPage?: string; msgQ?: string }>
}

export default async function TicketDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
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

  const msgPage = num(sp.msgPage)
  const msgQ = sp.msgQ?.trim() ?? ''
  const msgWhere = and(
    eq(supportMessages.ticketId, ticket.id),
    msgQ ? ilike(supportMessages.body, `%${msgQ}%`) : undefined,
  )
  const [messages, msgCountRow, allMsgCountRow] = await Promise.all([
    db
      .select()
      .from(supportMessages)
      .where(msgWhere)
      .orderBy(asc(supportMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((msgPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(supportMessages).where(msgWhere),
    db.select({ n: count() }).from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)),
  ])
  const msgTotal = msgCountRow[0]?.n ?? 0
  const allMsgTotal = allMsgCountRow[0]?.n ?? 0

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

      <section aria-labelledby="buyer-ticket-conversation" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="buyer-ticket-conversation" className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
              Conversation
            </h2>
            <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
              {msgQ ? `${msgTotal.toLocaleString()} matching message${msgTotal === 1 ? '' : 's'}.` : `${allMsgTotal.toLocaleString()} message${allMsgTotal === 1 ? '' : 's'} in chronological order.`}
            </p>
          </div>
          <ListSearch
            label="Search conversation"
            placeholder="Search messages…"
            paramName="msgQ"
            pageParam="msgPage"
          />
        </div>

        <ol className="flex flex-col gap-3">
          {messages.map((message) => {
            const fromYou = message.senderId === session.user.id
            return (
              <li
                key={message.id}
                className={`flex ${fromYou ? 'justify-end' : 'justify-start'}`}
              >
                <article
                  aria-label={`${fromYou ? 'Your message' : 'Message from Omnix support'} sent ${formatDateLong(message.createdAt)}`}
                  className={`w-fit max-w-[min(88%,44rem)] rounded-[var(--radius-md)] border p-4 ${
                    fromYou
                      ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[11px]">
                    <span className={`font-mono uppercase tracking-[0.16em] ${fromYou ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'}`}>
                      {fromYou ? 'You' : 'Omnix support'}
                    </span>
                    <time className="font-mono text-[var(--color-fg-subtle)]">{formatDateLong(message.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--color-fg)]">{message.body}</p>
                </article>
              </li>
            )
          })}
          {messages.length === 0 ? (
            <li className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
              {msgQ ? `No messages match “${msgQ}”.` : 'No messages yet. Add the first update below.'}
            </li>
          ) : null}
        </ol>

        <ListPagination
          page={msgPage}
          pageSize={PAGE_SIZE}
          total={msgTotal}
          pageParam="msgPage"
          label="Ticket conversation pages"
        />
      </section>

      <SupportMessageForm
        ticketId={ticket.id}
        status={ticket.status}
        replyPage={Math.max(1, Math.ceil((allMsgTotal + 1) / PAGE_SIZE))}
      />
    </div>
  )
}
