import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq, desc } from 'drizzle-orm'
import { db, licenses, machines, payments } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

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

  const KES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
  const totalPaid = paid.filter((p) => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Licences', href: '/dashboard/licenses' }, { label: l.licenseKey }]} />
      <BackButton fallback="/dashboard/licenses" label="Back to licences" />
      <EntityHero
        eyebrow="Licence"
        title={l.licenseKey}
        subtitle={`${l.variant} · ${l.tier} · issued ${formatDate(l.paidAt ?? l.trialStartedAt)}`}
        badges={[
          { label: l.status, variant: l.status === 'active' ? 'default' : l.status === 'lapsed' || l.status === 'revoked' ? 'destructive' : 'secondary' },
          ...(l.cloudBackupEnabled ? [{ label: 'Cloud backup', variant: 'outline' as const }] : []),
        ]}
        stats={[
          { label: 'Variant', value: l.variant },
          { label: 'Tier', value: l.tier },
          { label: 'Machines', value: `${bound.length} / ${l.maxMachines}` },
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
            render: () => (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Major-version cap" value={`v${l.majorVersionCap}.x`} />
                <Field label="Modules" value={(l.modules as string[]).join(', ') || '—'} />
                <Field label="Trial started" value={formatDate(l.trialStartedAt)} />
                <Field label="Trial ends" value={formatDate(l.trialEndsAt)} />
                <Field label="Paid on" value={formatDate(l.paidAt)} />
                <Field label="Cloud backup expires" value={formatDate(l.cloudBackupExpiresAt)} />
              </div>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: bound.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {bound.map((m) => (
                  <li key={m.id}>
                    <Link href={`/dashboard/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
                        <span className="text-[11px] text-muted-foreground">{m.os ?? 'windows'} · v{m.currentVersion ?? '?'}</span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">{formatDateShort(m.lastSeenAt)}</span>
                    </Link>
                  </li>
                ))}
                {bound.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No machines bound yet.</li>}
              </ul>
            ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: paid.length,
            render: () => (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {paid.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">{p.purpose}</span>
                      <span className="text-[11px] text-muted-foreground">{p.status} · {formatDate(p.createdAt)}</span>
                    </div>
                    <span className="font-mono text-[13px] tabular-nums">
                      {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
                    </span>
                  </li>
                ))}
                {paid.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No payments recorded.</li>}
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
