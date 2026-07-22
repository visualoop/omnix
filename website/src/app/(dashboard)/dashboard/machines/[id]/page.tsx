import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc } from 'drizzle-orm'
import { db, machines, licenses, telemetryEvents, cloudBackups, activations } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { Button } from '@/components/ui/button'
import { DetailField, DetailGrid } from '@/components/dashboard/detail-field'
import { StatusPill } from '@/components/dashboard/status-utils'
import { formatDate, formatDateShort, formatRelative } from '@/lib/format-date'
import { ReleaseSeatButton } from '@/components/dashboard/release-seat-button'

export const dynamic = 'force-dynamic'

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Ownership gate — a device belonging to another account is
  // indistinguishable from one that does not exist.
  const rows = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, session.user.id)))
    .limit(1)
  const m = rows[0]
  if (!m) notFound()

  const [license, telemetry, backups] = await Promise.all([
    db.query.licenses.findFirst({ where: eq(licenses.id, m.licenseId) }),
    db
      .select()
      .from(telemetryEvents)
      .where(eq(telemetryEvents.machineId, id))
      .orderBy(desc(telemetryEvents.occurredAt))
      .limit(50),
    db
      .select()
      .from(cloudBackups)
      .where(eq(cloudBackups.machineId, id))
      .orderBy(desc(cloudBackups.takenAt))
      .limit(30),
  ])

  // Every licence/module activated on THIS machine — a PC can hold several
  // trade licences, so the single primary `license` under-reports.
  const activatedLicences = await db
    .selectDistinct({
      id: licenses.id,
      variant: licenses.variant,
      licenseKey: licenses.licenseKey,
      status: licenses.status,
    })
    .from(activations)
    .innerJoin(licenses, eq(activations.licenseId, licenses.id))
    .where(eq(activations.machineId, id))
  const activatedVariants = activatedLicences.map((l) => l.variant)

  const status =
    m.status === 'active' && m.lastSeenAt && Date.now() - new Date(m.lastSeenAt).getTime() < 24 * 3600 * 1000
      ? 'online'
      : m.status

  // Pro trials never get a public upgrade CTA (Pro is not sold publicly).
  const canUpgradeTrial = license?.status === 'trial' && license.variant !== 'pro'

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Devices', href: '/dashboard/machines' }, { label: m.hostname || m.machineId }]} />
      <BackButton fallback="/dashboard/machines" label="Back to devices" />
      <EntityHero
        eyebrow="Device"
        title={m.hostname || m.machineId}
        subtitle={
          <>
            <span className="font-mono">{m.machineId}</span>
            {license ? (
              <>
                {' '}
                · licence{' '}
                <Link href={`/dashboard/licenses/${license.id}`} className="font-mono underline underline-offset-4">
                  {license.licenseKey}
                </Link>
              </>
            ) : null}
          </>
        }
        badges={[
          { label: status, variant: status === 'online' ? 'default' : status === 'revoked' ? 'destructive' : 'secondary' },
          { label: m.networkMode ?? 'standalone', variant: 'outline' },
          ...(activatedVariants.length
            ? activatedVariants.map((v) => ({ label: v, variant: 'outline' as const }))
            : m.activeModule
              ? [{ label: m.activeModule, variant: 'outline' as const }]
              : []),
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canUpgradeTrial ? (
              <Button asChild>
                <Link href={`/buy?variant=${encodeURIComponent(license!.variant)}`}>Buy {license!.variant} licence</Link>
              </Button>
            ) : null}
            {m.status !== 'revoked' ? <ReleaseSeatButton machineId={m.id} hostname={m.hostname} /> : null}
          </div>
        }
        stats={[
          { label: 'App version', value: `v${m.currentVersion ?? '?'}` },
          { label: 'OS', value: `${m.os ?? 'windows'} ${m.osVersion ?? ''}` },
          { label: 'Branch', value: m.branchName ?? '—' },
          { label: 'Last heartbeat', value: formatRelative(m.lastSeenAt) },
          { label: 'Sales (30d)', value: m.salesCountLast30d ?? 0 },
          { label: 'Backups', value: backups.length },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <DetailGrid>
                <DetailField label="Hostname" value={m.hostname} />
                <DetailField label="Device ID" value={m.machineId} mono />
                <DetailField label="OS" value={`${m.os ?? 'windows'} ${m.osVersion ?? ''}`} />
                <DetailField label="Architecture" value={m.arch} />
                <DetailField label="App version" value={`v${m.currentVersion ?? '?'}`} mono />
                <DetailField
                  label="Modules activated"
                  value={activatedVariants.length ? activatedVariants.join(' · ') : m.activeModule}
                />
                <DetailField label="Branch" value={m.branchName} />
                <DetailField label="Currency" value={m.currency} />
                <DetailField label="Network mode" value={m.networkMode} />
                <DetailField label="First seen" value={formatDate(m.firstSeenAt, true)} />
              </DetailGrid>
            ),
          },
          {
            id: 'licences',
            label: 'Licences',
            count: activatedLicences.length,
            content:
              activatedLicences.length === 0 ? (
                <p className="text-[13px] text-[var(--color-fg-muted)]">No licences are activated on this device.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activatedLicences.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--color-fg)]">
                          {l.variant}
                        </span>
                        <Link
                          href={`/dashboard/licenses/${l.id}`}
                          className="truncate font-mono text-[11px] text-[var(--color-fg-muted)] underline-offset-4 hover:underline"
                        >
                          {l.licenseKey}
                        </Link>
                      </span>
                      <StatusPill kind="license" status={l.status} />
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: 'telemetry',
            label: 'Activity',
            count: telemetry.length,
            content:
              telemetry.length === 0 ? (
                <p className="text-[13px] text-[var(--color-fg-muted)]">No activity recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {telemetry.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[130px_1fr] items-baseline gap-4 border-b border-[var(--color-border)] pb-2.5"
                    >
                      <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
                        {formatDateShort(t.occurredAt)}
                      </time>
                      <span className="text-[13px] font-medium text-[var(--color-fg)]">{t.kind}</span>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: 'backups',
            label: 'Cloud backups',
            count: backups.length,
            content:
              backups.length === 0 ? (
                <p className="text-[13px] text-[var(--color-fg-muted)]">No cloud backups yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  {backups.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-[13px] font-medium text-[var(--color-fg)]">
                          {b.s3Key}
                        </span>
                        <span className="text-[11px] text-[var(--color-fg-muted)]">{formatDate(b.takenAt, true)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                        {(b.sizeBytes / 1024 / 1024).toFixed(1)} MB
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
