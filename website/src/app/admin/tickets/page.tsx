import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import Link from 'next/link'
import { ChatCircle } from '@phosphor-icons/react/dist/ssr'
import { db, supportTickets, user } from '@/db'
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

export const metadata = { title: 'Admin · Tickets' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'open'
      ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
      : status === 'pending'
        ? 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/30'
        : 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      {status}
    </span>
  )
}

function PriorityPill({ priority }: { priority: string }) {
  const tone =
    priority === 'urgent'
      ? 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30'
      : priority === 'high'
        ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
        : priority === 'low'
          ? 'text-[var(--color-fg-muted)] bg-[var(--color-bg-muted)] border-[var(--color-border)]'
          : 'text-[var(--color-fg)] bg-transparent border-[var(--color-border)]'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      {priority}
    </span>
  )
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; priority?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? ''
  const priority = sp.priority ?? ''

  const whereClauses = [
    q ? or(ilike(supportTickets.subject, `%${q}%`), ilike(user.email, `%${q}%`)) : null,
    status ? eq(supportTickets.status, status) : null,
    priority ? eq(supportTickets.priority, priority) : null,
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
        id: supportTickets.id,
        subject: supportTickets.subject,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        customerEmail: user.email,
      })
      .from(supportTickets)
      .leftJoin(user, eq(supportTickets.userId, user.id))
      .where(where)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(supportTickets)
      .leftJoin(user, eq(supportTickets.userId, user.id))
      .where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Support tickets"
        description="Every customer ticket. Filter by status / priority, search by subject or customer email."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearch placeholder="Search by subject or customer email…" />
        <div className="flex items-center gap-4">
          <AdminSelectFilter paramName="status" label="Status" options={STATUS_OPTIONS} />
          <AdminSelectFilter paramName="priority" label="Priority" options={PRIORITY_OPTIONS} />
        </div>
      </div>

      {rows.length === 0 && total === 0 ? (
        <EmptyState
          icon={<ChatCircle weight="regular" className="size-8" />}
          title={q || status || priority ? 'No matches.' : 'Inbox zero.'}
          description={
            q || status || priority
              ? 'Adjust the search or filters.'
              : 'No support tickets in the system yet. Customers open them from /dashboard/support.'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="min-w-[240px]">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="text-[13px] font-medium hover:text-[var(--color-accent)] underline-offset-4 hover:underline truncate block max-w-[320px]"
                    >
                      {t.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[200px]">
                    {t.customerEmail ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                    {t.category}
                  </TableCell>
                  <TableCell>
                    <PriorityPill priority={t.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={t.status} />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {new Date(t.updatedAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/tickets/${t.id}`}
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
