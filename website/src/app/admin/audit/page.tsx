import { count, desc, ilike, or } from 'drizzle-orm'
import { ListMagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import { db, auditLog } from '@/db'
import { AuditEntry } from '@/components/admin/audit-entry'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'

export const metadata = { title: 'Admin · Audit' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Server-authoritative filter: match the action verb or the affected
  // resource. Keeps the feed searchable without shipping the whole log.
  const where = q
    ? or(ilike(auditLog.action, `%${q}%`), ilike(auditLog.resource, `%${q}%`))
    : undefined

  // Stable ordering (created_at, then id) so paging can't drop or repeat a
  // row when two events share a timestamp; count() gives a stable total.
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(auditLog).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        description="Every system-affecting action — admin role changes, payment outcomes, license issues, ban events. Hot-retained for 1 year; older rows archive to S3."
      />

      <AdminSearch placeholder="Search by action or resource…" label="Search the audit log" />

      {rows.length === 0 ? (
        q ? (
          <FilteredEmptyState
            query={q}
            clearHref="/admin/audit"
            entityLabel="audit entries"
          />
        ) : (
          <EmptyState
            icon={<ListMagnifyingGlass weight="regular" className="size-8" />}
            title="Nothing to audit."
            description="Once admins act on the platform — promote, ban, refund, sync — the events appear here."
          />
        )
      ) : (
        <>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {rows.map((a) => (
              <AuditEntry key={a.id} a={a} />
            ))}
          </div>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}
