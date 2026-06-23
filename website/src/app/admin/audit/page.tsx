import { desc } from 'drizzle-orm'
import { ListMagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import { db, auditLog } from '@/db'
import { AuditEntry } from '@/components/admin/audit-entry'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Audit' }
export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(300)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        description="Every system-affecting action — admin role changes, payment outcomes, license issues, ban events. Hot-retained for 1 year; older rows archive to S3."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListMagnifyingGlass weight="regular" className="size-8" />}
          title="Nothing to audit."
          description="Once admins act on the platform — promote, ban, refund, sync — the events appear here."
        />
      ) : (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
          {rows.map((a) => (
            <AuditEntry key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  )
}
