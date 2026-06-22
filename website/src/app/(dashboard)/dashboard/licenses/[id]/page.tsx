import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

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

  return (
    <div className="space-y-6">
      <PageHeading
        title={l.licenseKey}
        subtitle={`${l.variant} · ${l.tier} · ${l.status}`}
      />
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Branches</dt><dd className="mt-1">{l.maxBranches}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Machines</dt><dd className="mt-1">{l.maxMachines}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Compliance until</dt><dd className="mt-1 font-mono">{l.maintenanceUntil?.toISOString().slice(0, 10) ?? '—'}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Major-version cap</dt><dd className="mt-1">v{l.majorVersionCap}.x</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Cloud backup</dt><dd className="mt-1">{l.cloudBackupEnabled ? 'Enabled' : 'Off'}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Paid on</dt><dd className="mt-1 font-mono">{l.paidAt?.toISOString().slice(0, 10) ?? '—'}</dd></div>
      </dl>
    </div>
  )
}
