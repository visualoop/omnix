import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { TicketReplyForm } from '@/components/dashboard/ticket-reply-form'
import { formatRelative, StatusPill } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Ticket' }

interface TicketDoc {
  id: string
  ticketNumber?: string
  customer: string | { id: string }
  subject: string
  status: string
  priority: string
  category?: string
  description?: { root?: { children?: { children?: { text?: string }[] }[] } }
  thread?: {
    sender: string
    senderName?: string
    body?: { root?: { children?: { children?: { text?: string }[] }[] } }
    sentAt?: string
  }[]
  createdAt: string
  updatedAt: string
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  let ticket: TicketDoc
  try {
    ticket = (await payload.findByID({
      collection: 'support-tickets',
      id,
    })) as unknown as TicketDoc
    const ownerId = typeof ticket.customer === 'string' ? ticket.customer : ticket.customer?.id
    if (String(ownerId) !== String(user.id)) notFound()
  } catch {
    notFound()
  }

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/support"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All tickets
      </Link>

      <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
            {ticket.ticketNumber}
          </span>
          <StatusPill kind="ticket" status={ticket.status} />
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
            {ticket.priority ?? 'normal'}
          </span>
          {ticket.category ? (
            <span className="text-[11px] text-[var(--color-fg-subtle)]">
              · {ticket.category.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 font-display text-[24px] font-medium text-[var(--color-fg)] sm:text-[28px]">
          {ticket.subject}
        </h1>
        <p className="mt-1 text-[12px] text-[var(--color-fg-subtle)]">
          Opened {formatRelative(ticket.createdAt)} · last update {formatRelative(ticket.updatedAt)}
        </p>
      </header>

      {/* Thread */}
      <section className="space-y-3">
        <ThreadEntry
          sender="customer"
          senderName="You"
          body={extractText(ticket.description)}
          when={ticket.createdAt}
        />
        {(ticket.thread ?? []).map((entry, i) => (
          <ThreadEntry
            key={i}
            sender={entry.sender}
            senderName={entry.senderName ?? entry.sender}
            body={extractText(entry.body)}
            when={entry.sentAt ?? ticket.updatedAt}
          />
        ))}
      </section>

      {ticket.status !== 'closed' && ticket.status !== 'resolved' ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            Reply
          </h2>
          <div className="mt-4">
            <TicketReplyForm ticketId={ticket.id} />
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-[13px] text-[var(--color-fg-muted)]">
          This ticket is {ticket.status}. Reply via WhatsApp or email if you need to follow up.
        </div>
      )}
    </div>
  )
}

function ThreadEntry({
  sender,
  senderName,
  body,
  when,
}: {
  sender: string
  senderName: string
  body: string
  when: string
}) {
  const isStaff = sender !== 'customer'
  return (
    <article
      className={
        isStaff
          ? 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5'
          : 'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5'
      }
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={
              isStaff
                ? 'inline-flex size-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-[11px] font-semibold text-[var(--color-accent-hover)]'
                : 'inline-flex size-7 items-center justify-center rounded-full bg-[var(--color-surface-2)] font-mono text-[11px] font-semibold text-[var(--color-fg-muted)]'
            }
          >
            {senderName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <div className="text-[13px] font-medium text-[var(--color-fg)]">
              {senderName}
            </div>
            <div className="text-[10px] text-[var(--color-fg-subtle)]">
              {sender === 'customer' ? 'You' : sender === 'system' ? 'System' : 'Duka support'}
            </div>
          </div>
        </div>
        <time className="text-[11px] text-[var(--color-fg-subtle)]">
          {formatRelative(when)}
        </time>
      </header>
      <div className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
        {body || '—'}
      </div>
    </article>
  )
}

function extractText(rich?: TicketDoc['description']): string {
  if (!rich || !rich.root || !rich.root.children) return ''
  return rich.root.children
    .map((p) => (p.children ?? []).map((c) => c.text ?? '').join(''))
    .join('\n\n')
}
