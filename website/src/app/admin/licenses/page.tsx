import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import Link from 'next/link'
import { Key } from '@phosphor-icons/react/dist/ssr'
import { db, licenses, user } from '@/db'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminPagination,
  AdminSearch,
  AdminSelectFilter,
} from '@/components/admin/data-controls'
import { DeleteLicenseButton } from '@/components/admin/delete-license-button'

export const metadata = { title: 'Admin · Licences' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const VARIANT_OPTIONS = [
  { value: 'pro', label: 'Pro' },
  { value: 'dawa', label: 'Dawa' },
  { value: 'retail', label: 'Retail' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'hospitality', label: 'Hospitality' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'revoked', label: 'Revoked' },
]

function daysBetween(future: Date | string | null): number | null {
  if (!future) return null
  const d = typeof future === 'string' ? new Date(future) : future
  return Math.floor((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : status === 'trial'
        ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
        : status === 'lapsed'
          ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
          : 'text-[var(--color-fg-muted)] bg-[var(--color-bg-muted)] border-[var(--color-border)]'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      {status}
    </span>
  )
}

export default async function AdminLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; variant?: string; status?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const variant = sp.variant ?? ''
  const status = sp.status ?? ''

  const whereClauses = [
    q
      ? or(
          ilike(licenses.licenseKey, `%${q}%`),
          ilike(user.email, `%${q}%`),
        )
      : null,
    variant ? eq(licenses.variant, variant) : null,
    status ? eq(licenses.status, status) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses)

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        variant: licenses.variant,
        tier: licenses.tier,
        status: licenses.status,
        trialEndsAt: licenses.trialEndsAt,
        maintenanceUntil: licenses.maintenanceUntil,
        maxMachines: licenses.maxMachines,
        maxBranches: licenses.maxBranches,
        createdAt: licenses.createdAt,
        customerEmail: user.email,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(where)
      .orderBy(desc(licenses.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Licences"
        description="Every issued licence. Filter by status or variant, search by key or customer email."
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search by licence key or customer email…" />
        <div className="flex items-center gap-4">
          <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
          <AdminSelectFilter paramName="variant" label="Variant" options={VARIANT_OPTIONS} />
        </div>
      </div>

      {rows.length === 0 && total === 0 ? (
        <EmptyState
          icon={<Key weight="regular" className="size-8" />}
          title={q || variant || status ? 'No matches.' : 'No licences yet.'}
          description={
            q || variant || status
              ? 'Adjust the search or filters above to see other rows.'
              : 'The first one will show up here as soon as a customer completes a license_fee payment.'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Licence key</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead className="text-right">Branches</TableHead>
                <TableHead>Renew / Trial</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const daysLeft =
                  l.status === 'trial'
                    ? daysBetween(l.trialEndsAt)
                    : daysBetween(l.maintenanceUntil)
                const renewLabel =
                  l.status === 'trial'
                    ? l.trialEndsAt
                      ? new Date(l.trialEndsAt).toISOString().slice(0, 10)
                      : '—'
                    : l.maintenanceUntil
                      ? new Date(l.maintenanceUntil).toISOString().slice(0, 10)
                      : '—'
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/admin/licenses/${l.id}`}
                        className="font-mono text-[12px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
                      >
                        {l.licenseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[220px]">
                      {l.customerEmail ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em]">
                      {l.variant} <span className="text-[var(--color-fg-muted)]">· {l.tier}</span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={l.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{l.maxMachines}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{l.maxBranches}</TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums">
                      {renewLabel}
                      {daysLeft !== null ? (
                        <span
                          className={`ml-1.5 ${
                            daysLeft < 0
                              ? 'text-rose-600'
                              : daysLeft < 14
                                ? 'text-amber-600'
                                : 'text-[var(--color-fg-muted)]'
                          }`}
                        >
                          {daysLeft >= 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d ago`}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteLicenseButton licenseId={l.id} licenseKey={l.licenseKey} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}
