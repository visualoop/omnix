import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { count, eq, desc } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/dashboard/status-utils'
import { pricingFor } from '@/config/pricing'

export const metadata = { title: 'Billing' }

const RENEWALS_SHOWN = 25

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/billing')

  // Scoped to the signed-in customer, and bounded — the full, searchable
  // set lives on the paginated Licences page.
  const [licList, totalRow] = await Promise.all([
    db
      .select()
      .from(licenses)
      .where(eq(licenses.userId, session.user.id))
      .orderBy(desc(licenses.createdAt))
      .limit(RENEWALS_SHOWN),
    db.select({ n: count() }).from(licenses).where(eq(licenses.userId, session.user.id)),
  ])

  const total = totalRow[0]?.n ?? 0
  const p = pricingFor((session.user as { currency?: 'KES' }).currency ?? 'KES')

  const addOns = [
    {
      title: 'Cloud backup',
      body: 'Encrypted nightly snapshots of your shop database, restorable from any device.',
      price: `${p.currency} ${p.cloudBackupMonthly.toLocaleString()} / month`,
      href: '/buy?type=cloud_backup',
    },
    {
      title: 'Extra branch',
      body: 'Add another branch to an existing licence for multi-shop reporting.',
      price: `${p.currency} ${p.extraBranchOneTime.toLocaleString()} one-time`,
      href: '/buy?type=extra_branch',
    },
    {
      title: 'Extra till seat',
      body: 'Raise the device activation cap so you can run another till.',
      price: `${p.currency} ${p.extraMachineOneTime.toLocaleString()} one-time`,
      href: '/buy?type=extra_machine',
    },
  ]

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Payments"
        title="Billing & add-ons"
        description="Renew the annual compliance cover on your licences, and add branches, till seats or cloud backup when you grow."
      />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
            Compliance renewals
          </h2>
          {total > licList.length ? (
            <Link
              href="/dashboard/licenses"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              All {total} licences →
            </Link>
          ) : null}
        </div>

        {licList.length === 0 ? (
          <EmptyState
            title="No licences to renew"
            body="Once you own a licence, its yearly compliance renewal appears here."
            action={
              <Button asChild>
                <Link href="/buy">Buy a licence</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {licList.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <code className="font-mono text-[12px] text-[var(--color-fg)]">{l.licenseKey}</code>
                  <span className="ml-0 mt-1 block text-[12px] text-[var(--color-fg-muted)] sm:ml-3 sm:mt-0 sm:inline">
                    compliance until {l.maintenanceUntil?.toISOString().slice(0, 10) ?? '—'}
                  </span>
                </div>
                <Button asChild size="sm" variant="outline" className="max-sm:w-full">
                  <Link href={`/buy/${l.id}?type=maintenance`}>Renew</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
          Add-ons
        </h2>
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {addOns.map((a) => (
            <li key={a.title} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-[15px] font-semibold text-[var(--color-fg)]">{a.title}</h3>
                  <span className="font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">{a.price}</span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-[var(--color-fg-muted)]">{a.body}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="max-sm:w-full">
                <Link href={a.href}>Add</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
