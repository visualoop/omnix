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
  const { user } = await payload.auth({ headers: reqHeaders })
  const isCustomer = user?.collection === 'customers'

  // Look up an existing licence for a signed-in customer
  let existingLicenseId: string | number | null = null
  if (isCustomer) {
    const result = await payload.find({
      collection: 'licenses',
      where: { customer: { equals: user!.id } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })
    existingLicenseId = (result.docs[0] as { id?: string | number } | undefined)?.id ?? null
  }

  const decision = decideBuyDestination({ isCustomer, existingLicenseId, machine, module: mod, variant })

  if (decision.kind === 'signup') {
    redirect(`/signup?next=${encodeURIComponent(decision.next)}`)
  }
  if (decision.kind === 'checkout') {
    redirect(`/buy/${decision.licenseId}`)
  }

  // create-then-checkout
  const created = (await payload.create({
    collection: 'licenses',
    data: {
      customer: user!.id as never,
      tier: 'trial',
      variant: decision.variant as never,
      modules: decision.modules,
      status: 'trial',
      maxBranches: 5,
      maxMachines: 10,
    },
    overrideAccess: true,
  })) as unknown as { id: string | number }

  redirect(`/buy/${created.id}`)
}
