import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, Plus } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDashboardCustomer } from '@/lib/dashboard-helpers'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  formatRelative,
  PageHeading,
  StatusPill,
} from '@/components/dashboard/status-utils'

export const metadata = { title: 'Support' }

export default async function SupportPage() {
  const reqHeaders = await headers()
  const customer = await getDashboardCustomer(reqHeaders)
  const user = customer as unknown as { id: string | number; email: string; fullName?: string; businessName?: string; collection?: string }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await payload.find({
    collection: 'support-tickets',
    where: { customer: { equals: user.id } },
    sort: '-updatedAt',
    limit: 50,
  })

  const tickets = res.docs as unknown as {
    id: string
    ticketNumber?: string
    subject: string
    status: string
    priority: string
    category?: string
    updatedAt: string
  }[]

  return (
    <div className="space-y-8">
      <PageHeading
        title="Support tickets"
        subtitle="Open a new ticket or follow up on existing ones. The owner reads every reply."
        actions={
          <Button asChild>
            <Link href="/dashboard/support/new">
              <Plus className="size-4" />
              New ticket
            </Link>
          </Button>
        }
      />

      {tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet."
          body="If something isn't working or you have a question, open a ticket — we'll attach your licence and machine context automatically."
          action={
            <Button asChild>
              <Link href="/dashboard/support/new">Open ticket</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)]">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/support/${t.id}`}
                className="group flex items-start gap-4 bg-[var(--color-surface)] px-6 py-5 transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                      {t.ticketNumber ?? '—'}
                    </span>
                    <h3 className="font-display text-[16px] font-medium text-[var(--color-fg)]">
                      {t.subject}
                    </h3>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-fg-subtle)]">
                    {t.category?.replace(/_/g, ' ') ?? 'general'} · updated{' '}
                    {formatRelative(t.updatedAt)}
                  </div>
                </div>
                <StatusPill kind="ticket" status={t.status} />
                <ArrowRight className="size-4 text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
