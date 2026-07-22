import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db, releases } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/dashboard/status-utils'

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

  const platforms: Array<{ label: string; url: string | null }> = [
    { label: 'Windows (.msi)', url: r?.msiUrl ?? null },
    { label: 'macOS (.dmg)', url: r?.dmgUrl ?? null },
    { label: 'Linux (AppImage)', url: r?.appImageUrl ?? null },
  ]

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={[{ label: 'Downloads', href: '/dashboard/downloads' }, { label: variant }]} />
      <PageHeader eyebrow="Your software" title={`Omnix · ${variant}`} description="Latest stable build." />

      {!r ? (
        <EmptyState title="No release published yet" body="Installers will appear here once a stable build ships." />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {platforms.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-3 px-4 py-3.5 text-[13px]">
              <span className="text-[var(--color-fg)]">{p.label}</span>
              {p.url ? (
                <Button asChild size="xs" variant="outline">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" download>
                    Download
                  </a>
                </Button>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  Unavailable
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
