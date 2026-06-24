import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db, payments, licenses } from '@/db'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { formatDate } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login')

  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, session.user.id)))
    .limit(1)
  const p = rows[0]
  if (!p) notFound()

  const license = p.licenseId ? await db.query.licenses.findFirst({ where: eq(licenses.id, p.licenseId) }) : null
  const fmt = new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Payments', href: '/dashboard/payments' }, { label: p.paystackReference }]} />
      <BackButton fallback="/dashboard/payments" label="Back to payments" />
      <EntityHero
        eyebrow="Payment"
        title={p.paystackReference}
        subtitle={p.purpose}
        badges={[
          {
            label: p.status,
            variant: p.status === 'success' ? 'default' : p.status === 'failed' || p.status === 'reversed' ? 'destructive' : 'secondary',
          },
        ]}
        stats={[
          { label: 'Amount', value: fmt },
          { label: 'Currency', value: p.currency },
          { label: 'Initiated', value: formatDate(p.createdAt, true) },
          { label: 'Paid at', value: formatDate(p.paidAt, true) },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Reference" value={<span className="font-mono">{p.paystackReference}</span>} />
        <Field label="Purpose" value={p.purpose} />
        <Field label="Linked licence" value={license ? <Link className="underline font-mono" href={`/dashboard/licenses/${license.id}`}>{license.licenseKey}</Link> : null} />
        <Field label="Refund of" value={p.parentId ? <Link className="underline font-mono" href={`/dashboard/payments/${p.parentId}`}>{p.parentId.slice(0, 12)}…</Link> : null} />
      </div>
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  )
}
