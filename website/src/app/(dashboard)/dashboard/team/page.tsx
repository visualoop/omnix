import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, organization, member, user, invitation } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

export default async function DashboardTeamPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Find every org this user is a member of.
  const memberships = await db
    .select({ org: organization, role: member.role, memberId: member.id })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Breadcrumbs items={[{ label: 'Team' }]} />
        <EntityHero eyebrow="Team" title="No organisation yet" subtitle="Join or create an organisation to manage teammates." />
        <p className="text-sm text-muted-foreground">
          Create an organisation when activating Omnix on your first machine. Each licence
          can be shared across an organisation's members.
        </p>
      </div>
    )
  }

  // Default to the first org the user owns/admins; fall back to first.
  const primary = memberships.find((m) => m.role === 'owner') ?? memberships[0]

  const [members, invites] = await Promise.all([
    db
      .select({ user: user, role: member.role, memberId: member.id, joined: member.createdAt })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, primary.org.id))
      .orderBy(desc(member.createdAt)),
    db.select().from(invitation).where(eq(invitation.organizationId, primary.org.id)).orderBy(desc(invitation.createdAt)),
  ])

  const isOwner = primary.role === 'owner' || primary.role === 'admin'
  const pendingInvites = invites.filter((i) => i.status === 'pending')

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Team' }]} />
      <EntityHero
        eyebrow="Team"
        title={primary.org.name}
        subtitle={`Your role: ${primary.role}`}
        stats={[
          { label: 'Members', value: members.length },
          { label: 'Pending invites', value: pendingInvites.length },
          { label: 'Created', value: formatDate(primary.org.createdAt) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'members',
            label: 'Members',
            count: members.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {members.map((m) => (
                  <li key={m.memberId} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">{m.user.name}</span>
                      <span className="text-[11px] text-muted-foreground">{m.user.email} · joined {formatDate(m.joined)}</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.role}</span>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: 'invitations',
            label: 'Invitations',
            count: invites.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">{inv.email}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {inv.role ?? 'member'} · {inv.status}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Expires {formatDate(inv.expiresAt)}
                    </span>
                  </li>
                ))}
                {invites.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No invitations yet.</li>}
              </ul>
            ),
          },
          ...(isOwner
            ? [
                {
                  id: 'invite',
                  label: 'Invite',
                  render: () => (
                    <div className="rounded-md border border-foreground/10 p-4 max-w-md">
                      <p className="text-[13px] text-muted-foreground mb-3">
                        Invite a teammate via email. They'll receive a link to join {primary.org.name}.
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        Better Auth's organisation plugin handles invites — POST{' '}
                        <code className="font-mono text-[11px]">/api/auth/organization/invite-member</code> with
                        {` `}email, organizationId={primary.org.id}, role.
                      </p>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}
