import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db, machines } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Machines' }

export default async function MachinesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/machines')

  const rows = await db
    .select()
    .from(machines)
    .where(eq(machines.userId, session.user.id))
    .orderBy(desc(machines.lastSeenAt))

  return (
    <div className="space-y-6">
      <PageHeading title="Machines" subtitle="Every desktop install activated against your licences." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No machines yet. Install Omnix on your till and paste your licence key on first launch.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((m) => (
            <li key={m.id}>
              <Link href={`/dashboard/machines/${m.id}`} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-3 text-[13px] items-center hover:bg-[var(--color-surface)]">
                <span className="text-[var(--color-fg)] font-medium">{m.hostname ?? '—'}</span>
                <span className="text-[var(--color-fg-muted)]">{m.os} · v{m.currentVersion ?? '?'}</span>
                <span className="text-[var(--color-fg-muted)]">{m.city ?? '—'}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{m.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
