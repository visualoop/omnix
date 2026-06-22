import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db, supportTickets } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Support' }

export default async function SupportPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/support')

  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt))

  return (
    <div className="space-y-6">
      <PageHeading
        title="Support"
        subtitle="Open tickets, replies from us, history."
        actions={<Button asChild><Link href="/dashboard/support/new">New ticket</Link></Button>}
      />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          No tickets yet. Need help? <Link href="/dashboard/support/new" className="underline-offset-4 hover:underline">Open one</Link>.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/support/${t.id}`} className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-3 text-[13px] hover:bg-[var(--color-surface)]">
                <span className="text-[var(--color-fg)] font-medium truncate">{t.subject}</span>
                <span className="text-[var(--color-fg-muted)]">{t.category}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{t.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
