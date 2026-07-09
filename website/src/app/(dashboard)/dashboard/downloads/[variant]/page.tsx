import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db, releases } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { PageHeading } from '@/components/dashboard/status-utils'

const VARIANTS = ['pro', 'dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const

export default async function DownloadsVariantPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  if (!(VARIANTS as readonly string[]).includes(variant)) notFound()

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect(`/login?next=/dashboard/downloads/${variant}`)

  // The desktop installer ships every variant; the channel filter is what
  // we honour. Latest stable for now.
  const rows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(1)

  const r = rows[0]

  return (
    <div className="space-y-6">
      <PageHeading title={`Omnix · ${variant}`} subtitle="Latest stable build." />
      {!r ? (
        <p className="text-[13px] text-[var(--color-fg-muted)]">No release published yet.</p>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"><span>Windows (.msi)</span>{r.msiUrl ? <a href={r.msiUrl} className="underline-offset-4 hover:underline">Download</a> : <span className="text-[var(--color-fg-muted)]">—</span>}</li>
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"><span>macOS (.dmg)</span>{r.dmgUrl ? <a href={r.dmgUrl} className="underline-offset-4 hover:underline">Download</a> : <span className="text-[var(--color-fg-muted)]">—</span>}</li>
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"><span>Linux (AppImage)</span>{r.appImageUrl ? <a href={r.appImageUrl} className="underline-offset-4 hover:underline">Download</a> : <span className="text-[var(--color-fg-muted)]">—</span>}</li>
        </ul>
      )}
    </div>
  )
}
