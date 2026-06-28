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

  // ownedSet = variants the user owns in any active/trial form (drives
  // the badges + visible row list).
  // ownedActive = paid-active variants only. Pro coverage rules only
  // apply when Pro is in this set — a Pro trial doesn't supersede the
  // user's actual paid trade licences.
  const ownedSet = new Set(
    customerLicences
      .filter((l) => l.status !== 'lapsed' && l.status !== 'revoked')
      .map((l) => l.variant as VariantId),
  )
  const ownedActive = new Set(
    customerLicences
      .filter((l) => l.status === 'active')
      .map((l) => l.variant as VariantId),
  )
  // Pro-supersede only when Pro is the user's PAID licence. Trial Pro
  // doesn't override their paid trades — if the trial expires, the
  // trades are what they actually keep.
  const ownsPro = ownedActive.has('pro')
  // Visibility rule:
  //   - Active Pro licence (paid): show only Pro, since Pro covers all
  //     trades. No point asking them to "try Hardware" — they already
  //     own it through Pro.
  //   - Anything else (no licence, only trial Pro, owned trades): show
  //     the four trade variants. Pro is intentionally hidden from non-
  //     owners now that we don't sell it publicly — re-add 'pro' to the
  //     fallback array when it goes back on sale.
  const visibleVariants: readonly VariantId[] = ownsPro
    ? (['pro'] as const)
    : (['dawa', 'retail', 'hospitality', 'hardware'] as const)
  const finalVariants = visibleVariants

  const ownedList = [...ownedSet]

  const meta = (latestRow?.metadata ?? {}) as { variants?: Partial<Record<VariantId, VariantUrls>> }
  const variants = meta.variants ?? {}

  // Canonical asset naming convention used by the CI build matrix. Mirrors
  // the public /downloads page logic so a missing entry in metadata.variants
  // (e.g. when one variant's CI notify silently failed) never falls back
  // silently to the canonical Pro installer for a non-Pro variant — or, in
  // this case for Pro itself, never shows "no .exe" when the asset exists.
  const PRODUCT_NAME: Record<VariantId, string> = {
    pro: 'Omnix',
    dawa: 'Omnix.Dawa',
    retail: 'Omnix.Retail',
    hospitality: 'Omnix.Hospitality',
    hardware: 'Omnix.Hardware',
  }

  function githubAssetUrl(v: VariantId, kind: 'exe' | 'msi'): string | undefined {
    if (!latestRow) return undefined
    const tag = `v${latestRow.version}`
    const file = kind === 'exe'
      ? `${PRODUCT_NAME[v]}_${latestRow.version}_x64-setup.exe`
      : `${PRODUCT_NAME[v]}_${latestRow.version}_x64_en-US.msi`
    return `https://github.com/visualoop/omnix/releases/download/${tag}/${file}`
  }

  function urlsFor(v: VariantId): VariantUrls {
    const stored = variants[v] ?? {}
    if (stored.exe || stored.msi) {
      return {
        exe: stored.exe ?? githubAssetUrl(v, 'exe'),
        msi: stored.msi ?? githubAssetUrl(v, 'msi'),
      }
    }
    return {
      exe: githubAssetUrl(v, 'exe'),
      msi: githubAssetUrl(v, 'msi'),
    }
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
          ownsPro
            ? 'You own Omnix Pro — covers every trade. Download the Pro installer below.'
            : ownedList.length === 0
              ? 'Pick the installer for your trade. Each one comes with a 30-day trial — no card needed.'
              : ownedList.length === 1
                ? `You own ${VARIANT_LABELS[ownedList[0]]}. Other trades are available below to try.`
                : `You own ${ownedList.map((v) => VARIANT_LABELS[v]).join(' + ')}. Other trades are available below to try.`
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
                  <li key={v} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className={`text-[14px] ${isOwned ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-fg)]'}`}>
                        {VARIANT_LABELS[v]}
                        {isOwned ? (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em]">your licence</span>
                        ) : (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                            not activated
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Start-trial CTA — only on variants the user doesn't
                        own. We don't render it on Pro when the user is
                        already mid-Pro-trial (or owns trade variants
                        that Pro would cover anyway); the dashboard's
                        StartTrialWizard handles that nuance, but the
                        downloads page is for "I want to try this one
                        right now". */}
                    {!isOwned ? (
                      <a
                        href={`/signup?variant=${encodeURIComponent(v)}&trial=1`}
                        className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                      >
                        Start trial
                      </a>
                    ) : (
                      <span aria-hidden />
                    )}
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
