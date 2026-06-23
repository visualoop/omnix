import { desc, eq, ne, sql } from 'drizzle-orm'
import { Users } from '@phosphor-icons/react/dist/ssr'
import { db, user } from '@/db'
import { UserCard } from '@/components/admin/user-card'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Users' }
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const [all, staff, banned] = await Promise.all([
    db.select().from(user).orderBy(desc(user.createdAt)).limit(120),
    db.select({ n: sql<number>`count(*)::int` }).from(user).where(ne(user.role, 'user')),
    db.select({ n: sql<number>`count(*)::int` }).from(user).where(eq(user.banned, true)),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Every account — customers, support agents, sales reps, platform admins. Staff get the copper avatar treatment; banned accounts read in clay-red."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={all.length} />
        <Stat label="Staff" value={staff[0].n} accent />
        <Stat label="Banned" value={banned[0].n} negative={banned[0].n > 0} />
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={<Users weight="regular" className="size-8" />}
          title="No users yet."
          description="Sign-ups via /login or pre-seeded admins land here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {all.map((u) => (
            <UserCard key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent, negative }: { label: string; value: number; accent?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{label}</div>
      <div
        className="mt-1 font-mono tabular-nums text-[20px]"
        style={{
          color: accent ? 'var(--color-accent)' : negative ? 'var(--color-negative)' : 'var(--color-fg)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
