import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Download, KeyRound, Monitor, Receipt, Sparkles, TriangleAlert } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Defensive auth — handle stale sessions (deleted customer rows) without 500.
  interface AuthedUser {
    id?: string | number
    collection?: string
    fullName?: string
    businessName?: string
  }
  let user: AuthedUser | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = result.user as AuthedUser | null
  } catch {
    user = null
  }

  if (!user || user.collection !== 'customers' || user.id == null) {
    redirect('/login?next=/dashboard')
  }

  const customer = user as { id: string; fullName?: string; businessName?: string }

  // Wrap every Payload query so a single failure (missing licence, missing
  // release, schema drift) doesn't 500 the whole page. Each failure falls
  // through to a sensible empty-state default.
  const safeFind = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      console.error('[dashboard] payload query failed:', err)
      return fallback
    }
  }

  // Fetch this customer's licenses
  const licensesRes = await safeFind(
    () =>
      payload.find({
        collection: 'licenses',
        where: { customer: { equals: customer.id } },
        limit: 5,
        sort: '-createdAt',
      }),
    { docs: [] as unknown[], totalDocs: 0 } as { docs: unknown[]; totalDocs: number },
  )

  const licenseIds = licensesRes.docs.map((l: unknown) => (l as { id: string }).id)

  const machinesRes = await safeFind(
    () =>
      licenseIds.length === 0
        ? Promise.resolve({ docs: [] as unknown[], totalDocs: 0 })
        : payload.find({
            collection: 'machines',
            where: { license: { in: licenseIds } },
            limit: 50,
          }),
    { docs: [] as unknown[], totalDocs: 0 } as { docs: unknown[]; totalDocs: number },
  )

  const paymentsRes = await safeFind(
    () =>
      payload.find({
        collection: 'payments',
        where: { customer: { equals: customer.id } },
        limit: 5,
        sort: '-createdAt',
      }),
    { docs: [] as unknown[], totalDocs: 0 } as { docs: unknown[]; totalDocs: number },
  )

  const releasesRes = await safeFind(
    () =>
      payload.find({
        collection: 'releases',
        where: {
          and: [
            { status: { equals: 'published' } },
            { channel: { equals: 'stable' } },
          ],
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
      }),
    { docs: [] as unknown[] } as { docs: unknown[] },
  )
  const latestRelease = (releasesRes.docs[0] as unknown as
    | { version?: string; publishedAt?: string }
    | undefined) ?? null

  const params = await searchParams
  const showWelcome = params.welcome === '1'

  const activeLicense = (licensesRes.docs[0] ?? null) as
    | null
    | {
        id: string
        licenseKey: string
        tier?: string
        status?: string
        modules?: string[]
        trialEndsAt?: string
        maintenanceUntil?: string
        majorVersionCap?: number
      }

  const trialDaysLeft = activeLicense?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeLicense.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="font-display text-[clamp(28px,3vw,40px)] font-medium leading-tight text-[var(--color-fg)]">
          {showWelcome ? `Karibu, ${customer.fullName?.split(' ')[0] ?? 'friend'}.` : 'Overview'}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-fg-muted)]">
          {showWelcome
            ? "Your trial is live. Download the desktop app and run your first sale."
            : `Manage ${customer.businessName ?? 'your business'} from one place.`}
        </p>
      </header>

      {showWelcome ? (
        <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-6 lg:p-8">
          <div className="flex items-start gap-4">
            <Sparkles className="size-6 shrink-0 text-[var(--color-accent)]" />
            <div className="flex-1">
              <h2 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
                Your free 30-day trial is active.
              </h2>
              <p className="mt-2 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
                Download Omnix for Windows below. Use the licence key on this dashboard to
                activate. Every module is unlocked during the trial — Dawa, Soko Retail,
                Hardware, or Hospitality.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="default">
                  <Link href="/dashboard/downloads">
                    <Download className="size-4" />
                    Download installer
                  </Link>
                </Button>
                <Button asChild size="default" variant="outline">
                  <Link href="/docs/getting-started">Read first-sale guide</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <Kpi
          icon={KeyRound}
          label="Active licence"
          value={activeLicense ? (activeLicense.tier ?? 'TRIAL').toUpperCase() : 'No licence'}
          meta={
            activeLicense
              ? activeLicense.status === 'trial'
                ? `Trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`
                : `Status · ${activeLicense.status}`
              : 'Start a trial to begin'
          }
        />
        <Kpi
          icon={Monitor}
          label="Machines"
          value={String(machinesRes.totalDocs)}
          meta={`Across ${licensesRes.totalDocs} licence${licensesRes.totalDocs === 1 ? '' : 's'}`}
        />
        <Kpi
          icon={Download}
          label="Latest version"
          value={latestRelease ? `v${latestRelease.version}` : '—'}
          meta={
            latestRelease?.publishedAt
              ? `Released ${new Date(latestRelease.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No release published'
          }
        />
        <Kpi
          icon={Receipt}
          label="Payments to date"
          value={`KES ${paymentsRes.docs
            .filter(
              (p: unknown) =>
                (p as { status: string }).status === 'success',
            )
            .reduce((sum: number, p: unknown) => sum + (p as { amount: number }).amount, 0)
            .toLocaleString()}`}
          meta={`${paymentsRes.totalDocs} payment${paymentsRes.totalDocs === 1 ? '' : 's'}`}
        />
      </div>

      {/* Licence detail */}
      {activeLicense ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Active licence
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <code className="font-mono text-[20px] tabular-nums text-[var(--color-fg)]">
                  {activeLicense.licenseKey}
                </code>
                <StatusPill status={activeLicense.status ?? 'trial'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                {(activeLicense.modules ?? []).map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/dashboard/licenses/${activeLicense.id}`}>
                Manage licence
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          {trialDaysLeft !== null && trialDaysLeft <= 7 && activeLicense.status === 'trial' ? (
            <div className="mt-6 flex items-start gap-3 rounded-md border border-[var(--color-caution)] bg-[var(--color-caution)]/10 p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-caution)]" />
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--color-fg)]">
                  Trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}.
                </div>
                <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                  Pay now to keep using Omnix without interruption. Your data stays where it is.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/buy/${activeLicense.id}`}>Buy now</Link>
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <h2 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
            No active licences yet.
          </h2>
          <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">
            Buy a licence to download the app and start running your duka.
          </p>
          <Button asChild className="mt-5">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </section>
      )}

      {/* Recent payments */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
            Recent payments
          </h2>
          <Link
            href="/dashboard/payments"
            className="text-[12px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            View all →
          </Link>
        </header>
        {paymentsRes.docs.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
            No payments yet. Your trial is free.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {(paymentsRes.docs as unknown as {
              id: string
              paystackReference: string
              amount: number
              currency: string
              status: string
              purpose: string
              createdAt: string
            }[]).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-6 py-4 text-[13px]"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
                    {p.paystackReference}
                  </span>
                  <span className="text-[var(--color-fg)]">
                    {p.purpose.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <time className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </time>
                  <span className="font-mono tabular-nums text-[var(--color-fg)]">
                    {p.currency} {p.amount.toLocaleString()}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                      p.status === 'success'
                        ? 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]'
                        : p.status === 'failed'
                          ? 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]'
                          : 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
                    )}
                  >
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  meta: string
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          {label}
        </div>
        <Icon className="size-4 text-[var(--color-fg-subtle)]" />
      </div>
      <div className="mt-3 font-display text-[24px] font-medium leading-tight text-[var(--color-fg)]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">{meta}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Active',
      className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
    },
    trial: {
      label: 'Trial',
      className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
    },
    lapsed: {
      label: 'Lapsed',
      className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
    },
    maintenance_expired: {
      label: 'Maintenance expired',
      className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
    },
  }
  const meta = map[status] ?? { label: status, className: 'bg-[var(--color-surface-hover)]' }
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}
