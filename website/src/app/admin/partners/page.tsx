import Link from 'next/link'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { affiliates, db, resellers, user } from '@/db'
import { PartnerAdminActions } from '@/components/admin/partner-admin-actions'
import { AdminPagination, AdminSearch, AdminSelectFilter } from '@/components/admin/data-controls'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DESK_ACCESS, requireStaffAccess } from '@/lib/permissions/admin-guard'
import { formatDate } from '@/lib/format-date'
import { Handshake } from '@phosphor-icons/react/dist/ssr'

export const metadata = { title: 'Admin · Partner programs' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type Program = 'affiliates' | 'resellers'

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; page?: string; q?: string; status?: string }>
}) {
  await requireStaffAccess(DESK_ACCESS.partners, '/admin/partners')

  const sp = await searchParams
  const program: Program = sp.program === 'resellers' ? 'resellers' : 'affiliates'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? ''

  return program === 'resellers'
    ? <ResellerDesk page={page} q={q} status={status} />
    : <AffiliateDesk page={page} q={q} status={status} />
}

async function AffiliateDesk({ page, q, status }: { page: number; q: string; status: string }) {
  const search = q
    ? or(
        ilike(affiliates.refCode, `%${q}%`),
        ilike(affiliates.displayName, `%${q}%`),
        ilike(affiliates.contactEmail, `%${q}%`),
        ilike(user.email, `%${q}%`),
        ilike(user.name, `%${q}%`),
      )
    : undefined
  const statusClause = status === 'blocked'
    ? eq(affiliates.blocked, true)
    : status === 'active'
      ? eq(affiliates.blocked, false)
      : undefined
  const where = and(search, statusClause)

  const [rows, totalRow, allRow, blockedRow, referralsRow, unpaidRow] = await Promise.all([
    db
      .select({
        id: affiliates.id,
        userId: affiliates.userId,
        refCode: affiliates.refCode,
        displayName: affiliates.displayName,
        contactEmail: affiliates.contactEmail,
        commissionPercent: affiliates.commissionPercent,
        totalReferralsCredited: affiliates.totalReferralsCredited,
        totalCommissionEarned: affiliates.totalCommissionEarned,
        unpaidBalance: affiliates.unpaidBalance,
        commissionCurrency: affiliates.commissionCurrency,
        blocked: affiliates.blocked,
        blockedReason: affiliates.blockedReason,
        createdAt: affiliates.createdAt,
        userEmail: user.email,
        userName: user.name,
      })
      .from(affiliates)
      .leftJoin(user, eq(affiliates.userId, user.id))
      .where(where)
      .orderBy(desc(affiliates.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(affiliates).leftJoin(user, eq(affiliates.userId, user.id)).where(where),
    db.select({ n: count() }).from(affiliates),
    db.select({ n: count() }).from(affiliates).where(eq(affiliates.blocked, true)),
    db.select({ n: sql<number>`coalesce(sum(${affiliates.totalReferralsCredited}), 0)` }).from(affiliates),
    db.select({ n: sql<number>`coalesce(sum(${affiliates.unpaidBalance}), 0)` }).from(affiliates),
  ])

  const total = totalRow[0]?.n ?? 0
  const currency = rows[0]?.commissionCurrency ?? 'KES'

  return (
    <PartnerDeskFrame
      program="affiliates"
      total={total}
      page={page}
      stats={[
        { label: 'Affiliate accounts', value: (allRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Blocked', value: (blockedRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Referrals credited', value: Number(referralsRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Unpaid balance', value: `${currency} ${Math.round(Number(unpaidRow[0]?.n ?? 0)).toLocaleString()}` },
      ]}
    >
      {rows.length === 0 ? (
        q || status ? (
          <FilteredEmptyState query={q || undefined} clearHref="/admin/partners" entityLabel="affiliates" />
        ) : (
          <EmptyState
            icon={<Handshake weight="regular" className="size-8" />}
            title="No affiliates yet."
            description="When a customer joins the referral program, their account and commission activity will appear here."
          />
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead>Referral code</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Referrals</TableHead>
              <TableHead className="text-right">Earned</TableHead>
              <TableHead className="text-right">Unpaid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[17rem]">Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="min-w-[13rem]">
                  <Link href={`/admin/users/${row.userId}`} className="font-medium text-[var(--color-fg)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline">
                    {row.displayName || row.userName || 'Affiliate'}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{row.contactEmail || row.userEmail}</div>
                </TableCell>
                <TableCell><code className="font-mono text-[11px]">{row.refCode}</code></TableCell>
                <TableCell className="font-mono tabular-nums">{row.commissionPercent}%</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.totalReferralsCredited.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.commissionCurrency} {Math.round(row.totalCommissionEarned).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.commissionCurrency} {Math.round(row.unpaidBalance).toLocaleString()}</TableCell>
                <TableCell><PartnerStatus active={!row.blocked} inactiveLabel="Blocked" /></TableCell>
                <TableCell className="font-mono text-[11px] text-[var(--color-fg-muted)]">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <PartnerAdminActions
                    kind="affiliate"
                    entityId={row.id}
                    userId={row.userId}
                    initialRate={row.commissionPercent}
                    initialStatus={row.blocked ? 'blocked' : 'active'}
                    blockedReason={row.blockedReason}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PartnerDeskFrame>
  )
}

async function ResellerDesk({ page, q, status }: { page: number; q: string; status: string }) {
  const search = q
    ? or(
        ilike(resellers.companyName, `%${q}%`),
        ilike(resellers.contactEmail, `%${q}%`),
        ilike(user.email, `%${q}%`),
        ilike(user.name, `%${q}%`),
      )
    : undefined
  const statusClause = status === 'active' || status === 'suspended' ? eq(resellers.status, status) : undefined
  const where = and(search, statusClause)

  const [rows, totalRow, allRow, suspendedRow, licensesRow, unpaidRow] = await Promise.all([
    db
      .select({
        id: resellers.id,
        userId: resellers.userId,
        companyName: resellers.companyName,
        contactEmail: resellers.contactEmail,
        discountPercent: resellers.discountPercent,
        status: resellers.status,
        totalLicensesIssued: resellers.totalLicensesIssued,
        totalRevenueBrought: resellers.totalRevenueBrought,
        totalCommissionEarned: resellers.totalCommissionEarned,
        unpaidCommission: resellers.unpaidCommission,
        commissionCurrency: resellers.commissionCurrency,
        createdAt: resellers.createdAt,
        userEmail: user.email,
        userName: user.name,
      })
      .from(resellers)
      .leftJoin(user, eq(resellers.userId, user.id))
      .where(where)
      .orderBy(desc(resellers.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(resellers).leftJoin(user, eq(resellers.userId, user.id)).where(where),
    db.select({ n: count() }).from(resellers),
    db.select({ n: count() }).from(resellers).where(eq(resellers.status, 'suspended')),
    db.select({ n: sql<number>`coalesce(sum(${resellers.totalLicensesIssued}), 0)` }).from(resellers),
    db.select({ n: sql<number>`coalesce(sum(${resellers.unpaidCommission}), 0)` }).from(resellers),
  ])

  const total = totalRow[0]?.n ?? 0
  const currency = rows[0]?.commissionCurrency ?? 'KES'

  return (
    <PartnerDeskFrame
      program="resellers"
      total={total}
      page={page}
      stats={[
        { label: 'Reseller accounts', value: (allRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Suspended', value: (suspendedRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Licences issued', value: Number(licensesRow[0]?.n ?? 0).toLocaleString() },
        { label: 'Unpaid commission', value: `${currency} ${Math.round(Number(unpaidRow[0]?.n ?? 0)).toLocaleString()}` },
      ]}
    >
      {rows.length === 0 ? (
        q || status ? (
          <FilteredEmptyState query={q || undefined} clearHref="/admin/partners?program=resellers" entityLabel="resellers" />
        ) : (
          <EmptyState
            icon={<Handshake weight="regular" className="size-8" />}
            title="No resellers yet."
            description="Promote a customer from their user record to give them the wholesale reseller dashboard."
          />
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reseller</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="text-right">Licences</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Unpaid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[17rem]">Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="min-w-[13rem]">
                  <Link href={`/admin/users/${row.userId}`} className="font-medium text-[var(--color-fg)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline">
                    {row.companyName}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{row.contactEmail || row.userEmail}</div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{row.discountPercent}%</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.totalLicensesIssued.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.commissionCurrency} {Math.round(row.totalRevenueBrought).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.commissionCurrency} {Math.round(row.totalCommissionEarned).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.commissionCurrency} {Math.round(row.unpaidCommission).toLocaleString()}</TableCell>
                <TableCell><PartnerStatus active={row.status === 'active'} inactiveLabel="Suspended" /></TableCell>
                <TableCell className="font-mono text-[11px] text-[var(--color-fg-muted)]">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <PartnerAdminActions
                    kind="reseller"
                    entityId={row.id}
                    userId={row.userId}
                    initialRate={row.discountPercent}
                    initialStatus={row.status === 'suspended' ? 'suspended' : 'active'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PartnerDeskFrame>
  )
}

function PartnerDeskFrame({
  program,
  page,
  total,
  stats,
  children,
}: {
  program: Program
  page: number
  total: number
  stats: Array<{ label: string; value: string }>
  children: React.ReactNode
}) {
  const statusOptions = program === 'resellers'
    ? [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]
    : [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue channels"
        title="Partner programs"
        description="Operate referral affiliates and wholesale resellers from one audited desk."
      />

      <nav aria-label="Partner program" className="flex border-b border-[var(--color-border)]">
        <ProgramTab href="/admin/partners" active={program === 'affiliates'}>Affiliates</ProgramTab>
        <ProgramTab href="/admin/partners?program=resellers" active={program === 'resellers'}>Resellers</ProgramTab>
      </nav>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-[var(--color-border)] pb-5 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">{stat.label}</dt>
            <dd className="mt-1 font-mono text-[18px] tabular-nums text-[var(--color-fg)]">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder={`Search ${program}…`} label={`Search ${program}`} />
        <AdminSelectFilter paramName="status" label="Status" options={statusOptions} />
      </div>

      {children}
      <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} label={`${program} pages`} />
    </div>
  )
}

function ProgramTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${active ? 'border-[var(--color-accent)] text-[var(--color-fg)]' : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'}`}
    >
      {children}
    </Link>
  )
}

function PartnerStatus({ active, inactiveLabel }: { active: boolean; inactiveLabel: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${active ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
      {active ? 'Active' : inactiveLabel}
    </span>
  )
}
