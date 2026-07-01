/**
 * /dashboard/reseller/new — form the reseller fills to issue a
 * new licence for a customer. Wholesale checkout: reseller pays via
 * Paystack at (retail × (1 − discount%)) using their reseller
 * discount. On success the customer gets an active licence and the
 * reseller's ledger accrues commission.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, resellers } from '@/db'
import { pricingFor, type SupportedCurrency } from '@/config/pricing'
import { CURRENCIES } from '@/lib/currency'
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
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Issue a licence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the customer&rsquo;s details. You&rsquo;ll pay <strong>{symbol} {wholesale.toLocaleString()}</strong> at
          wholesale ({reseller.discountPercent}% off retail of {symbol} {retail.toLocaleString()}). On success the
          customer gets an active licence emailed to them, and your commission is credited.
        </p>
      </div>

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
