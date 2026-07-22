import { count, desc, eq, ilike, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Buildings } from '@phosphor-icons/react/dist/ssr'
import { db, organization, machines, member } from '@/db'
import { EmptyState } from '@/components/admin/empty-state'
import { FilteredEmptyState } from '@/components/ui/state-view'
import { PageHeader } from '@/components/layout/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPagination, AdminSearch } from '@/components/admin/data-controls'

export const metadata = { title: 'Admin · Organisations' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''

  const where = q ? ilike(organization.name, `%${q}%`) : undefined

  const [orgs, totalRow] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        members: sql<number>`(SELECT count(*)::int FROM ${member} WHERE ${member.organizationId} = ${organization.id})`,
        machines: sql<number>`(SELECT count(*)::int FROM ${machines} WHERE ${machines.organizationId} = ${organization.id})`,
      })
      .from(organization)
      .where(where)
      .orderBy(desc(organization.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(organization).where(where),
  ])

  const total = totalRow[0]?.n ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description="Customer businesses with multi-user accounts. Solo customers don't have one."
      />

      <AdminSearch placeholder="Search by organisation name…" />

      {orgs.length === 0 ? (
        q ? (
          <FilteredEmptyState
            query={q}
            clearHref="/admin/orgs"
            entityLabel="organisations"
          />
        ) : (
          <EmptyState
            icon={<Buildings weight="regular" className="size-8" />}
            title="No organisations yet."
            description="Solo customers don't need an org. Once a customer adds a teammate, the org row gets created and lands here."
          />
        )
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Machines</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">·</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="min-w-[200px]">
                    <Link
                      href={`/admin/orgs/${o.id}`}
                      style={{ fontFamily: 'var(--font-display)' }}
                      className="text-[15px] font-medium hover:text-[var(--color-accent)] underline-offset-4 hover:underline truncate block max-w-[280px]"
                    >
                      {o.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-[11px] text-[var(--color-fg-muted)]">{o.slug}</code>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{o.members}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{o.machines}</TableCell>
                  <TableCell className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                    {new Date(o.createdAt).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/orgs/${o.id}`}
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

// Silence unused import lint when running tsc on the original eq import.
void eq
