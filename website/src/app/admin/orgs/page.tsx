import { desc } from 'drizzle-orm'
import { db, organization } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Orgs' }

export default async function AdminOrgsPage() {
  const rows = await db.select().from(organization).orderBy(desc(organization.createdAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Organisations" description="Customer businesses that opened multi-user orgs." />
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
              <span className="text-[var(--color-fg)] font-medium">{o.name}</span>
              <code className="font-mono text-[11px] text-[var(--color-fg-muted)]">{o.slug}</code>
              <time className="font-mono text-[11px] text-[var(--color-fg-muted)]">{o.createdAt.toISOString().slice(0, 10)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Empty() {
  return <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">None yet.</div>
}
