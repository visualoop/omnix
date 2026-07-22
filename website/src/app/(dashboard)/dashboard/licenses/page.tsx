import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { db, licenses } from '@/db'
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

export const metadata = { title: 'Licences' }

const PAGE_SIZE = 25

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/licenses')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  // Ownership is enforced in SQL: a customer only ever queries their own
  // licences. Search narrows within that scope; it never widens it.
  const where = q
    ? and(eq(licenses.userId, session.user.id), ilike(licenses.licenseKey, `%${q}%`))
    : eq(licenses.userId, session.user.id)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(licenses)
      .where(where)
      .orderBy(desc(licenses.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(licenses).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Your software"
        title="Licences"
        description="The keys that activate Omnix on your tills, and the compliance cover each one carries."
      />

      <ListSearch label="Search licences" placeholder="Search by licence key…" />

      {rows.length === 0 ? (
        q ? (
          <FilteredEmptyState query={q} clearHref="/dashboard/licenses" entityLabel="licences" />
        ) : (
          <EmptyState
            title="No licences yet"
            body="Buy a perpetual licence for the trade you run — Pharmacy, Retail, Hospitality, Hardware, or Salon & Spa. One-time payment, no subscription."
            action={
              <Button asChild>
                <Link href="/buy">Buy a licence</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Licence key</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead>Renew / trial</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const renew =
                  l.status === 'trial'
                    ? l.trialEndsAt
                      ? new Date(l.trialEndsAt).toISOString().slice(0, 10)
                      : '—'
                    : l.maintenanceUntil
                      ? new Date(l.maintenanceUntil).toISOString().slice(0, 10)
                      : '—'
                return (
                  <TableRow key={l.id}>
                    <TableCell className="min-w-[200px]">
                      <Link
                        href={`/dashboard/licenses/${l.id}`}
                        className="font-mono text-[12px] text-[var(--color-fg)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
                      >
                        {l.licenseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
                      {l.variant} · {l.tier}
                    </TableCell>
                    <TableCell>
                      <StatusPill kind="license" status={l.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {l.maxMachines}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                      {renew}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/licenses/${l.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        Open →
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <ListPagination page={page} pageSize={PAGE_SIZE} total={total} label="Licence pages" />
        </div>
      )}
    </div>
  )
}
