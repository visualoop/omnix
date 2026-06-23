import { ne, desc } from 'drizzle-orm'
import { Users } from '@phosphor-icons/react/dist/ssr'
import { db, user } from '@/db'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { TeamClient } from './team-client'

export const metadata = { title: 'Admin · Team' }
export const dynamic = 'force-dynamic'

export default async function AdminTeamPage() {
  const rows = await db
    .select()
    .from(user)
    .where(ne(user.role, 'user'))
    .orderBy(desc(user.createdAt))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Team"
        description="Everyone on the operator side of Omnix. Invite teammates with the role they need; they get a magic-link sign-in straight to /admin."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users weight="regular" className="size-8" />}
          title="You're the only one here."
          description="Invite a teammate to share the load. They'll get a magic link to sign in — no password needed."
        />
      ) : null}

      <TeamClient
        initial={rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          banned: Boolean(u.banned),
          banReason: u.banReason,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
