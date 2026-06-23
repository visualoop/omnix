import { desc, eq, sql } from 'drizzle-orm'
import { Buildings, Desktop, Users as UsersIcon } from '@phosphor-icons/react/dist/ssr'
import { db, organization, machines, member } from '@/db'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Organisations' }
export const dynamic = 'force-dynamic'

export default async function AdminOrgsPage() {
  const orgs = await db.select().from(organization).orderBy(desc(organization.createdAt)).limit(120)

  // For each org, count machines + members. Cheap because orgs are small (<150).
  const counts = await Promise.all(
    orgs.map(async (o) => {
      const [m, u] = await Promise.all([
        db.select({ n: sql<number>`count(*)::int` }).from(machines).where(eq(machines.organizationId, o.id)),
        db.select({ n: sql<number>`count(*)::int` }).from(member).where(eq(member.organizationId, o.id)),
      ])
      return { id: o.id, machines: m[0].n, members: u[0].n }
    }),
  )
  const countMap = new Map(counts.map((c) => [c.id, c]))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description="Customer businesses that opened multi-user accounts. Each card shows the team size and machine count alongside the brand details."
      />

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Buildings weight="regular" className="size-8" />}
          title="No organisations yet."
          description="Solo customers don't need an org. Once a customer adds a teammate, the org row gets created and lands here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgs.map((o) => {
            const c = countMap.get(o.id) ?? { machines: 0, members: 0 }
            return (
              <div key={o.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div style={{ fontFamily: 'var(--font-display)' }} className="text-[18px] font-medium text-[var(--color-fg)] truncate">
                      {o.name}
                    </div>
                    <code className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{o.slug}</code>
                  </div>
                  <time className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] shrink-0">
                    {o.createdAt.toISOString().slice(0, 10)}
                  </time>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3">
                  <Stat icon={<UsersIcon weight="regular" className="size-3.5" />} label="Members" value={c.members} />
                  <Stat icon={<Desktop weight="regular" className="size-3.5" />} label="Machines" value={c.machines} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-fg-subtle)]">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{label}</span>
      <span className="ml-auto font-mono tabular-nums text-[14px] text-[var(--color-fg)]">{value}</span>
    </div>
  )
}
