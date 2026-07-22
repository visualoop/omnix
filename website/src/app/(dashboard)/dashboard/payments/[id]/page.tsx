import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db, payments, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { DetailField, DetailGrid } from '@/components/dashboard/detail-field'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

export default async function DashboardPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  // Ownership gate — a payment belonging to another account is
  // indistinguishable from one that does not exist.
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, session.user.id)))
    .limit(1)
  const p = rows[0]
  if (!p) notFound()

  // The linked licence is only resolved when it also belongs to this
  // customer, so a shared licence id can never leak another account's key.
  const license = p.licenseId
    ? await db.query.licenses.findFirst({
        where: and(eq(licenses.id, p.licenseId), eq(licenses.userId, session.user.id)),
      })
    : null
  const fmt = new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Payments', href: '/dashboard/payments' }, { label: p.paystackReference }]} />
      <BackButton fallback="/dashboard/payments" label="Back to payments" />
      <EntityHero
        eyebrow="Payment receipt"
        title={p.paystackReference}
        subtitle={p.purpose.replace(/_/g, ' ')}
        badges={[
          {
            label: p.status,
            variant:
              p.status === 'success'
                ? 'default'
                : p.status === 'failed' || p.status === 'reversed'
                  ? 'destructive'
                  : 'secondary',
          },
        ]}
        stats={[
          { label: 'Amount', value: fmt },
          { label: 'Currency', value: p.currency },
          { label: 'Initiated', value: formatDate(p.createdAt, true) },
          { label: 'Paid at', value: formatDate(p.paidAt, true) },
        ]}
      />

      <DetailGrid>
        <DetailField label="Reference" value={p.paystackReference} mono />
        <DetailField label="Purpose" value={<span className="capitalize">{p.purpose.replace(/_/g, ' ')}</span>} />
        <DetailField
          label="Linked licence"
          value={
            license ? (
              <Link className="font-mono underline underline-offset-4" href={`/dashboard/licenses/${license.id}`}>
                {license.licenseKey}
              </Link>
            ) : undefined
          }
        />
        <DetailField
          label="Refund of"
          value={
            p.parentId ? (
              <Link className="font-mono underline underline-offset-4" href={`/dashboard/payments/${p.parentId}`}>
                {p.parentId.slice(0, 12)}…
              </Link>
            ) : undefined
          }
        />
      </DetailGrid>
    </div>
  )
}
