import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, desc, inArray } from 'drizzle-orm'
import { db, licenses, machines, activations } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/dashboard/status-utils'
import { SetupCtaBanner } from '@/components/dashboard/setup-cta-banner'
import { WelcomeTour } from '@/components/dashboard/welcome-tour'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

/**
 * Customer dashboard overview.
 *
 * If the customer has no licences, the page points them at a perpetual
 * purchase (or a demo booking) — there is no public trial acquisition path.
 * Once a licence exists the page renders the normal licences + devices
 * summary, linking through to the full paginated lists. Existing trial
 * licences keep their status + purchase upsell.
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
  // + KRA PIN + product before the user lands on the dashboard.
  if (!session.user.businessName || !session.user.phoneNumber) {
    redirect('/onboarding')
  }

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

  // Resolve which licences each machine is bound to (via activations). The
  // dashboard uses this so the per-machine Upgrade button only appears when
  // that specific machine has a TRIAL licence bound to it (not whenever any
  // licence in the account is on trial).
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
  // 30-day taste — only the paid Pro licence "Covers" trades.
  const ownsProActive = licList.some((l) => l.variant === 'pro' && l.status === 'active')
  const proTrial = licList.find((l) => l.variant === 'pro' && l.status === 'trial')
  const otherTrials = licList.filter((l) => l.status === 'trial' && l.variant !== 'pro')
  // Prefer a trade trial banner — the user can convert that to a purchase.
  // A standalone Pro trial gets no banner (there's no public Pro buy path).
  const trialToBanner = otherTrials[0] ?? null
  const hasTrialBanner = !!trialToBanner
  void proTrial // intentionally unused — kept for the "supersededByPro" check

  // Reseller check — banner links to /dashboard/reseller when the user is one.
  let isReseller = false
  try {
    const { resellers: resellersTable } = await import('@/db')
    const rows = await db
      .select({ id: resellersTable.id })
      .from(resellersTable)
      .where(eq(resellersTable.userId, userId))
      .limit(1)
    isReseller = rows.length > 0
  } catch {
    // resellers table cold — dashboard renders without the reseller pill.
  }

  return (
    <div className="flex flex-col gap-8">
      <WelcomeTour />
      <PageHeader
        eyebrow="Overview"
        title={`Welcome${hasNoLicences ? '' : ' back'}, ${firstName}`}
        description={
          hasNoLicences
            ? 'Buy a perpetual licence for the trade you run, or book a demo to see it first.'
            : 'Your licences, devices and support — all in one place.'
        }
      />

      {isReseller ? (
        <Link
          href="/dashboard/reseller"
          className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/8 px-3 py-1.5 text-[12px] font-medium text-[var(--color-positive)] transition-colors hover:bg-[var(--color-positive)]/12"
        >
          <span className="size-1.5 rounded-full bg-[var(--color-positive)]" aria-hidden />
          Reseller channel · view your dashboard
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {/* Trade trial → buy banner. A Pro trial alone deliberately gets no
          banner: Pro is not sold publicly, so the trial runs to expiry and
          any trade licences the user owns keep them working. */}
      {!hasNoLicences && hasTrialBanner ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Trial active
            </span>
            <span className="font-display text-[16px] font-semibold text-[var(--color-fg)]">
              Lock in your licence — pay once, use forever.
            </span>
            <span className="text-[13px] text-[var(--color-fg-muted)]">
              KES 30,000 one-time per trade. Perpetual licence, no subscription.
            </span>
          </div>
          <Button asChild className="shrink-0 max-sm:w-full">
            <Link href={`/buy?variant=${encodeURIComponent(trialToBanner!.variant ?? 'dawa')}`}>
              Purchase licence
            </Link>
          </Button>
        </div>
      ) : null}

      {hasNoLicences ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            Get started
          </span>
          <h2
            style={{ fontFamily: 'var(--font-display)' }}
            className="mt-1.5 text-[22px] font-medium tracking-[-0.01em] text-[var(--color-fg)]"
          >
            Buy your Omnix licence
          </h2>
          <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
            One perpetual licence per trade — Pharmacy, Retail, Hospitality, Hardware, or Salon &amp; Spa.
            Pay once, own it forever, with a year of compliance updates included. Not sure which fits your
            business? Book a demo and we&rsquo;ll walk you through it.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/buy">Buy a licence</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact?type=demo">Book a demo</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SetupCtaBanner />

          <section data-tour="licenses" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
                Licences
              </h2>
              <Link
                href="/dashboard/licenses"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                All licences →
              </Link>
            </div>
            <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
              {licList.map((l) => {
                // A trade-variant licence becomes redundant once the user
                // also owns Pro — show a "Covered by Pro" pill instead of an
                // Upgrade button so we don't push them to pay twice.
                const supersededByPro = ownsProActive && l.variant !== 'pro'
                // Pro isn't on sale publicly — Pro trial owners never see an
                // "Upgrade" button that routes to a non-functional
                // /buy?variant=pro flow.
                const isPro = l.variant === 'pro'
                const isTrialOffer = l.status === 'trial' && !supersededByPro && !isPro
                return (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]"
                  >
                    <code className="min-w-0 flex-1 select-all truncate font-mono text-[12px] text-[var(--color-fg)]">
                      {l.licenseKey}
                    </code>
                    <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                      {l.variant} · {l.tier}
                    </span>
                    <StatusPill kind="license" status={l.status} />
                    {supersededByPro ? (
                      <span
                        className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]"
                        title="Pro covers every trade module — this individual licence is redundant. Release it from Settings → Licences inside the app."
                      >
                        Covered by Pro
                      </span>
                    ) : isTrialOffer ? (
                      <Button asChild size="xs">
                        <Link href={`/buy?variant=${encodeURIComponent(l.variant ?? 'dawa')}`}>Upgrade</Link>
                      </Button>
                    ) : (
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/dashboard/licenses/${l.id}`}>Open</Link>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
            {/* Offer to buy another trade — unless the user has an ACTIVE
                (paid) Pro licence, which already covers every trade. There is
                no public trial acquisition path, so this is a purchase link. */}
            {!ownsProActive ? (
              <div className="mt-1 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[12px] text-[var(--color-fg-muted)]">
                Run more than one trade?{' '}
                <Link href="/buy" className="text-[var(--color-fg)] underline-offset-4 hover:underline">
                  Buy another Omnix licence →
                </Link>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
                Devices
              </h2>
              <Link
                href="/dashboard/machines"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                All devices →
              </Link>
            </div>
            {machList.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
                No devices have activated yet. Install Omnix on your till and paste your licence key on
                first launch.{' '}
                <Link
                  href="/dashboard/downloads"
                  className="ml-1 text-[var(--color-fg)] underline-offset-4 hover:underline"
                >
                  Get the installer →
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                {machList.map((m) => {
                  // Per-machine Upgrade rule: only show Upgrade when this
                  // specific machine has a licence ON TRIAL bound to it. Pro
                  // trials are excluded (no public /buy?variant=pro path).
                  const bound = boundLicencesByMachine.get(m.id) ?? []
                  const trialBound = bound.find((l) => l.status === 'trial' && l.variant !== 'pro')
                  const variantsLabel = bound.length
                    ? Array.from(new Set(bound.map((l) => l.variant))).join(' + ')
                    : null
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-fg)]">
                        {m.hostname ?? '—'}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--color-fg-muted)]">
                        {m.os} · v{m.currentVersion ?? '?'}
                        {variantsLabel ? (
                          <>
                            {' '}
                            · <span className="text-[var(--color-fg)]">{variantsLabel}</span>
                          </>
                        ) : null}
                      </span>
                      <StatusPill kind="machine" status={m.status} />
                      {trialBound ? (
                        <Button asChild size="xs">
                          <Link href={`/buy?variant=${encodeURIComponent(trialBound.variant ?? 'dawa')}`}>
                            Upgrade
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/dashboard/machines/${m.id}`}>Open</Link>
                      </Button>
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
