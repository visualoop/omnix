import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { db, supportTickets } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, StatusPill } from '@/components/dashboard/status-utils'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { ListPagination, ListSearch } from '@/components/dashboard/list-controls'

export const metadata = { title: 'Support' }

const PAGE_SIZE = 25

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/support')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Scoped to the ticket owner. Previously this loaded every ticket
  // unbounded — it now pages within the owner's tickets and searches by
  // subject.
  const where = q
    ? and(eq(supportTickets.userId, session.user.id), ilike(supportTickets.subject, `%${q}%`))
    : eq(supportTickets.userId, session.user.id)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(supportTickets)
      .where(where)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(supportTickets).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Account"
        title="Support"
        description="Open a ticket and read our replies. This covers your account, licences and billing — your shop runs in the installed Omnix app."
        actions={
          <Button asChild>
            <Link href="/dashboard/support/new">New ticket</Link>
          </Button>
        }
      />

      <ListSearch label="Search tickets" placeholder="Search by subject…" />

      {rows.length === 0 ? (
        q ? (
          <FilteredEmptyState query={q} clearHref="/dashboard/support" entityLabel="tickets" />
        ) : (
          <EmptyState
            title="No tickets yet"
            body="Stuck on something with your account, licences or billing? Open a ticket and we reply on weekdays within 4 hours."
            action={
              <Button asChild>
                <Link href="/dashboard/support/new">Open a ticket</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="min-w-[200px]">
                    <Link
                      href={`/dashboard/support/${t.id}`}
                      className="font-medium text-[var(--color-fg)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize text-[var(--color-fg-muted)]">{t.category}</TableCell>
                  <TableCell>
                    <StatusPill kind="ticket" status={t.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/support/${t.id}`}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      Open →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListPagination page={page} pageSize={PAGE_SIZE} total={total} label="Ticket pages" />
        </div>
      )}
    </div>
  )
}
