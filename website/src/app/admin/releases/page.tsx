import { desc } from 'drizzle-orm'
import { db, releases } from '@/db'
import { PageHeader } from '@/components/layout/page-header'
import { ReleasesSyncButton } from './sync-button'

export const metadata = { title: 'Admin · Releases' }
export const dynamic = 'force-dynamic'

export default async function AdminReleasesPage() {
  const rows = await db.select().from(releases).orderBy(desc(releases.publishedAt)).limit(50)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Releases"
        description="Desktop installer manifest. Auto-updater reads from /api/releases/latest. Hit Sync to pull the latest builds from GitHub."
      />
      <div className="flex items-center justify-end">
        <ReleasesSyncButton />
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No releases in DB yet. Click Sync to import from GitHub.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[80px_60px_1fr_140px_140px_120px] items-baseline gap-3 px-4 py-3 text-[13px]">
              <code className="font-mono">{r.version}</code>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">{r.channel}</span>
              <span className="text-[var(--color-fg-muted)] truncate">{r.notes?.split('\n')[0] ?? '—'}</span>
              {r.exeUrl ? (
                <a href={r.exeUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-foreground underline-offset-4 hover:underline truncate">.exe</a>
              ) : <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">no .exe</span>}
              {r.msiUrl ? (
                <a href={r.msiUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-foreground underline-offset-4 hover:underline truncate">.msi</a>
              ) : <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">no .msi</span>}
              <time className="font-mono text-[11px] text-[var(--color-fg-muted)]">{r.publishedAt.toISOString().slice(0, 10)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
