import { notFound } from 'next/navigation'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db, user, auditLog, supportTickets } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { buildClearHref } from '@/lib/list-query'
import { formatDate, formatDateShort } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ticketPage?: string; ticketQ?: string; actionPage?: string; actionQ?: string }>
}

const num = (v: string | undefined) => Math.max(1, parseInt(v ?? '1', 10) || 1)

export default async function AdminTeamMemberPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const u = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (!u) notFound()

  const isStaff = u.role !== 'user'

  const ticketPage = num(sp.ticketPage), ticketQ = sp.ticketQ?.trim() ?? ''
  const actionPage = num(sp.actionPage), actionQ = sp.actionQ?.trim() ?? ''

  const clearHref = (tab: string, drop: string[]) =>
    buildClearHref(`/admin/team/${id}`, sp as Record<string, string | undefined>, { drop, set: { tab } })

  const ticketWhere = and(
    eq(supportTickets.assignedTo, id),
    ticketQ ? or(ilike(supportTickets.subject, `%${ticketQ}%`), ilike(supportTickets.priority, `%${ticketQ}%`), ilike(supportTickets.status, `%${ticketQ}%`)) : undefined,
  )
  const actionWhere = and(
    eq(auditLog.actorId, id),
    actionQ ? or(ilike(auditLog.action, `%${actionQ}%`), ilike(auditLog.resource, `%${actionQ}%`)) : undefined,
  )

  const [assignedTickets, ticketCountRow, actions, actionCountRow] = await Promise.all([
    db.select().from(supportTickets).where(ticketWhere).orderBy(desc(supportTickets.updatedAt)).limit(PAGE_SIZE).offset((ticketPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(supportTickets).where(ticketWhere),
    db.select().from(auditLog).where(actionWhere).orderBy(desc(auditLog.createdAt)).limit(PAGE_SIZE).offset((actionPage - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(auditLog).where(actionWhere),
  ])

  const ticketCount = ticketCountRow[0]?.n ?? 0
  const actionCount = actionCountRow[0]?.n ?? 0

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Team', href: '/admin/team' }, { label: u.name }]} />
      <BackButton fallback="/admin/team" label="Back to team" />
      <EntityHero
        eyebrow={isStaff ? 'Staff member' : 'User'}
        title={u.name}
        subtitle={[u.email, u.staffTeam].filter(Boolean).join(' · ')}
        badges={[
          { label: u.role, variant: isStaff ? 'default' : 'secondary' },
          ...(u.banned ? [{ label: 'Banned', variant: 'destructive' as const }] : []),
        ]}
        stats={[
          { label: 'Joined', value: formatDate(u.createdAt) },
          { label: 'Team', value: u.staffTeam ?? '—' },
          { label: 'Actions', value: actionCount },
          { label: 'Assigned tickets', value: ticketCount },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'tickets',
            label: 'Assigned tickets',
            count: ticketCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search assigned tickets by subject or status…" label="Search assigned tickets" paramName="ticketQ" pageParamName="ticketPage" />
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {assignedTickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface)]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{t.subject}</span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{t.priority} · {t.status}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{formatDateShort(t.updatedAt)}</span>
                      </Link>
                    </li>
                  ))}
                  {assignedTickets.length === 0 && (
                    ticketQ ? (
                      <li><FilteredEmptyState query={ticketQ} clearHref={clearHref('tickets', ['ticketQ', 'ticketPage'])} entityLabel="tickets" /></li>
                    ) : (
                      <li className="px-4 py-3 text-sm text-[var(--color-fg-muted)]">No tickets assigned.</li>
                    )
                  )}
                </ul>
                <AdminPagination page={ticketPage} pageSize={PAGE_SIZE} total={ticketCount} pageParamName="ticketPage" label="Assigned tickets pages" />
              </div>
            ),
          },
          {
            id: 'actions',
            label: 'Actions',
            count: actionCount,
            content: (
              <div className="flex flex-col gap-3">
                <AdminSearch placeholder="Search actions by action or resource…" label="Search staff actions" paramName="actionQ" pageParamName="actionPage" />
                <ol className="flex flex-col gap-3">
                  {actions.map((a) => (
                    <li key={a.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-[var(--color-border)] pb-2.5">
                      <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
                        {formatDateShort(a.createdAt)}
                      </time>
                      <Link href={`/admin/audit/${a.id}`} className="flex flex-col gap-0.5 hover:text-[var(--color-fg)]">
                        <span className="text-[13px] font-medium">{a.action}</span>
                        {a.resource && <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">{a.resource}</span>}
                      </Link>
                    </li>
                  ))}
                  {actions.length === 0 && (
                    actionQ ? (
                      <li><FilteredEmptyState query={actionQ} clearHref={clearHref('actions', ['actionQ', 'actionPage'])} entityLabel="actions" /></li>
                    ) : (
                      <li className="text-sm text-[var(--color-fg-muted)]">No actions logged.</li>
                    )
                  )}
                </ol>
                <AdminPagination page={actionPage} pageSize={PAGE_SIZE} total={actionCount} pageParamName="actionPage" label="Actions pages" />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
