import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db, releases } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Downloads' }

export default async function DownloadsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/downloads')

  const latest = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(5)

  return (
    <div className="space-y-6">
      <PageHeading title="Downloads" subtitle="Latest installers for Windows, macOS, and Linux." />
      {latest.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No releases published yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {latest.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
              <span className="font-mono">{r.version}</span>
              <span className="text-[var(--color-fg-muted)]">{r.publishedAt.toISOString().slice(0, 10)}</span>
              <div className="flex gap-2">
                {r.msiUrl ? <Link href={r.msiUrl} className="underline-offset-4 hover:underline">Windows</Link> : null}
                {r.dmgUrl ? <Link href={r.dmgUrl} className="underline-offset-4 hover:underline">macOS</Link> : null}
                {r.appImageUrl ? <Link href={r.appImageUrl} className="underline-offset-4 hover:underline">Linux</Link> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
