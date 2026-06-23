import { headers } from 'next/headers'
import { eq, and, ne } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

const VARIANTS = ['pro', 'dawa', 'retail', 'hospitality', 'hardware'] as const
type Variant = (typeof VARIANTS)[number]

const TRIAL_DAYS = 30

/**
 * POST /api/dashboard/trial
 *
 * Body: { variant: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware' }
 *
 * Provisions a 30-day trial licence for the signed-in customer. If they
 * already have a non-lapsed licence for the same variant, returns that
 * existing licence rather than creating a duplicate. Otherwise mints a
 * new key formatted as TRIAL-XXXX-XXXX-XXXX-XXXX.
 *
 * Idempotent — can be called from the homepage CTA, the /pricing page,
 * or the dashboard "Start trial" wizard without risk of duplicates.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { variant?: Variant } | null
  const variant = (body?.variant ?? 'pro') as Variant
  if (!VARIANTS.includes(variant)) {
    return Response.json({ error: `variant must be one of ${VARIANTS.join('/')}` }, { status: 400 })
  }

  const existing = (await db
    .select()
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, session.user.id),
        eq(licenses.variant, variant),
        ne(licenses.status, 'lapsed'),
      ),
    )
    .limit(1))[0]

  if (existing) {
    return Response.json({
      ok: true,
      existed: true,
      license: {
        id: existing.id,
        licenseKey: existing.licenseKey,
        variant: existing.variant,
        status: existing.status,
        trialEndsAt: existing.trialEndsAt,
      },
    })
  }

  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const id = createId()
  const licenseKey = makeTrialKey()

  await db.insert(licenses).values({
    id,
    userId: session.user.id,
    licenseKey,
    variant,
    tier: 'trial',
    status: 'trial',
    modules: variant === 'pro' ? ['dawa', 'retail', 'hospitality', 'hardware'] : [variant],
    maxBranches: 1,
    maxMachines: 3,
    trialStartedAt: now,
    trialEndsAt,
    currency: session.user.currency ?? 'KES',
    metadata: { source: 'self-service-trial' },
  })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'license.trial_start',
    resource: `license:${id}`,
    metadata: { variant, trialEndsAt: trialEndsAt.toISOString() },
  })

  return Response.json({
    ok: true,
    existed: false,
    license: { id, licenseKey, variant, status: 'trial', trialEndsAt },
  })
}

function makeTrialKey(): string {
  // 4 groups of 4 base32-ish chars, prefixed with TRIAL.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groups: string[] = ['TRIAL']
  for (let i = 0; i < 4; i++) {
    let g = ''
    for (let j = 0; j < 4; j++) g += alphabet[Math.floor(Math.random() * alphabet.length)]
    groups.push(g)
  }
  return groups.join('-')
}
