import { desc } from 'drizzle-orm'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr'
import { db, releases } from '@/db'
import { ReleaseEntry } from '@/components/admin/release-entry'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { ReleasesSyncButton } from './sync-button'

export const metadata = { title: 'Admin · Releases' }
export const dynamic = 'force-dynamic'

export default async function AdminReleasesPage() {
  const rows = await db.select().from(releases).orderBy(desc(releases.publishedAt)).limit(50)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Releases"
        description="Desktop installer manifest. The Tauri auto-updater reads the latest stable here. Hit Sync to pull the most recent GitHub releases into the table."
        actions={<ReleasesSyncButton />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ArrowSquareOut weight="regular" className="size-8" />}
          title="No releases in the database yet."
          description="Click Sync above to import the latest builds from GitHub. Each tag becomes a row with .exe + .msi download links."
        />
      ) : (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
          {rows.map((r, i) => (
            <ReleaseEntry key={r.id} r={r} isLatest={i === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
