import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'

export const metadata = { title: 'Licences' }

const PAGE_SIZE = 25

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
    <div className="space-y-6">
      <PageHeading title="Licences" subtitle="The keys that activate Omnix on your tills." />

      <AdminSearch placeholder="Search by licence key…" />

      {rows.length === 0 && total === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          {q ? (
            <>No licences match that search.</>
          ) : (
            <>
              No licences yet. <Link href="/buy" className="underline-offset-4 hover:underline">Buy one</Link>.
            </>
          )}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Licence key</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead>Renew / Trial</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
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
                        className="font-mono text-[12px] hover:text-[var(--color-accent)] underline-offset-4 hover:underline"
                      >
                        {l.licenseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em]">
                      {l.variant} <span className="text-[var(--color-fg-muted)]">· {l.tier}</span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={l.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{l.maxMachines}</TableCell>
                    <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                      {renew}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/licenses/${l.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      >
                        Open →
                      </Link>
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
