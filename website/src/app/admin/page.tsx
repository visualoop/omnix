import { count, eq, sql } from 'drizzle-orm'
import { db, user, licenses, machines, payments, supportTickets, organization } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Overview' }

export default async function AdminOverviewPage() {
  const [users, orgs, lics, mach, openTix, paid] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(organization),
    db.select({ n: count() }).from(licenses),
    db.select({ n: count() }).from(machines),
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, 'open')),
    db.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)::int` }).from(payments).where(eq(payments.status, 'success')),
  ])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Overview" description="System-wide KPIs as of right now." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPI label="Users" value={users[0].n} />
        <KPI label="Orgs" value={orgs[0].n} />
        <KPI label="Licences" value={lics[0].n} />
        <KPI label="Machines" value={mach[0].n} />
        <KPI label="Open tickets" value={openTix[0].n} />
        <KPI label="Lifetime revenue" value={`KSh ${Number(paid[0].sum ?? 0).toLocaleString()}`} mono />
      </div>
    </div>
  )
}

function KPI({ label, value, mono }: { label: string; value: number | string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{label}</div>
      <div
        style={{ fontFamily: 'var(--font-display, serif)' }}
        className={`mt-1.5 text-[clamp(28px,3vw,40px)] font-medium leading-[1.05] tracking-[-0.01em] ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}
