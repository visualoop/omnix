import { and, count, desc, ilike, ne, or } from 'drizzle-orm'
import { Users } from '@phosphor-icons/react/dist/ssr'
import { db, user } from '@/db'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { TeamInvite, TeamRoster } from './team-client'

export const metadata = { title: 'Admin · Team' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Staff only (role <> 'user'), optionally narrowed by email/name search.
  const whereClauses = [
    ne(user.role, 'user'),
    q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where = whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)

  // Stable ordering (created_at, then id) so paging is deterministic even when
  // two members were created in the same tick; count() gives a stable total.
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(user).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  const members = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    banned: Boolean(u.banned),
    banReason: u.banReason,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Team"
        description="Everyone on the operator side of Omnix. Invite teammates with the role they need; they get a magic-link sign-in straight to /admin."
      />

      <TeamInvite />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search team by email or name…" label="Search the team roster" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          Current team
          <span className="ml-2 tabular-nums text-[var(--color-fg-subtle)]">{total.toLocaleString()}</span>
        </span>
      </div>

      {members.length === 0 && total === 0 && !q ? (
        <EmptyState
          icon={<Users weight="regular" className="size-8" />}
          title="You're the only one here."
          description="Invite a teammate to share the load. They'll get a magic link to sign in — no password needed."
        />
      ) : members.length === 0 ? (
        <FilteredEmptyState
          query={q || undefined}
          clearHref="/admin/team"
          entityLabel="team members"
        />
      ) : (
        <>
          <TeamRoster members={members} />
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}
