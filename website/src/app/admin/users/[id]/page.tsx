import { notFound } from 'next/navigation'
import { eq, desc, count } from 'drizzle-orm'
import { db, user, licenses, machines, payments, supportTickets, member, organization, auditLog, resellers } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'
import { ResellerControls } from './reseller-controls'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const KES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params
  const userRow = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (!userRow) notFound()

  const [userLicenses, userMachines, userPayments, userTickets, userMemberships, userAudit, resellerRow] = await Promise.all([
    db.select().from(licenses).where(eq(licenses.userId, id)).orderBy(desc(licenses.createdAt)).limit(50),
    db.select().from(machines).where(eq(machines.userId, id)).orderBy(desc(machines.lastSeenAt)).limit(50),
    db.select().from(payments).where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)).limit(50),
    db.select().from(supportTickets).where(eq(supportTickets.userId, id)).orderBy(desc(supportTickets.createdAt)).limit(50),
    db.select({ org: organization }).from(member).innerJoin(organization, eq(member.organizationId, organization.id)).where(eq(member.userId, id)),
    db.select().from(auditLog).where(eq(auditLog.actorId, id)).orderBy(desc(auditLog.createdAt)).limit(100),
    db.select().from(resellers).where(eq(resellers.userId, id)).limit(1).catch(() => []),
  ])

  const totalSpent = userPayments.filter((p) => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)
  const activeLicenses = userLicenses.filter((l) => l.status === 'active' || l.status === 'trial').length

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Users', href: '/admin/users' }, { label: userRow.name }]} />
      <BackButton fallback="/admin/users" label="Back to users" />
      <EntityHero
        eyebrow="User"
        title={userRow.name}
        subtitle={[userRow.email, userRow.phoneNumber, userRow.businessName].filter(Boolean).join(' · ')}
        badges={[
          { label: userRow.role, variant: userRow.role === 'user' ? 'secondary' : 'default' },
          ...(userRow.banned ? [{ label: 'Banned', variant: 'destructive' as const }] : []),
          ...(userRow.emailVerified ? [] : [{ label: 'Unverified', variant: 'outline' as const }]),
        ]}
        stats={[
          { label: 'Joined', value: formatDate(userRow.createdAt) },
          { label: 'Country', value: userRow.country },
          { label: 'Currency', value: userRow.currency },
          { label: 'Licences', value: userLicenses.length, tone: activeLicenses > 0 ? 'positive' : 'muted' },
          { label: 'Machines', value: userMachines.length },
          { label: 'Lifetime spend', value: KES(totalSpent) },
        ]}
      />

      <ResellerControls
        userId={userRow.id}
        reseller={
          resellerRow[0]
            ? {
                id: resellerRow[0].id,
                companyName: resellerRow[0].companyName,
                discountPercent: resellerRow[0].discountPercent,
                status: resellerRow[0].status,
                totalLicensesIssued: resellerRow[0].totalLicensesIssued,
                totalRevenueBrought: resellerRow[0].totalRevenueBrought,
                totalCommissionEarned: resellerRow[0].totalCommissionEarned,
                unpaidCommission: resellerRow[0].unpaidCommission,
                commissionCurrency: resellerRow[0].commissionCurrency,
                approvedAt: resellerRow[0].approvedAt?.toISOString() ?? null,
              }
            : null
        }
      />

      <LazyTabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Email" value={userRow.email} />
                <Field label="Phone" value={userRow.phoneNumber} />
                <Field label="Business" value={userRow.businessName} />
                <Field label="Country / currency" value={`${userRow.country} · ${userRow.currency}`} />
                <Field label="Verified" value={userRow.emailVerified ? 'Yes' : 'No'} />
                <Field label="Staff team" value={userRow.staffTeam ?? '—'} />
                {userRow.banned && (
                  <Field label="Ban reason" value={userRow.banReason} className="md:col-span-2" />
                )}
                {userMemberships.length > 0 && (
                  <div className="md:col-span-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Member of</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {userMemberships.map((m) => (
                        <Link
                          key={m.org.id}
                          href={`/admin/orgs/${m.org.id}`}
                          className="rounded-md border border-foreground/15 px-2 py-1 text-[12px] hover:bg-foreground/[0.04]"
                        >
                          {m.org.name}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'licenses',
            label: 'Licences',
            count: userLicenses.length,
            content: <LicensesList rows={userLicenses} />,
          },
          {
            id: 'machines',
            label: 'Machines',
            count: userMachines.length,
            content: <MachinesList rows={userMachines} />,
          },
          {
            id: 'payments',
            label: 'Payments',
            count: userPayments.length,
            content: <PaymentsList rows={userPayments} />,
          },
          {
            id: 'tickets',
            label: 'Tickets',
            count: userTickets.length,
            content: <TicketsList rows={userTickets} />,
          },
          {
            id: 'audit',
            label: 'Audit',
            count: userAudit.length,
            content: <AuditList rows={userAudit} />,
          },
        ]}
      />
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  )
}

function LicensesList({ rows }: { rows: Array<typeof licenses.$inferSelect> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No licences.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {rows.map((l) => (
        <li key={l.id}>
          <Link href={`/admin/licenses/${l.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium font-mono">{l.licenseKey}</span>
              <span className="text-[11px] text-muted-foreground">
                {l.variant} · {l.tier} · {l.status}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {l.paidAt ? formatDate(l.paidAt) : '—'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function MachinesList({ rows }: { rows: Array<typeof machines.$inferSelect> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No machines.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
              <span className="text-[11px] text-muted-foreground">
                {m.os} · {m.currentVersion ?? 'unknown'} · {m.networkMode ?? 'standalone'}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function PaymentsList({ rows }: { rows: Array<typeof payments.$inferSelect> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No payments.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{p.purpose}</span>
              <span className="text-[11px] text-muted-foreground">
                {p.paystackReference} · {p.status}
              </span>
            </div>
            <span className="font-mono text-[13px] tabular-nums">
              {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TicketsList({ rows }: { rows: Array<typeof supportTickets.$inferSelect> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No tickets.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {rows.map((t) => (
        <li key={t.id}>
          <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{t.subject}</span>
              <span className="text-[11px] text-muted-foreground">
                {t.category} · {t.priority} · {t.status}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatDate(t.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AuditList({ rows }: { rows: Array<typeof auditLog.$inferSelect> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((a) => (
        <li key={a.id} className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {formatDateShort(a.createdAt)}
          </time>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">{a.action}</span>
            {a.resource && <span className="text-[11px] text-muted-foreground font-mono">{a.resource}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}
