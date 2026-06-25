import { notFound } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { db, licenses, machines, payments, user, organization, auditLog } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminLicenseDetailPage({ params }: PageProps) {
  const { id } = await params
  const lic = await db.query.licenses.findFirst({ where: eq(licenses.id, id) })
  if (!lic) notFound()

  const [owner, org, licenseMachines, licensePayments] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, lic.userId) }),
    lic.organizationId ? db.query.organization.findFirst({ where: eq(organization.id, lic.organizationId) }) : null,
    db.select().from(machines).where(eq(machines.licenseId, id)).orderBy(desc(machines.lastSeenAt)),
    db.select().from(payments).where(eq(payments.licenseId, id)).orderBy(desc(payments.createdAt)),
  ])

  const KES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
  const totalPaid = licensePayments.filter((p) => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Licences', href: '/admin/licenses' }, { label: lic.licenseKey }]} />
      <BackButton fallback="/admin/licenses" label="Back to licences" />
      <EntityHero
        eyebrow="Licence"
        title={lic.licenseKey}
        subtitle={
          <>
            {lic.variant} · {lic.tier}
            {owner && <> · <Link className="underline" href={`/admin/users/${owner.id}`}>{owner.name}</Link></>}
            {org && <> @ <Link className="underline" href={`/admin/orgs/${org.id}`}>{org.name}</Link></>}
          </>
        }
        badges={[
          { label: lic.status, variant: lic.status === 'active' ? 'default' : lic.status === 'revoked' || lic.status === 'lapsed' ? 'destructive' : 'secondary' },
          ...(lic.cloudBackupEnabled ? [{ label: 'Cloud backup', variant: 'outline' as const }] : []),
        ]}
        stats={[
          { label: 'Variant', value: lic.variant },
          { label: 'Tier', value: lic.tier },
          { label: 'Machines', value: `${licenseMachines.length} / ${lic.maxMachines}` },
          { label: 'Branches', value: `0 / ${lic.maxBranches}` },
          { label: 'Maintenance', value: lic.maintenanceUntil ? formatDate(lic.maintenanceUntil) : '—' },
          { label: 'Paid', value: KES(totalPaid) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Issued" value={lic.paidAt ? formatDate(lic.paidAt) : null} />
                <Field label="Trial started" value={lic.trialStartedAt ? formatDate(lic.trialStartedAt) : null} />
                <Field label="Trial ends" value={lic.trialEndsAt ? formatDate(lic.trialEndsAt) : null} />
                <Field label="Major version cap" value={`v${lic.majorVersionCap}.x`} />
                <Field label="Modules" value={(lic.modules as string[]).join(', ') || '—'} />
                {lic.signedKey && <Field label="Signed key" value={<span className="font-mono text-[10px] break-all">{lic.signedKey.slice(0, 64)}…</span>} className="md:col-span-2" />}
              </div>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: licenseMachines.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {licenseMachines.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
                        <span className="text-[11px] text-muted-foreground">{m.os ?? 'windows'} · {m.currentVersion ?? '—'} · {m.status}</span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}
                      </span>
                    </Link>
                  </li>
                ))}
                {licenseMachines.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No machines bound.</li>}
              </ul>
            ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: licensePayments.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {licensePayments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{p.purpose}</span>
                        <span className="text-[11px] text-muted-foreground">{p.status} · {formatDate(p.createdAt)}</span>
                      </div>
                      <span className="font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
                {licensePayments.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No payments.</li>}
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
