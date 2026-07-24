import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, releases, licenses } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/dashboard/status-utils'
import {
  StartTrialPanel,
  type DashboardTrialVariant,
} from '@/components/dashboard/start-trial-panel'

export const metadata = { title: 'Downloads' }
export const dynamic = 'force-dynamic'

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'
interface VariantUrls {
  exe?: string
  msi?: string
}

const VARIANT_LABELS: Record<VariantId, string> = {
  pro: 'Pro (all trades)',
  dawa: 'Dawa — pharmacy',
  retail: 'Retail — duka',
  hospitality: 'Hospitality — restaurant',
  hardware: 'Hardware store',
  salon: 'Salon & Spa',
}

/**
 * Customer dashboard /downloads.
 *
 * Session-gated. Shows the latest release with one row per Omnix product
 * the customer can install, highlighting the products they own. Pro is
 * hidden from non-owners (it is not sold publicly), so non-Pro customers
 * see the five trade products.
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
  const ownedActive = new Set(
    customerLicences.filter((l) => l.status === 'active').map((l) => l.variant as VariantId),
  )
  const trialSet = new Set(
    customerLicences.filter((l) => l.status === 'trial').map((l) => l.variant as VariantId),
  )
  const previouslyLicensedSet = new Set(customerLicences.map((l) => l.variant as VariantId))
  // Pro-supersede only when Pro is the user's PAID licence.
  const ownsPro = ownedActive.has('pro')
  // Visibility: active Pro shows only Pro; everyone else sees the five
  // trades. Pro is hidden from non-owners (not sold publicly).
  const visibleVariants: readonly VariantId[] = ownsPro
    ? (['pro'] as const)
    : (['dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const)
  const finalVariants = visibleVariants
  const availableTrialVariants = finalVariants.filter(
    (variant): variant is DashboardTrialVariant => variant !== 'pro' && !previouslyLicensedSet.has(variant),
  )

  const ownedList = [...ownedSet]

  const meta = (latestRow?.metadata ?? {}) as { variants?: Partial<Record<VariantId, VariantUrls>> }
  const variants = meta.variants ?? {}

  const PRODUCT_NAME: Record<VariantId, string> = {
    pro: 'Omnix',
    dawa: 'Omnix.Dawa',
    retail: 'Omnix.Retail',
    hospitality: 'Omnix.Hospitality',
    hardware: 'Omnix.Hardware',
    salon: 'Omnix.Salon',
  }

  function githubAssetUrl(v: VariantId, kind: 'exe' | 'msi'): string | undefined {
    if (!latestRow) return undefined
    const tag = `v${latestRow.version}`
    const file =
      kind === 'exe'
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
    return { exe: githubAssetUrl(v, 'exe'), msi: githubAssetUrl(v, 'msi') }
  }

  const olderRows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(10)

  const description = ownsPro
    ? 'You own Omnix Pro — it covers every trade. Download the Pro installer below.'
    : ownedList.length === 0
      ? 'Choose your trade, start a free 30-day trial, then download the Windows installer. No card required.'
      : trialSet.size > 0
        ? 'Your trial products are ready to download. You can also try another product below.'
        : 'Your licensed products are ready to download. Available trials are listed below.'

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Your software" title="Downloads" description={description} />

      {availableTrialVariants.length > 0 ? (
        <StartTrialPanel
          availableVariants={availableTrialVariants}
          defaultVariant={availableTrialVariants[0]}
          downloadHref="#latest-downloads"
        />
      ) : null}

      {!latestRow ? (
        <EmptyState
          title="No releases published yet"
          body="Installers will appear here as soon as the first stable release is published."
        />
      ) : (
        <>
          <section id="latest-downloads" className="flex scroll-mt-6 flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                Latest · v{latestRow.version}
              </h2>
              <time className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                {latestRow.publishedAt.toISOString().slice(0, 10)}
              </time>
            </header>

            <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              {finalVariants.map((v) => {
                const u = urlsFor(v)
                const isOwned = ownedSet.has(v)
                return (
                  <li
                    key={v}
                    className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div
                        className={
                          isOwned
                            ? 'text-[14px] font-medium text-[var(--color-accent)]'
                            : 'text-[14px] text-[var(--color-fg)]'
                        }
                      >
                        {VARIANT_LABELS[v]}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                        {trialSet.has(v)
                          ? 'Trial active'
                          : ownedActive.has(v)
                            ? 'Perpetual licence'
                            : isOwned
                              ? 'Licence on account'
                              : '30-day trial available'}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.exe ? (
                        <Button asChild size="xs" variant="outline">
                          <a href={u.exe} target="_blank" rel="noopener noreferrer" download>
                            Download .exe
                          </a>
                        </Button>
                      ) : (
                        <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">no .exe</span>
                      )}
                      {u.msi ? (
                        <Button asChild size="xs" variant="outline">
                          <a href={u.msi} target="_blank" rel="noopener noreferrer" download>
                            Download .msi
                          </a>
                        </Button>
                      ) : (
                        <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">no .msi</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="text-[11px] leading-6 text-[var(--color-fg-subtle)]">
              <strong className="text-[var(--color-fg-muted)]">.exe</strong> = quick installer (run as user).
              <strong className="ml-3 text-[var(--color-fg-muted)]">.msi</strong> = IT-managed install (Group
              Policy / SCCM).
            </p>
          </section>

          {olderRows.length > 1 && (
            <section className="flex flex-col gap-3">
              <header className="border-b border-[var(--color-border)] pb-2">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                  Earlier versions
                </h2>
              </header>
              <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-[12px]">
                {olderRows.slice(1).map((r) => (
                  <li key={r.id} className="grid grid-cols-[80px_1fr_auto] items-baseline gap-3 px-4 py-2.5">
                    <code className="font-mono text-[12px] text-[var(--color-fg)]">v{r.version}</code>
                    <span className="truncate text-[var(--color-fg-muted)]">{r.notes?.split('\n')[0] ?? ''}</span>
                    <time className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                      {r.publishedAt.toISOString().slice(0, 10)}
                    </time>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                Need an installer for an older version?{' '}
                <a
                  href="https://github.com/visualoop/omnix/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-fg-muted)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
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
