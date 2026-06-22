import { desc } from 'drizzle-orm'
import { db, auditLog } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Audit' }

export default async function AdminAuditPage() {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Audit log" description="Every system-affecting action. 1-year hot retention; older rows archive to S3." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No events yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((a) => (
            <li key={a.id} className="grid grid-cols-[1fr_2fr_2fr_auto] items-baseline gap-3 px-4 py-3 text-[13px]">
              <code className="font-mono text-[12px] text-[var(--color-fg-muted)]">{a.action}</code>
              <code className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{a.resource ?? '—'}</code>
              <code className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{a.actorId?.slice(0, 12) ?? 'system'}</code>
              <time className="font-mono text-[11px] text-[var(--color-fg-muted)]">{a.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
