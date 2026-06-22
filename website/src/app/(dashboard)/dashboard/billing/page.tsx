import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/dashboard/status-utils'
import { pricingFor } from '@/config/pricing'

export const metadata = { title: 'Billing' }

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/billing')

  const licList = await db
    .select()
    .from(licenses)
    .where(eq(licenses.userId, session.user.id))
    .orderBy(desc(licenses.createdAt))

  const p = pricingFor((session.user as { currency?: 'KES' }).currency ?? 'KES')

  return (
    <div className="space-y-8">
      <PageHeading title="Billing & add-ons" subtitle="Renew compliance, enable cloud backup, add seats." />

      <section>
        <h2 className="font-display text-[18px] font-medium mb-3">Compliance renewals</h2>
        {licList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
            No licences yet.
          </div>
        ) : (
          <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {licList.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div>
                  <code className="font-mono">{l.licenseKey}</code>
                  <span className="ml-3 text-[var(--color-fg-muted)]">until {l.maintenanceUntil?.toISOString().slice(0, 10) ?? '—'}</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/buy/${l.id}?type=maintenance`}>Renew</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AddOnCard title="Cloud backup" body="Encrypted nightly snapshots." price={`${p.currency} ${p.cloudBackupMonthly} / month`} href="/buy?type=cloud_backup" />
        <AddOnCard title="Extra branch" body="Add a branch to an existing licence." price={`${p.currency} ${p.extraBranchOneTime} one-time`} href="/buy?type=extra_branch" />
        <AddOnCard title="Extra till seat" body="Raise the machine activation cap." price={`${p.currency} ${p.extraMachineOneTime} one-time`} href="/buy?type=extra_machine" />
      </section>
    </div>
  )
}

function AddOnCard({ title, body, price, href }: { title: string; body: string; price: string; href: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[16px] font-medium">{title}</h3>
        <span className="font-mono text-[12px] text-[var(--color-fg-muted)]">{price}</span>
      </div>
      <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">{body}</p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link href={href}>Add</Link>
      </Button>
    </div>
  )
}
