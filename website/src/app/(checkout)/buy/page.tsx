/**
 * /buy — entry point from the desktop app's "Buy now" button.
 *
 * Receives ?machine=<fingerprint>&module=<dawa|retail|hardware|hospitality>
 *          &variant=<pro|dawa|retail|hospitality|hardware>
 * and resolves the customer's license to send them to /buy/[licenseId].
 *
 * Decision logic lives in src/lib/buy-resolver.ts (unit-tested).
 */
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { decideBuyDestination, isValidMachineId } from '@/lib/buy-resolver'

export const metadata = { title: 'Buy Omnix' }

interface SearchParams {
  machine?: string
  module?: string
  variant?: string
}

export default async function BuyEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { machine, module: mod, variant } = await searchParams
  const reqHeaders = await headers()

  // Stash the machine fingerprint for /buy/success → licence binding.
  if (isValidMachineId(machine)) {
    const c = await cookies()
    c.set('omnix-buy-machine', machine!, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 60,
      path: '/',
    })
  }

  const payload = await getPayload({ config: await config })

  // Resolve auth — failures bubble up as "not signed in" instead of 500.
  type Authed = { id?: string | number; collection?: string }
  let user: Authed | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = (result.user ?? null) as Authed | null
  } catch (err) {
    console.error('[buy] auth error:', err)
    user = null
  }
  const isCustomer = Boolean(user && user.collection === 'customers' && user.id != null)
  const customerId: string | number | null = isCustomer ? (user!.id as string | number) : null

  // Look up an existing licence for a signed-in customer (defensive — if the
  // query fails we treat it as "no licence yet" and fall through to create).
  let existingLicenseId: string | number | null = null
  if (isCustomer) {
    try {
      const result = await payload.find({
        collection: 'licenses',
        where: { customer: { equals: customerId! } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
      })
      existingLicenseId = (result.docs[0] as { id?: string | number } | undefined)?.id ?? null
    } catch (err) {
      console.error('[buy] license lookup failed:', err)
    }
  }

  const decision = decideBuyDestination({ isCustomer, existingLicenseId, machine, module: mod, variant })

  if (decision.kind === 'signup') {
    redirect(`/signup?next=${encodeURIComponent(decision.next)}`)
  }
  if (decision.kind === 'checkout') {
    redirect(`/buy/${decision.licenseId}`)
  }

  // create-then-checkout — also defensive so a transient DB error redirects
  // to the dashboard instead of 500ing the page.
  try {
    const created = (await payload.create({
      collection: 'licenses',
      data: {
        customer: customerId! as never,
        tier: 'trial',
        variant: decision.variant as never,
        modules: decision.modules,
        status: 'trial',
        maxBranches: 5,
        maxMachines: 10,
      },
      overrideAccess: true,
    })) as { id: string | number }
    redirect(`/buy/${created.id}`)
  } catch (err) {
    // redirect() throws by design — re-throw so Next handles it.
    if (err && typeof err === 'object' && 'digest' in err) throw err
    console.error('[buy] license create failed:', err)
    redirect('/dashboard?welcome=1')
  }
}
