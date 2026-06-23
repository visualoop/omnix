import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses, payments } from '@/db'
import { newReference, initTransaction } from '@/lib/paystack'
import { pricingFor, type SupportedCurrency } from '@/config/pricing'
import { createId } from '@/lib/ids'
import { getSetting } from '@/lib/platform-settings'

interface InitInput {
  licenseId: string
  purpose: 'license_fee' | 'maintenance_renewal' | 'major_upgrade' | 'cloud_backup' | 'extra_branch' | 'extra_machine'
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as InitInput | null
  if (!body?.licenseId || !body.purpose) {
    return Response.json({ error: 'licenseId and purpose required' }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, body.licenseId), eq(licenses.userId, session.user.id)))
    .limit(1)
  const lic = rows[0]
  if (!lic) return Response.json({ error: 'licence not found' }, { status: 404 })

  // Compute amount in smallest currency unit (cents/kobo).
  const currency = (lic.currency as SupportedCurrency) ?? 'KES'
  const p = pricingFor(currency)
  const amount = computeAmount(body.purpose, lic.tier, p)
  if (amount <= 0) return Response.json({ error: 'no amount due' }, { status: 400 })

  const reference = newReference('OMX')
  const init = await initTransaction({
    email: session.user.email,
    amountSmallestUnit: amount * 100,
    currency,
    reference,
    metadata: {
      license_id: lic.id,
      user_id: session.user.id,
      purpose: body.purpose,
    },
  })

  // Record the pending payment.
  await db.insert(payments).values({
    id: createId(),
    userId: session.user.id,
    organizationId: lic.organizationId,
    licenseId: lic.id,
    paystackReference: reference,
    purpose: body.purpose,
    amount,
    currency,
    status: 'pending',
  })

  const publicKey = (await getSetting('paystack.public_key')) ?? ''
  return Response.json({
    reference,
    amount: amount * 100,
    currency,
    email: session.user.email,
    publicKey,
    accessCode: init.accessCode,
  })
}

function computeAmount(
  purpose: InitInput['purpose'],
  tier: string,
  p: ReturnType<typeof pricingFor>,
): number {
  switch (purpose) {
    case 'license_fee':
      return tier === 'business' ? p.business.oneTimeFee : p.starter.oneTimeFee
    case 'maintenance_renewal':
      return tier === 'business' ? p.business.maintenanceYearly : p.starter.maintenanceYearly
    case 'major_upgrade': {
      const fee = tier === 'business' ? p.business.oneTimeFee : p.starter.oneTimeFee
      return Math.round(fee * (1 - p.majorUpgradeDiscount / 100))
    }
    case 'cloud_backup':
      return p.cloudBackupMonthly
    case 'extra_branch':
      return p.extraBranchOneTime
    case 'extra_machine':
      return p.extraMachineOneTime
    default:
      return 0
  }
}
