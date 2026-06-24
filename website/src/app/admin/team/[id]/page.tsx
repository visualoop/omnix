import { notFound } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, user, auditLog, supportTickets } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminTeamMemberPage({ params }: PageProps) {
  const { id } = await params
  const u = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (!u) notFound()

  const isStaff = u.role !== 'user'

  const [actions, assignedTickets] = await Promise.all([
    db.select().from(auditLog).where(eq(auditLog.actorId, id)).orderBy(desc(auditLog.createdAt)).limit(100),
    db.select().from(supportTickets).where(eq(supportTickets.assignedTo, id)).orderBy(desc(supportTickets.updatedAt)).limit(50),
  ])

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
          { label: 'Actions', value: actions.length },
          { label: 'Assigned tickets', value: assignedTickets.length },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'tickets',
            label: 'Assigned tickets',
            count: assignedTickets.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {assignedTickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{t.subject}</span>
                        <span className="text-[11px] text-muted-foreground">{t.priority} · {t.status}</span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatDateShort(t.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
                {assignedTickets.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No tickets assigned.</li>}
              </ul>
            ),
          },
          {
            id: 'actions',
            label: 'Actions',
            count: actions.length,
            render: () => (
              <ol className="flex flex-col gap-3">
                {actions.map((a) => (
                  <li key={a.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
                    <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {formatDateShort(a.createdAt)}
                    </time>
                    <Link href={`/admin/audit/${a.id}`} className="flex flex-col gap-0.5 hover:text-foreground">
                      <span className="text-[13px] font-medium">{a.action}</span>
                      {a.resource && <span className="text-[11px] text-muted-foreground font-mono">{a.resource}</span>}
                    </Link>
                  </li>
                ))}
                {actions.length === 0 && <li className="text-sm text-muted-foreground">No actions logged.</li>}
              </ol>
            ),
          },
        ]}
      />
    </div>
  )
}
