import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Licences' }

export default async function LicensesPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/licenses')

  const rows = await db
    .select()
    .from(licenses)
    .where(eq(licenses.userId, session.user.id))
    .orderBy(desc(licenses.createdAt))

  return (
    <div className="space-y-6">
      <PageHeading title="Licences" subtitle="The keys that activate Omnix on your tills." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No licences yet. <Link href="/buy" className="underline-offset-4 hover:underline">Buy one</Link>.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/dashboard/licenses/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] hover:bg-[var(--color-surface)]">
                <code className="font-mono">{l.licenseKey}</code>
                <span className="text-[var(--color-fg-muted)]">{l.variant} · {l.tier}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{l.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
