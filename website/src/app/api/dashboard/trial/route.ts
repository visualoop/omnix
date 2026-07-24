import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

const VARIANTS = ['dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const
type Variant = (typeof VARIANTS)[number]

const TRIAL_DAYS = 30

/**
 * POST /api/dashboard/trial
 *
 * Body: { variant: 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon' }
 *
 * Provisions a 30-day trial licence for the signed-in customer. The five
 * public products are eligible; legacy Pro is deliberately excluded. A
 * current trial is returned idempotently, while a paid or previously-used
 * product cannot start another trial.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { variant?: Variant } | null
  const variant = (body?.variant ?? 'dawa') as Variant
  if (!VARIANTS.includes(variant)) {
    return Response.json({ error: `variant must be one of ${VARIANTS.join('/')}` }, { status: 400 })
  }

  const existing = (await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.userId, session.user.id), eq(licenses.variant, variant)))
    .limit(1))[0]

  if (existing?.status === 'trial') {
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

  if (existing) {
    return Response.json(
      { ok: false, error: 'A licence or prior trial already exists for this product.' },
      { status: 409 },
    )
  }

  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const id = createId()
  const licenseKey = makeLicenseKey(variant)

  await db.insert(licenses).values({
    id,
    userId: session.user.id,
    licenseKey,
    variant,
    tier: 'trial',
    status: 'trial',
    modules: [variant],
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

/**
 * Generate a license key in the format the desktop validator expects:
 *   OMNIX-<VARIANT>-XXXX-XXXX-XXXX
 *
 * Variant prefixes (from src/lib/variant.ts variantLicensePrefix):
 *   dawa        → OMNIX-DAWA
 *   retail      → OMNIX-RETAIL
 *   hospitality → OMNIX-HOSP
 *   hardware    → OMNIX-HW
 *
 * The key format is identical for trial and paid licences. The trial vs
 * active state is tracked in the `status` column. The desktop validator
 * accepts any well-formed OMNIX- key and asks the website for status.
 */
function makeLicenseKey(variant: Variant): string {
  const variantSuffix: Record<Variant, string> = {
    dawa: 'DAWA',
    retail: 'RETAIL',
    hospitality: 'HOSP',
    hardware: 'HW',
    salon: 'SALON',
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groups: string[] = []
  for (let i = 0; i < 3; i++) {
    let g = ''
    for (let j = 0; j < 4; j++) g += alphabet[Math.floor(Math.random() * alphabet.length)]
    groups.push(g)
  }
  return `OMNIX-${variantSuffix[variant]}-${groups.join('-')}`
}
