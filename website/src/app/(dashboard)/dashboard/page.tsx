import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, licenses, machines } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import { StartTrialWizard } from '@/components/dashboard/start-trial-wizard'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

/**
 * Customer dashboard overview.
 *
 * If the customer has no licences, the page becomes a "Start your trial"
 * wizard: pick a variant, click Start, and a 30-day trial licence is
 * provisioned in-place. Once a licence exists the page renders the
 * normal licences + machines summary.
 */
export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ variant?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    const sp = (await searchParams) ?? {}
    const next = sp.variant ? `/dashboard?variant=${encodeURIComponent(sp.variant)}` : '/dashboard'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  // First-time-user check: route to /onboarding when business name is
  // missing. The wizard captures business + country + currency + phone
  // + KRA PIN + variant before the user lands on the trial dashboard.
  if (!session.user.businessName || !session.user.phoneNumber) {
    redirect('/onboarding')
  }

  const sp = (await searchParams) ?? {}
  const requestedVariant = sp.variant?.toLowerCase()
  const VALID_VARIANTS = ['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const
  type Variant = (typeof VALID_VARIANTS)[number]
  const defaultVariant: Variant = (VALID_VARIANTS as readonly string[]).includes(requestedVariant ?? '')
    ? (requestedVariant as Variant)
    : 'pro'

  const userId = session.user.id

  const [licList, machList] = await Promise.all([
    db
      .select({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        variant: licenses.variant,
        tier: licenses.tier,
        status: licenses.status,
        maintenanceUntil: licenses.maintenanceUntil,
        trialEndsAt: licenses.trialEndsAt,
      })
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .orderBy(desc(licenses.createdAt))
      .limit(10),
    db
      .select({
        id: machines.id,
        hostname: machines.hostname,
        os: machines.os,
        currentVersion: machines.currentVersion,
        lastSeenAt: machines.lastSeenAt,
        status: machines.status,
      })
      .from(machines)
      .where(eq(machines.userId, userId))
      .orderBy(desc(machines.lastSeenAt))
      .limit(10),
  ])

  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  const hasNoLicences = licList.length === 0
  // Pro coverage only counts when Pro is ACTIVE (paid). A Pro trial is a
  // 30-day taste — it doesn't supersede the user's paid trade licences,
  // because if Pro trial expires unconverted, the trades are what they
  // keep. Only the paid Pro licence "Covers" trades.
  const ownsProActive = licList.some((l) => l.variant === 'pro' && l.status === 'active')
  // Used to decide whether to hide the "Try another trade" wizard / show
  // the Pro trial banner. We still suppress trial-wizard noise while a
  // Pro trial is running.
  const hasAnyPro = licList.some(
    (l) => l.variant === 'pro' && (l.status === 'active' || l.status === 'trial'),
  )
  const proTrial = licList.find((l) => l.variant === 'pro' && l.status === 'trial')
  const otherTrials = licList.filter((l) => l.status === 'trial' && l.variant !== 'pro')
  // "Show the trial banner" rule: a Pro trial is the only banner that
  // matters when Pro is in play (it covers everything). Otherwise show
  // the first non-Pro trial.
  const trialToBanner = proTrial ?? otherTrials[0]
  const hasTrialBanner = !!trialToBanner

  return (
    <div className="space-y-8">
      <PageHeading
        title={`Welcome${hasNoLicences ? '' : ' back'}, ${firstName}`}
        subtitle={
          hasNoLicences
            ? 'Pick the trade you run and get a 30-day trial licence — no card needed.'
            : 'Your licences, machines, and support — all in one place.'
        }
      />

      {/* Trial → buy banner. Shows when at least one licence is on trial.
          Each visible licence below also gets its own Upgrade button — this
          banner is the "see this everywhere" gentle prompt. */}
      {!hasNoLicences && hasTrialBanner ? (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4 lg:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Trial active
            </span>
            <span className="font-display text-[16px] font-medium text-[var(--color-fg)]">
              Lock in your licence — pay once, use forever.
            </span>
            <span className="text-[13px] text-[var(--color-fg-muted)]">
              {trialToBanner!.variant === 'pro'
                ? 'Pro covers all four trades for KES 150,000 once. No subscription.'
                : 'KES 30,000 one-time per trade. Pro covers all four trades for KES 150,000.'}
            </span>
          </div>
          <a
            href={`/buy?variant=${encodeURIComponent(trialToBanner!.variant ?? 'pro')}`}
            className="shrink-0 inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.16em] text-white transition-colors hover:bg-[var(--color-accent)]/90 cursor-pointer"
          >
            Purchase {trialToBanner!.variant === 'pro' ? 'Pro' : 'licence'} →
          </a>
        </div>
      ) : null}

      {hasNoLicences ? (
        <StartTrialWizard defaultVariant={defaultVariant} />
      ) : (
        <>
          <section>
            <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)] mb-3">
              Licences
            </h2>
            <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {licList.map((l) => {
                // A trade-variant licence becomes redundant once the user
                // also owns Pro — show a "Covered by Pro" pill instead of
                // an Upgrade button so we don't push them to pay twice.
                const supersededByPro = ownsProActive && l.variant !== 'pro'
                const isTrialOffer = l.status === 'trial' && !supersededByPro
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                    <code className="font-mono text-[12px] text-[var(--color-fg)] select-all flex-1 min-w-0 truncate">{l.licenseKey}</code>
                    <span className="text-[var(--color-fg-muted)] shrink-0">{l.variant} · {l.tier}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] shrink-0">{l.status}</span>
                    {supersededByPro ? (
                      <span
                        className="shrink-0 inline-flex items-center rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]"
                        title="Pro covers every trade module — this individual licence is redundant. You can release it from Settings → Licences inside the app."
                      >
                        Covered by Pro
                      </span>
                    ) : isTrialOffer ? (
                      <a
                        href={`/buy?variant=${encodeURIComponent(l.variant ?? 'pro')}`}
                        className="shrink-0 inline-flex items-center rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-[var(--color-accent)]/90 transition-colors cursor-pointer"
                      >
                        Upgrade
                      </a>
                    ) : (
                      <a
                        href={`/dashboard/licenses/${l.id}`}
                        className="shrink-0 inline-flex items-center rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
                      >
                        Open
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
            {/* Always offer to try (or buy) another variant — customers
                often start with one trade and add more (e.g. Dawa pharmacy
                + Retail mini-mart). The wizard skips variants the customer
                already has so we don't issue duplicate trial keys. */}
            {/* Hide the "try another trade" wizard while any Pro licence
                is in play. Active Pro covers everything; Pro on trial
                already gives the user a 30-day taste of every variant
                so they don't need to start more trials in parallel. */}
            {!hasAnyPro ? (
              <div className="mt-4">
                <StartTrialWizard
                  defaultVariant={pickFirstUntakenVariant(licList.map((l) => l.variant)) ?? defaultVariant}
                  ownedVariants={licList.map((l) => l.variant).filter(Boolean) as string[]}
                  compact
                />
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)] mb-3">
              Machines
            </h2>
            {machList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
                No machines have activated yet. Install Omnix on your till and paste your licence key on first launch.{' '}
                <a href="/dashboard/downloads" className="ml-1 underline-offset-4 hover:underline text-[var(--color-fg)]">
                  Get the installer →
                </a>
              </div>
            ) : (
              <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {machList.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                    <span className="text-[var(--color-fg)] font-medium flex-1 min-w-0 truncate">{m.hostname ?? '—'}</span>
                    <span className="text-[var(--color-fg-muted)] shrink-0">{m.os} · v{m.currentVersion ?? '?'}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] shrink-0">{m.status}</span>
                    {/* Show an Upgrade CTA when there's a trial worth
                        promoting. If Pro is on trial, that's the only
                        upgrade worth offering (covers everything). If
                        Pro isn't in play, the first non-Pro trial wins. */}
                    {trialToBanner ? (
                      <a
                        href={`/buy?variant=${encodeURIComponent(trialToBanner.variant ?? 'pro')}`}
                        className="shrink-0 inline-flex items-center rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-[var(--color-accent)]/90 transition-colors cursor-pointer"
                      >
                        Upgrade
                      </a>
                    ) : null}
                    <a
                      href={`/dashboard/machines/${m.id}`}
                      className="shrink-0 inline-flex items-center rounded-md border border-[var(--color-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
                    >
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

const ALL_VARIANTS = ['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const
function pickFirstUntakenVariant(taken: (string | null)[]): typeof ALL_VARIANTS[number] | null {
  const set = new Set(taken.filter(Boolean))
  for (const v of ALL_VARIANTS) {
    if (!set.has(v)) return v
  }
  return null
}
