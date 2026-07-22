import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { db, licenses, machines, payments } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { Button } from '@/components/ui/button'
import { DetailField, DetailGrid } from '@/components/dashboard/detail-field'
import { StatusPill } from '@/components/dashboard/status-utils'
import { formatDate, formatDateShort } from '@/lib/format-date'
import { ReleaseTrialButton } from '@/components/dashboard/release-trial-button'

export const dynamic = 'force-dynamic'

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Ownership gate: the id is matched *with* the user id, so a licence that
  // belongs to someone else is indistinguishable from one that does not
  // exist — both fall through to notFound(). No existence leak.
  const rows = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, id), eq(licenses.userId, session.user.id)))
    .limit(1)
  const l = rows[0]
  if (!l) notFound()

  const [bound, paid] = await Promise.all([
    db.select().from(machines).where(eq(machines.licenseId, id)).orderBy(desc(machines.lastSeenAt)),
    db.select().from(payments).where(eq(payments.licenseId, id)).orderBy(desc(payments.createdAt)),
  ])

  const KES = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
  const totalPaid = paid.filter((p) => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)

  // Pro is not sold publicly, so a Pro trial never gets a "/buy?variant=pro"
  // upgrade button (that path would not resolve). Trade trials keep their
  // real, working purchase CTA.
  const canUpgradeTrial = l.status === 'trial' && l.variant !== 'pro'
  const canRenew = l.status === 'lapsed' || l.status === 'maintenance_expired'

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Licences', href: '/dashboard/licenses' }, { label: l.licenseKey }]} />
      <BackButton fallback="/dashboard/licenses" label="Back to licences" />
      <EntityHero
        eyebrow="Licence"
        title={l.licenseKey}
        subtitle={`${l.variant} · ${l.tier} · issued ${formatDate(l.paidAt ?? l.trialStartedAt)}`}
        badges={[
          {
            label: l.status,
            variant:
              l.status === 'active'
                ? 'default'
                : l.status === 'lapsed' || l.status === 'revoked'
                  ? 'destructive'
                  : 'secondary',
          },
          ...(l.cloudBackupEnabled ? [{ label: 'Cloud backup', variant: 'outline' as const }] : []),
        ]}
        actions={
          canUpgradeTrial ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={`/buy?variant=${encodeURIComponent(l.variant)}`}>Buy {l.variant} licence</Link>
              </Button>
              <ReleaseTrialButton licenseId={l.id} licenseKey={l.licenseKey} />
            </div>
          ) : canRenew ? (
            <Button asChild>
              <Link href={`/buy?variant=${encodeURIComponent(l.variant)}&intent=renew`}>Renew maintenance</Link>
            </Button>
          ) : l.status === 'trial' ? (
            <ReleaseTrialButton licenseId={l.id} licenseKey={l.licenseKey} />
          ) : null
        }
        stats={[
          { label: 'Product', value: l.variant },
          { label: 'Tier', value: l.tier },
          { label: 'Devices', value: `${bound.length} / ${l.maxMachines}` },
          { label: 'Branches', value: l.maxBranches },
          { label: 'Compliance until', value: formatDate(l.maintenanceUntil) },
          { label: 'Spent', value: KES(totalPaid) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <DetailGrid>
                <DetailField label="Major-version cap" value={`v${l.majorVersionCap}.x`} mono />
                <DetailField label="Modules" value={(l.modules as string[]).join(', ') || undefined} />
                <DetailField label="Trial started" value={formatDate(l.trialStartedAt)} />
                <DetailField label="Trial ends" value={formatDate(l.trialEndsAt)} />
                <DetailField label="Paid on" value={formatDate(l.paidAt)} />
                <DetailField label="Cloud backup expires" value={formatDate(l.cloudBackupExpiresAt)} />
              </DetailGrid>
            ),
          },
          {
            id: 'machines',
            label: 'Devices',
            count: bound.length,
            content:
              bound.length === 0 ? (
                <p className="text-[13px] text-[var(--color-fg-muted)]">
                  No devices are bound to this licence yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  {bound.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/dashboard/machines/${m.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[var(--color-surface)]"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-medium text-[var(--color-fg)]">
                            {m.hostname || m.machineId}
                          </span>
                          <span className="text-[11px] text-[var(--color-fg-muted)]">
                            {m.os ?? 'windows'} · v{m.currentVersion ?? '?'}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--color-fg-muted)]">
                          {formatDateShort(m.lastSeenAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: paid.length,
            content:
              paid.length === 0 ? (
                <p className="text-[13px] text-[var(--color-fg-muted)]">No payments recorded for this licence.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  {paid.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-[13px] font-medium capitalize text-[var(--color-fg)]">
                          {p.purpose.replace(/_/g, ' ')}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusPill kind="payment" status={p.status} />
                          <span className="text-[11px] text-[var(--color-fg-muted)]">{formatDate(p.createdAt)}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  )
}
