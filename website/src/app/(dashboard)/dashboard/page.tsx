import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc, inArray } from 'drizzle-orm'
import { db, licenses, machines, activations } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import { StartTrialWizard } from '@/components/dashboard/start-trial-wizard'
import { SetupCtaBanner } from '@/components/dashboard/setup-cta-banner'

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

  // Resolve which licences each machine is bound to (via activations).
  // The dashboard uses this so the per-machine Upgrade button only
  // appears when that specific machine has a TRIAL licence bound to it
  // (not whenever any licence in the account is on trial — that gave
  // false positives when a machine was on a paid trade licence but the
  // account also had a Pro trial running on a different machine).
  const machineIds = machList.map((m) => m.id)
  const licenseIds = licList.map((l) => l.id)
  const activationRows =
    machineIds.length && licenseIds.length
      ? await db
          .select({
            machineId: activations.machineId,
            licenseId: activations.licenseId,
          })
          .from(activations)
          .where(inArray(activations.machineId, machineIds))
      : []
  // machineId → array of bound licence rows (filtered to this user's licList)
  const licenseById = new Map(licList.map((l) => [l.id, l]))
  const boundLicencesByMachine = new Map<string, typeof licList>()
  for (const a of activationRows) {
    if (!a.machineId) continue
    const lic = licenseById.get(a.licenseId)
    if (!lic) continue
    const bucket = boundLicencesByMachine.get(a.machineId) ?? []
    if (!bucket.find((x) => x.id === lic.id)) bucket.push(lic)
    boundLicencesByMachine.set(a.machineId, bucket)
  }

  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  const hasNoLicences = licList.length === 0
  // Pro coverage only counts when Pro is ACTIVE (paid). A Pro trial is a
  // 30-day taste — it doesn't supersede the user's paid trade licences,
  // because if Pro trial expires unconverted, the trades are what they
  // keep. Only the paid Pro licence "Covers" trades.
  const ownsProActive = licList.some((l) => l.variant === 'pro' && l.status === 'active')
  // Used by the trial banner (below) — a Pro trial banner outweighs any
  // trade-trial banner.
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
          <SetupCtaBanner />
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
            {/* Hide the "try another trade" wizard only when the user
                has an ACTIVE (paid) Pro licence — that one truly covers
                every trade. A Pro TRIAL doesn't, because if it expires
                without conversion the user keeps only their paid trade
                licences (or nothing). So Pro-trial users still see the
                wizard to start trade-specific trials they might want to
                keep separately. */}
            {!ownsProActive ? (
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
                {machList.map((m) => {
                  // Per-machine Upgrade rule: only show Upgrade when this
                  // specific machine has a licence ON TRIAL bound to it.
                  // Default to the first trial bound here; if none, no CTA.
                  const bound = boundLicencesByMachine.get(m.id) ?? []
                  const trialBound = bound.find((l) => l.status === 'trial')
                  // Visual cue: list the variants bound to this machine.
                  // Tells the user at a glance which licence(s) this PC runs.
                  const variantsLabel = bound.length
                    ? Array.from(new Set(bound.map((l) => l.variant))).join(' + ')
                    : null
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                      <span className="text-[var(--color-fg)] font-medium flex-1 min-w-0 truncate">{m.hostname ?? '—'}</span>
                      <span className="text-[var(--color-fg-muted)] shrink-0">
                        {m.os} · v{m.currentVersion ?? '?'}
                        {variantsLabel ? <> · <span className="text-[var(--color-fg)]">{variantsLabel}</span></> : null}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] shrink-0">{m.status}</span>
                      {trialBound ? (
                        <a
                          href={`/buy?variant=${encodeURIComponent(trialBound.variant ?? 'pro')}`}
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
                  )
                })}
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
