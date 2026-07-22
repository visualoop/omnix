import { count, desc, ilike, or } from 'drizzle-orm'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr'
import { db, releases } from '@/db'
import { ReleaseEntry } from '@/components/admin/release-entry'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'
import { ReleasesSyncButton } from './sync-button'

export const metadata = { title: 'Admin · Releases' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Search across the version tag, channel, and release notes.
  const where = q
    ? or(
        ilike(releases.version, `%${q}%`),
        ilike(releases.channel, `%${q}%`),
        ilike(releases.notes, `%${q}%`),
      )
    : undefined

  // Stable ordering (published_at, then version) so paging is deterministic;
  // count() gives a stable total for the pager.
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(releases)
      .where(where)
      .orderBy(desc(releases.publishedAt), desc(releases.version))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(releases).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Releases"
        description="Desktop installer manifest. The Tauri auto-updater reads the latest stable here. Hit Sync to pull the most recent GitHub releases into the table."
        actions={<ReleasesSyncButton />}
      />

      <AdminSearch placeholder="Search by version, channel, or notes…" label="Search releases" />

      {rows.length === 0 ? (
        q ? (
          <FilteredEmptyState
            query={q}
            clearHref="/admin/releases"
            entityLabel="releases"
          />
        ) : (
          <EmptyState
            icon={<ArrowSquareOut weight="regular" className="size-8" />}
            title="No releases in the database yet."
            description="Click Sync above to import the latest builds from GitHub. Each tag becomes a row with .exe + .msi download links."
          />
        )
      ) : (
        <>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {rows.map((r, i) => (
              <ReleaseEntry key={r.id} r={r} isLatest={page === 1 && !q && i === 0} />
            ))}
          </div>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}
