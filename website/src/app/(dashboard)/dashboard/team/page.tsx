import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, count, eq, desc, ilike, or } from 'drizzle-orm'
import { db, organization, member, user, invitation } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EntityHero } from '@/components/layout/entity-hero'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/dashboard/status-utils'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { ListPagination, ListSearch } from '@/components/dashboard/list-controls'
import { formatDate } from '@/lib/format-date'
import { InvitationsPanel } from '@/components/dashboard/invitations-panel'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function DashboardTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Every org this user is a member of — membership is the authorization
  // boundary for seeing an org's teammates.
  const memberships = await db
    .select({ org: organization, role: member.role, memberId: member.id })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Team' }]} />
        <EntityHero
          eyebrow="Organisation"
          title="No organisation yet"
          subtitle="Create an organisation when you activate Omnix on your first device. Each licence can then be shared across your teammates."
        />
        <EmptyState
          title="Nothing to manage yet"
          body="Activate Omnix on a device to create your organisation, then come back to invite teammates."
        />
      </div>
    )
  }

  // Default to the first org the user owns/admins; fall back to first.
  const primary = memberships.find((m) => m.role === 'owner') ?? memberships[0]

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  const memberWhere = q
    ? and(
        eq(member.organizationId, primary.org.id),
        or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)),
      )
    : eq(member.organizationId, primary.org.id)

  const [members, memberTotalRow, invites] = await Promise.all([
    db
      .select({ user: user, role: member.role, memberId: member.id, joined: member.createdAt })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(memberWhere)
      .orderBy(desc(member.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(memberWhere),
    db.select().from(invitation).where(eq(invitation.organizationId, primary.org.id)).orderBy(desc(invitation.createdAt)),
  ])

  const memberTotal = memberTotalRow[0]?.n ?? 0
  const isOwner = primary.role === 'owner' || primary.role === 'admin'
  const pendingInvites = invites.filter((i) => i.status === 'pending')

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={[{ label: 'Team' }]} />
      <EntityHero
        eyebrow="Organisation"
        title={primary.org.name}
        subtitle={`Your role: ${primary.role}`}
        stats={[
          { label: 'Members', value: memberTotal },
          { label: 'Pending invites', value: pendingInvites.length },
          { label: 'Created', value: formatDate(primary.org.createdAt) },
        ]}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Members
        </h2>
        <ListSearch label="Search members" placeholder="Search by name or email…" />

        {members.length === 0 ? (
          q ? (
            <FilteredEmptyState query={q} clearHref="/dashboard/team" entityLabel="members" />
          ) : (
            <EmptyState
              title="No members yet"
              body="Invite a teammate below to give them access to this organisation."
            />
          )
        ) : (
          <div className="flex flex-col">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium text-[var(--color-fg)]">{m.user.name}</TableCell>
                    <TableCell className="text-[var(--color-fg-muted)]">{m.user.email}</TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                      {formatDate(m.joined)}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                      {m.role}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination page={page} pageSize={PAGE_SIZE} total={memberTotal} label="Member pages" />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Invitations
        </h2>
        <InvitationsPanel
          invites={invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            status: i.status,
            expiresAt: i.expiresAt.toISOString(),
          }))}
          canManage={isOwner}
          orgName={primary.org.name}
        />
      </section>
    </div>
  )
}
