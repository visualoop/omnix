/**
 * /dashboard/reseller/new — form the reseller fills to issue a new licence
 * for a customer. Wholesale checkout: the reseller pays via Paystack at
 * (retail × (1 − discount%)); on success the customer gets an active
 * licence and the reseller's ledger accrues commission.
 *
 * Server-gated twice over: a session is required, and only an *active*
 * reseller reaches the form — non-resellers and suspended resellers are
 * redirected. Nav visibility is never the authorization boundary.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, resellers } from '@/db'
import { pricingFor, type SupportedCurrency } from '@/config/pricing'
import { CURRENCIES } from '@/lib/currency'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { PageHeader } from '@/components/layout/page-header'
import { IssueLicenseForm } from './issue-license-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Issue licence · Reseller' }

export default async function ResellerIssuePage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/reseller/new')

  const [reseller] = await db.select().from(resellers).where(eq(resellers.userId, session.user.id)).limit(1)
  if (!reseller) redirect('/dashboard')
  if (reseller.status !== 'active') redirect('/dashboard/reseller?notice=suspended')

  const currency = (reseller.commissionCurrency || 'KES') as SupportedCurrency
  const p = pricingFor(currency)
  const retail = p.starter.oneTimeFee
  const wholesale = Math.round(retail * (1 - reseller.discountPercent / 100))
  const symbol = CURRENCIES[currency]?.symbol ?? currency

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <Breadcrumbs items={[{ label: 'Reseller', href: '/dashboard/reseller' }, { label: 'Issue licence' }]} />
      <PageHeader
        eyebrow="Partner programs"
        title="Issue a licence"
        description={`Enter the customer's details. You'll pay ${symbol} ${wholesale.toLocaleString()} at wholesale (${reseller.discountPercent}% off retail of ${symbol} ${retail.toLocaleString()}). On success the customer gets an active licence emailed to them, and your commission is credited.`}
      />

      <IssueLicenseForm
        currency={currency}
        symbol={symbol}
        retail={retail}
        wholesale={wholesale}
        discountPercent={reseller.discountPercent}
      />
    </div>
  )
}
