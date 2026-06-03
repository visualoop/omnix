/**
 * /buy — entry point from the desktop app's "Buy now" button.
 *
 * Receives ?machine=<fingerprint>&module=<dawa|retail|hardware|hospitality>
 * and resolves the customer's license to send them to /buy/[licenseId].
 *
 *  Flow:
 *    1. Not signed in → redirect to /signup?next=/buy?machine=…&module=…
 *    2. Signed in + has a license → /buy/[licenseId]
 *    3. Signed in + no license  → auto-issue trial license, /buy/[licenseId]
 *
 *  The machine fingerprint is stored in a short-lived cookie so the success
 *  page (after Paystack returns) can pre-bind the licence to that device.
 */
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const metadata = { title: 'Buy Omnix' }

interface SearchParams {
  machine?: string
  module?: string
}

export default async function BuyEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { machine, module: mod } = await searchParams
  const reqHeaders = await headers()

  // Stash the machine fingerprint for /buy/success → license activation
  // (httpOnly so JS can't tamper, 30 min cookie).
  if (machine && /^[A-Z0-9-]{8,128}$/i.test(machine)) {
    const c = await cookies()
    c.set('omnix-buy-machine', machine, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 60,
      path: '/',
    })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })

  // Anonymous → signup with full continue path
  if (!user || user.collection !== 'customers') {
    const next = `/buy${
      machine || mod
        ? `?${new URLSearchParams({
            ...(machine ? { machine } : {}),
            ...(mod ? { module: mod } : {}),
          }).toString()}`
        : ''
    }`
    redirect(`/signup?next=${encodeURIComponent(next)}`)
  }

  // Find an existing license for this customer
  const result = await payload.find({
    collection: 'licenses',
    where: { customer: { equals: user.id } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })
  const existing = result.docs[0] as unknown as { id: string | number } | undefined

  if (existing) {
    redirect(`/buy/${existing.id}`)
  }

  // No license yet — auto-issue a trial seat (the customer signup hook
  // usually does this, but if for some reason it didn't, do it here).
  const created = (await payload.create({
    collection: 'licenses',
    data: {
      customer: user.id as never,
      tier: 'trial',
      modules: mod ? ['core', mod] : ['core', 'dawa', 'retail'],
      status: 'trial',
      maxBranches: 5,
      maxMachines: 10,
    },
    overrideAccess: true,
  })) as unknown as { id: string | number }

  redirect(`/buy/${created.id}`)
}
