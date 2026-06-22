import { desc } from 'drizzle-orm'
import { db, user } from '@/db'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Users' }

export default async function AdminUsersPage() {
  const rows = await db.select().from(user).orderBy(desc(user.createdAt)).limit(200)

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Users" description="Every account on the platform — customers + staff." />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No users yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="grid grid-cols-[2fr_1fr_auto] items-baseline gap-3 px-4 py-3 hover:bg-[var(--color-surface)]">
                <div>
                  <span className="text-[14px] text-[var(--color-fg)]">{u.name || u.email.split('@')[0]}</span>
                  <span className="ml-2 font-mono text-[11px] text-[var(--color-fg-muted)]">{u.email}</span>
                </div>
                <div className="text-[12px] text-[var(--color-fg-muted)]">
                  {u.country} · {u.currency}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
                  {u.role}{u.banned ? ' · banned' : ''}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
