import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, payments, user, organization, licenses } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminPaymentDetailPage({ params }: PageProps) {
  const { id } = await params
  const p = await db.query.payments.findFirst({ where: eq(payments.id, id) })
  if (!p) notFound()

  const [payer, org, license] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, p.userId) }),
    p.organizationId ? db.query.organization.findFirst({ where: eq(organization.id, p.organizationId) }) : null,
    p.licenseId ? db.query.licenses.findFirst({ where: eq(licenses.id, p.licenseId) }) : null,
  ])

  const fmt = new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Payments', href: '/admin/payments' }, { label: p.paystackReference }]} />
      <BackButton fallback="/admin/payments" label="Back to payments" />
      <EntityHero
        eyebrow="Payment"
        title={p.paystackReference}
        subtitle={
          <>
            {p.purpose}
            {payer && <> · <Link className="underline" href={`/admin/users/${payer.id}`}>{payer.name}</Link></>}
            {org && <> @ <Link className="underline" href={`/admin/orgs/${org.id}`}>{org.name}</Link></>}
          </>
        }
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
          { label: 'Paid at', value: p.paidAt ? formatDate(p.paidAt, true) : '—' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Paystack reference" value={<span className="font-mono">{p.paystackReference}</span>} />
        <Field label="Purpose" value={p.purpose} />
        <Field label="License" value={license ? <Link className="underline font-mono" href={`/admin/licenses/${license.id}`}>{license.licenseKey}</Link> : null} />
        <Field label="Refund of" value={p.parentId ? <Link className="underline font-mono" href={`/admin/payments/${p.parentId}`}>{p.parentId.slice(0, 8)}…</Link> : null} />
      </div>

      {p.metadata != null && (
        <details className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Metadata
          </summary>
          <pre className="mt-3 text-[11px] text-foreground/80 whitespace-pre-wrap break-all">
            {JSON.stringify(p.metadata, null, 2)}
          </pre>
        </details>
      )}
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
