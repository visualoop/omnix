/**
 * /buy — entry from the desktop app's "Buy now" button.
 *
 * ?machine=<fingerprint>&module=<dawa|retail|hardware|hospitality>&variant=<…>
 *
 * Resolves the customer's session + existing licence, redirects to the
 * specific /buy/[licenseId] checkout. Pure Better Auth + Drizzle.
 */
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses } from '@/db'
import { decideBuyDestination, isValidMachineId, resolvePublicVariant } from '@/lib/buy-resolver'
import { createId } from '@/lib/ids'

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

  if (isValidMachineId(machine)) {
    const c = await cookies()
    c.set('omnix-buy-machine', machine!, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 60,
      path: '/',
    })
  }

  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  const isCustomer = Boolean(session?.user?.id)
  const customerId = isCustomer ? (session!.user.id as string) : null

  // ── Legacy Pro handling (not publicly sold) ─────────────────────
  // Pro is preserved for existing licence rows + the desktop validator,
  // but it is not on the public catalogue. An existing Pro owner still
  // reaches their /buy/[licenseId] paused-notice screen; anyone else who
  // asks for Pro is routed into the flagship public product rather than
  // minting a fresh Pro trial that would dead-end at checkout.
  if (variant === 'pro') {
    if (isCustomer && customerId) {
      const rows = await db
        .select({ id: licenses.id })
        .from(licenses)
        .where(and(eq(licenses.userId, customerId), eq(licenses.variant, 'pro')))
        .orderBy(desc(licenses.createdAt))
        .limit(1)
      const existingProLicenseId = rows[0]?.id ?? null
      if (existingProLicenseId) redirect(`/buy/${existingProLicenseId}`)
      redirect('/buy?variant=dawa')
    }
    redirect(`/login?next=${encodeURIComponent('/buy?variant=dawa')}`)
  }

  // Constrain every public request to one of the five catalogue products.
  const requestedVariant = resolvePublicVariant(variant, mod)

  let existingLicenseId: string | null = null
  if (isCustomer && customerId) {
    const rows = await db
      .select({ id: licenses.id })
      .from(licenses)
      .where(and(eq(licenses.userId, customerId), eq(licenses.variant, requestedVariant)))
      .orderBy(desc(licenses.createdAt))
      .limit(1)
    existingLicenseId = rows[0]?.id ?? null
  }

  const decision = decideBuyDestination({
    isCustomer,
    existingLicenseId,
    machine,
    module: mod,
    variant: requestedVariant,
  })

  if (decision.kind === 'signup') {
    redirect(`/login?next=${encodeURIComponent(decision.next)}`)
  }
  if (decision.kind === 'checkout') {
    redirect(`/buy/${decision.licenseId}`)
  }

  // Issue a fresh trial licence for first-time buyer.
  const newId = createId()
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  await db.insert(licenses).values({
    id: newId,
    userId: customerId!,
    licenseKey: `OMX-${decision.variant.toUpperCase()}-${newId.slice(0, 4).toUpperCase()}-${newId.slice(4, 8).toUpperCase()}-${newId.slice(8, 12).toUpperCase()}`,
    variant: decision.variant,
    tier: 'trial',
    status: 'trial',
    modules: decision.modules,
    maxBranches: 5,
    maxMachines: 10,
    trialStartedAt: now,
    trialEndsAt: trialEnd,
  })
  redirect(`/buy/${newId}`)
}
