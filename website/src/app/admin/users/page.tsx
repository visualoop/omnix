import { and, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Users } from '@phosphor-icons/react/dist/ssr'
import { db, user } from '@/db'
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

export const metadata = { title: 'Admin · Users' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const ROLE_OPTIONS = [
  { value: 'user', label: 'Customer' },
  { value: 'platform_admin', label: 'Platform admin' },
  { value: 'support_agent', label: 'Support agent' },
  { value: 'sales_rep', label: 'Sales rep' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
]

function RolePill({ role }: { role: string }) {
  const isStaff = role !== 'user'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
        isStaff
          ? 'text-[var(--color-accent)] bg-[var(--color-accent-soft)] border-[var(--color-accent-line)]'
          : 'text-[var(--color-fg-muted)] bg-[var(--color-bg-muted)] border-[var(--color-border)]'
      }`}
    >
      {role.replace('_', ' ')}
    </span>
  )
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string; status?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const role = sp.role ?? ''
  const status = sp.status ?? ''

  const whereClauses = [
    q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) : null,
    role ? eq(user.role, role) : null,
    status === 'banned' ? eq(user.banned, true) : status === 'active' ? eq(user.banned, false) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const where =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses)

  const [rows, totalRow, totalUsers, staffCount, bannedCount] = await Promise.all([
    db
      .select()
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(user).where(where),
    db.select({ n: sql<number>`count(*)::int` }).from(user),
    db.select({ n: sql<number>`count(*)::int` }).from(user).where(ne(user.role, 'user')),
    db.select({ n: sql<number>`count(*)::int` }).from(user).where(eq(user.banned, true)),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Every account — customers, support agents, sales reps, platform admins."
        actions={
          <Link
            href="/admin/customers/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            + New customer
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={totalUsers[0].n} />
        <Stat label="Staff" value={staffCount[0].n} accent />
        <Stat label="Banned" value={bannedCount[0].n} negative={bannedCount[0].n > 0} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search by email or name…" />
        <div className="flex items-center gap-4">
          <AdminSelectFilter paramName="role" label="Role" options={ROLE_OPTIONS} />
          <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
        </div>
      </div>

      {rows.length === 0 && total === 0 ? (
        <EmptyState
          icon={<Users weight="regular" className="size-8" />}
          title={q || role || status ? 'No matches.' : 'No users yet.'}
          description={
            q || role || status ? 'Adjust the search or filters.' : 'Sign-ups via /login or pre-seeded admins land here.'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="min-w-[200px]">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-[12px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline truncate block max-w-[280px]"
                    >
                      {u.email}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[160px]">
                    {u.name || '—'}
                  </TableCell>
                  <TableCell>
                    <RolePill role={u.role ?? 'user'} />
                  </TableCell>
                  <TableCell>
                    {u.banned ? (
                      <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
                        Banned
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                        Active
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {new Date(u.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      Open →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  negative,
}: {
  label: string
  value: number
  accent?: boolean
  negative?: boolean
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{label}</div>
      <div
        className="mt-1 font-mono tabular-nums text-[20px]"
        style={{
          color: accent ? 'var(--color-accent)' : negative ? 'var(--color-negative)' : 'var(--color-fg)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
