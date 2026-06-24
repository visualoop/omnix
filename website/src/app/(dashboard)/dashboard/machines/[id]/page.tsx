import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq, desc } from 'drizzle-orm'
import { db, machines, licenses, telemetryEvents, cloudBackups } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatRelative } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  const rows = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, session.user.id)))
    .limit(1)
  const m = rows[0]
  if (!m) notFound()

  const [license, telemetry, backups] = await Promise.all([
    db.query.licenses.findFirst({ where: eq(licenses.id, m.licenseId) }),
    db.select().from(telemetryEvents).where(eq(telemetryEvents.machineId, id)).orderBy(desc(telemetryEvents.occurredAt)).limit(50),
    db.select().from(cloudBackups).where(eq(cloudBackups.machineId, id)).orderBy(desc(cloudBackups.takenAt)).limit(30),
  ])

  const status = m.status === 'active' && m.lastSeenAt && (Date.now() - new Date(m.lastSeenAt).getTime()) < 24 * 3600 * 1000 ? 'online' : m.status

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Machines', href: '/dashboard/machines' }, { label: m.hostname || m.machineId }]} />
      <BackButton fallback="/dashboard/machines" label="Back to machines" />
      <EntityHero
        eyebrow="Machine"
        title={m.hostname || m.machineId}
        subtitle={
          <>
            <span className="font-mono">{m.machineId}</span>
            {license && <> · licence <Link href={`/dashboard/licenses/${license.id}`} className="underline font-mono">{license.licenseKey}</Link></>}
          </>
        }
        badges={[
          { label: status, variant: status === 'online' ? 'default' : status === 'revoked' ? 'destructive' : 'secondary' },
          { label: m.networkMode ?? 'standalone', variant: 'outline' },
          ...(m.activeModule ? [{ label: m.activeModule, variant: 'outline' as const }] : []),
        ]}
        actions={
          license?.status === 'trial' ? (
            <a
              href={`/buy?variant=${encodeURIComponent(license.variant)}`}
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white hover:bg-[var(--color-accent)]/90 transition-colors cursor-pointer"
            >
              Upgrade · {license.variant}
            </a>
          ) : null
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
            render: () => (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Hostname" value={m.hostname} />
                <Field label="Machine ID" value={<span className="font-mono">{m.machineId}</span>} />
                <Field label="OS" value={`${m.os ?? 'windows'} ${m.osVersion ?? ''}`} />
                <Field label="Architecture" value={m.arch} />
                <Field label="App version" value={`v${m.currentVersion ?? '?'}`} />
                <Field label="Active module" value={m.activeModule} />
                <Field label="Branch" value={m.branchName} />
                <Field label="Currency" value={m.currency} />
                <Field label="Network mode" value={m.networkMode} />
                <Field label="First seen" value={formatDate(m.firstSeenAt, true)} />
              </div>
            ),
          },
          {
            id: 'telemetry',
            label: 'Activity',
            count: telemetry.length,
            render: () => (
              <ol className="flex flex-col gap-3">
                {telemetry.map((t) => (
                  <li key={t.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
                    <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {formatDateShort(t.occurredAt)}
                    </time>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium">{t.kind}</span>
                    </div>
                  </li>
                ))}
                {telemetry.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
              </ol>
            ),
          },
          {
            id: 'backups',
            label: 'Cloud backups',
            count: backups.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium font-mono">{b.s3Key}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(b.takenAt, true)}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{(b.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
                {backups.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No backups yet.</li>}
              </ul>
            ),
          },
        ]}
      />
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  )
}
