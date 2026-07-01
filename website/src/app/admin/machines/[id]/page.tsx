import { notFound } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, machines, licenses, user, telemetryEvents, cloudBackups, activations } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { UpdatePolicyPanel } from './update-policy-panel'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatDateLong, formatRelative } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminMachineDetailPage({ params }: PageProps) {
  const { id } = await params
  const m = await db.query.machines.findFirst({ where: eq(machines.id, id) })
  if (!m) notFound()

  const [machineLicense, machineUser, telemetry, backups] = await Promise.all([
    db.query.licenses.findFirst({ where: eq(licenses.id, m.licenseId) }),
    m.userId ? db.query.user.findFirst({ where: eq(user.id, m.userId) }) : null,
    db.select().from(telemetryEvents).where(eq(telemetryEvents.machineId, id)).orderBy(desc(telemetryEvents.occurredAt)).limit(100),
    db.select().from(cloudBackups).where(eq(cloudBackups.machineId, id)).orderBy(desc(cloudBackups.takenAt)).limit(50),
  ])

  // All licences/modules activated on this machine (a PC can hold
  // several trade licences). machines.activeModule only holds the last.
  const activatedLicences = await db
    .selectDistinct({ id: licenses.id, variant: licenses.variant, licenseKey: licenses.licenseKey, status: licenses.status })
    .from(activations)
    .innerJoin(licenses, eq(activations.licenseId, licenses.id))
    .where(eq(activations.machineId, id))
  const activatedVariants = activatedLicences.map((l) => l.variant)

  const lastHeartbeat = m.lastSeenAt ? formatRelative(m.lastSeenAt) : 'never'
  const status = m.status === 'active' && m.lastSeenAt && (Date.now() - new Date(m.lastSeenAt).getTime()) < 24 * 3600 * 1000 ? 'online' : m.status

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Machines', href: '/admin/machines' }, { label: m.hostname || m.machineId }]} />
      <BackButton fallback="/admin/machines" label="Back to machines" />
      <EntityHero
        eyebrow="Machine"
        title={m.hostname || m.machineId}
        subtitle={
          <>
            <span className="font-mono">{m.machineId}</span>
            {machineUser && <> · owned by <Link className="underline" href={`/admin/users/${machineUser.id}`}>{machineUser.name}</Link></>}
            {machineLicense && <> · <Link className="underline font-mono" href={`/admin/licenses/${machineLicense.id}`}>{machineLicense.licenseKey}</Link></>}
          </>
        }
        badges={[
          { label: status, variant: status === 'online' ? 'default' : status === 'revoked' ? 'destructive' : 'secondary' },
          { label: m.networkMode ?? 'standalone', variant: 'outline' },
          ...(activatedVariants.length
            ? activatedVariants.map((v) => ({ label: v, variant: 'outline' as const }))
            : m.activeModule ? [{ label: m.activeModule, variant: 'outline' as const }] : []),
        ]}
        stats={[
          { label: 'Version', value: m.currentVersion ?? '—' },
          { label: 'OS', value: `${m.os ?? 'windows'} ${m.osVersion ?? ''}` },
          { label: 'Branch', value: m.branchName ?? '—' },
          { label: 'Last heartbeat', value: lastHeartbeat },
          { label: 'Sales (30d)', value: m.salesCountLast30d ?? 0 },
          { label: 'Products', value: m.productCount ?? 0 },
        ]}
      />

      <UpdatePolicyPanel
        machineRowId={m.id}
        hostname={m.hostname}
        currentChannel={m.updateChannel ?? 'stable'}
        currentAutoUpdate={m.autoUpdateEnabled ?? 'true'}
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Hostname" value={m.hostname} />
                <Field label="Machine ID" value={<span className="font-mono">{m.machineId}</span>} />
                <Field label="OS" value={`${m.os ?? 'windows'} ${m.osVersion ?? ''}`} />
                <Field label="Architecture" value={m.arch} />
                <Field label="App version" value={m.currentVersion} />
                <Field label="Network mode" value={m.networkMode} />
                <Field label="Modules activated" value={activatedVariants.length ? activatedVariants.join(' · ') : m.activeModule} />
                <Field label="Currency" value={m.currency} />
                <Field label="Last IP" value={m.lastIp} />
                <Field label="First seen" value={m.firstSeenAt ? formatDate(m.firstSeenAt, true) : null} />
              </div>
            ),
          },
          {
            id: 'telemetry',
            label: 'Telemetry',
            count: telemetry.length,
            content: (
              <ol className="flex flex-col gap-3">
                {telemetry.map((t) => (
                  <li key={t.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
                    <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {formatDateShort(t.occurredAt)}
                    </time>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium">{t.kind}</span>
                      {t.payload != null && <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-24 overflow-hidden">{JSON.stringify(t.payload, null, 2).slice(0, 400)}</pre>}
                    </div>
                  </li>
                ))}
                {telemetry.length === 0 && <li className="text-sm text-muted-foreground">No telemetry yet.</li>}
              </ol>
            ),
          },
          {
            id: 'backups',
            label: 'Cloud backups',
            count: backups.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium font-mono">{b.s3Key}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(b.takenAt, true)} · uploaded {formatDateShort(b.uploadedAt)}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{(b.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
                {backups.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No backups recorded.</li>}
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
