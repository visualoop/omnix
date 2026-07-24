/**
 * /dashboard/affiliate — self-service affiliate dashboard.
 *
 * If the user has no affiliate row → shows a signup CTA. On submit, POSTs
 * to /api/affiliate and reloads. If they're already signed up → shows their
 * ref code, referral URL (copy button), rolling totals, and their recent
 * credit ledger. Anti-fraud (self-referral, repeat) is enforced server-side
 * when credits are written; this page only renders the outcome.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, affiliates, affiliateCredits } from '@/db'
import { PageHeader } from '@/components/layout/page-header'
import { AffiliateClient } from './affiliate-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Affiliate · Omnix' }

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnix.co.ke'

export default async function AffiliateDashboardPage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/affiliate')

  const [aff] = await db.select().from(affiliates).where(eq(affiliates.userId, session.user.id)).limit(1)
  const credits = aff
    ? await db
        .select()
        .from(affiliateCredits)
        .where(eq(affiliateCredits.affiliateId, aff.id))
        .orderBy(desc(affiliateCredits.createdAt))
        .limit(20)
    : []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Partner programs"
        title="Affiliate program"
        description="Refer a business to Omnix. When they pay for a licence, you earn a commission on their first purchase — capped, with no compounding on renewals."
      />

      <AffiliateClient
        initialAffiliate={aff ?? null}
        referralUrl={aff ? `${BASE_URL}/?ref=${aff.refCode}` : ''}
        credits={credits.map((c) => ({
          id: c.id,
          gross: c.grossAmount,
          commission: c.commissionAmount,
          currency: c.currency,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
