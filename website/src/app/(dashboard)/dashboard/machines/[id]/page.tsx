import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db, machines } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

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

  return (
    <div className="space-y-6">
      <PageHeading title={m.hostname ?? 'Machine'} subtitle={`${m.os} · v${m.currentVersion ?? '?'} · ${m.status}`} />

      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Fingerprint</dt><dd className="font-mono text-[12px] mt-1">{m.machineId}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Currency</dt><dd className="mt-1">{m.currency ?? '—'}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Active module</dt><dd className="mt-1">{m.activeModule ?? '—'}</dd></div>
        <div><dt className="text-[var(--color-fg-subtle)] text-[10px] uppercase tracking-[0.18em]">Last seen</dt><dd className="mt-1">{m.lastSeenAt?.toISOString() ?? 'never'}</dd></div>
      </dl>
    </div>
  )
}
