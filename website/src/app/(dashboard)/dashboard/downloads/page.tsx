import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, releases, licenses } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Downloads' }
export const dynamic = 'force-dynamic'

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
interface VariantUrls { exe?: string; msi?: string }

const VARIANT_LABELS: Record<VariantId, string> = {
  pro: 'Pro (all trades)',
  dawa: 'Dawa — pharmacy',
  retail: 'Retail — duka',
  hospitality: 'Hospitality — restaurant',
  hardware: 'Hardware store',
}

/**
 * Customer dashboard /downloads.
 *
 * Shows the latest release with one button per Omnix variant — Pro,
 * Dawa, Retail, Hospitality, Hardware. Each button points to the GitHub
 * .exe asset for that variant. We highlight the variant the customer
 * actually owns (resolved from their licence) so the right binary is
 * one click away.
 *
 * Older releases are listed below as a plain history with a single
 * "see all installers" link to the public /downloads.
 */
export default async function DashboardDownloadsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/downloads')

  const userId = session.user.id

  const [latestRow, customerLicences] = await Promise.all([
    db
      .select()
      .from(releases)
      .where(eq(releases.channel, 'stable'))
      .orderBy(desc(releases.publishedAt))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ variant: licenses.variant, status: licenses.status })
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .orderBy(desc(licenses.createdAt)),
  ])

  const ownedSet = new Set(
    customerLicences
      .filter((l) => l.status !== 'lapsed' && l.status !== 'revoked')
      .map((l) => l.variant as VariantId),
  )
  // If the customer owns Pro, hide the per-trade rows (Pro covers them).
  // Otherwise show every variant row with badges on the ones they own.
  const ownsPro = ownedSet.has('pro')
  const visibleVariants: VariantId[] = ownsPro
    ? ['pro']
    : (['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const).filter(
        (v) => ownedSet.size === 0 || ownedSet.has(v),
      )
  // When the user owns nothing yet show all five; when they own one or
  // more trades, show only those trades (clean the noise). They can
  // still see every variant on /downloads if they want to.
  const showAllRows = ownedSet.size === 0
  const finalVariants = showAllRows
    ? (['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const)
    : (visibleVariants as readonly VariantId[])

  const ownedList = [...ownedSet]

  const meta = (latestRow?.metadata ?? {}) as { variants?: Partial<Record<VariantId, VariantUrls>> }
  const variants = meta.variants ?? {}

  function urlsFor(v: VariantId): VariantUrls {
    const stored = variants[v] ?? {}
    if (stored.exe || stored.msi) return stored
    return { exe: latestRow?.exeUrl ?? undefined, msi: latestRow?.msiUrl ?? undefined }
  }

  const olderRows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(10)

  return (
    <div className="space-y-8">
      <PageHeading
        title="Downloads"
        subtitle={
          ownedList.length === 0
            ? 'Pick the installer for your trade.'
            : ownedList.length === 1
              ? `You own ${VARIANT_LABELS[ownedList[0]]}. Pick the matching installer below.`
              : `You own ${ownedList.map((v) => VARIANT_LABELS[v]).join(' + ')}. Pick the installer for the variant you want to set up first — you'll add the others from Settings → Licences inside the app.`
        }
      />

      {!latestRow ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No releases published yet.
        </div>
      ) : (
        <>
          {/* Latest release — variant grid */}
          <section>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                Latest · v{latestRow.version}
              </h2>
              <time className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                {latestRow.publishedAt.toISOString().slice(0, 10)}
              </time>
            </header>

            <ul className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {finalVariants.map((v) => {
                const u = urlsFor(v)
                const isOwned = ownedSet.has(v)
                return (
                  <li key={v} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                    <div>
                      <div className={`text-[14px] ${isOwned ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-fg)]'}`}>
                        {VARIANT_LABELS[v]}
                        {isOwned ? <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em]">your licence</span> : null}
                      </div>
                    </div>
                    {u.exe ? (
                      <a
                        href={u.exe}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg)] hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        .exe
                      </a>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">no .exe</span>
                    )}
                    {u.msi ? (
                      <a
                        href={u.msi}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg)] hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        .msi
                      </a>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">no .msi</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[11px] text-[var(--color-fg-subtle)]">
              <strong className="text-[var(--color-fg-muted)]">.exe</strong> = quick installer (run as user).
              <strong className="ml-3 text-[var(--color-fg-muted)]">.msi</strong> = IT-managed install (Group Policy / SCCM).
            </p>
          </section>

          {/* Older versions */}
          {olderRows.length > 1 && (
            <section>
              <header className="mb-3 border-b border-[var(--color-border)] pb-2">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                  Earlier versions
                </h2>
              </header>
              <ul className="text-[12px] divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg">
                {olderRows.slice(1).map((r) => (
                  <li key={r.id} className="grid grid-cols-[80px_1fr_auto] gap-3 items-baseline px-4 py-2">
                    <code className="font-mono text-[12px] text-[var(--color-fg)]">v{r.version}</code>
                    <span className="text-[var(--color-fg-muted)] truncate">{r.notes?.split('\n')[0] ?? ''}</span>
                    <time className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                      {r.publishedAt.toISOString().slice(0, 10)}
                    </time>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-[var(--color-fg-subtle)]">
                Need an installer for an older version?{' '}
                <a
                  href="https://github.com/visualoop/omnix/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
                >
                  See every release on GitHub →
                </a>
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
