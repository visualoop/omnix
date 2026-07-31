import { headers, cookies } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses, payments } from '@/db'
import { newReference, initTransaction } from '@/lib/paystack'
import { pricingFor } from '@/config/pricing'
import { checkoutSettlementPreflight, isDisplayCurrency } from '@/lib/currency'
import { createId } from '@/lib/ids'
import { getSetting } from '@/lib/platform-settings'
import { isPublicVariant } from '@/lib/buy-resolver'

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

  // Public catalogue guard. A first purchase (`license_fee`) may only be
  // taken for one of the five publicly-sold products. The legacy `pro`
  // variant is not on sale, so a crafted init for a Pro trial's licence
  // fee is rejected server-side even though its row still exists. Other
  // purposes (renewals/add-ons) stay open for existing paid licences so
  // the legacy contract is preserved.
  if (body.purpose === 'license_fee' && !isPublicVariant(lic.variant)) {
    return Response.json({ error: 'variant not available for purchase' }, { status: 403 })
  }

  // The licence currency is the market's display currency, not permission to
  // charge that ISO code. Run the same preflight as the order-review UI and
  // never convert, relabel, or create a provider transaction for an unsupported
  // display/settlement pair.
  const storedDisplayCurrency = lic.currency ?? session.user.currency ?? 'KES'
  if (!isDisplayCurrency(storedDisplayCurrency)) {
    return Response.json(
      {
        code: 'unsupported_display_currency',
        error: `the licence display currency ${storedDisplayCurrency} requires manual review before payment`,
        displayCurrency: storedDisplayCurrency,
        settlementCurrency: null,
      },
      { status: 409 },
    )
  }

  const preflight = checkoutSettlementPreflight(storedDisplayCurrency)
  if (preflight.kind === 'manual') {
    return Response.json(
      {
        code: 'manual_settlement_required',
        error: `online settlement is not available in ${preflight.displayCurrency}; contact Omnix before payment`,
        displayCurrency: preflight.displayCurrency,
        settlementCurrency: null,
      },
      { status: 409 },
    )
  }

  const settlementCurrency = preflight.settlementCurrency
  const p = pricingFor(settlementCurrency)
  const amount = computeAmount(body.purpose, lic.variant, p)
  if (amount <= 0) return Response.json({ error: 'no amount due' }, { status: 400 })

  const reference = newReference('OMX')
  // Attach affiliate ref code if the visitor's browser set one via ?ref=CODE.
  const refCode = (await cookies()).get('omnix_ref')?.value ?? null

  const init = await initTransaction({
    email: session.user.email,
    amountSmallestUnit: amount * 100,
    currency: settlementCurrency,
    reference,
    metadata: {
      license_id: lic.id,
      user_id: session.user.id,
      purpose: body.purpose,
      ...(refCode ? { ref_code: refCode } : {}),
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
    currency: settlementCurrency,
    status: 'pending',
    metadata: refCode ? { refCode } : null,
  })

  const publicKey = (await getSetting('paystack.public_key')) ?? ''
  return Response.json({
    reference,
    settlementAmount: amount * 100,
    settlementCurrency,
    displayCurrency: storedDisplayCurrency,
    email: session.user.email,
    publicKey,
    accessCode: init.accessCode,
  })
}

function computeAmount(
  purpose: InitInput['purpose'],
  variant: string,
  p: ReturnType<typeof pricingFor>,
): number {
  // Pro variant pays the business price (KES 150k); every other variant
  // (dawa / retail / hospitality / hardware) pays the starter price
  // (KES 30k). Tier is a state flag (trial / starter / business) and
  // does not drive pricing.
  const isPro = variant === 'pro'
  switch (purpose) {
    case 'license_fee':
      return isPro ? p.business.oneTimeFee : p.starter.oneTimeFee
    case 'maintenance_renewal':
      return isPro ? p.business.maintenanceYearly : p.starter.maintenanceYearly
    case 'major_upgrade': {
      const fee = isPro ? p.business.oneTimeFee : p.starter.oneTimeFee
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
