/**
 * /api/licensing/activate — desktop activation handler.
 *
 * Multi-licence per machine. A single physical PC can hold many active
 * licences (Dawa + Retail + Hospitality) as long as the variant-conflict
 * rules below are honoured.
 *
 * Eight gates run in order. The first to fail returns that gate's error
 * code so the desktop knows exactly what to do next:
 *
 *   1. 404 unknown_key                  — key not in our DB
 *   2. 403 not_your_key                 — key exists but owned by a
 *                                         different account (email
 *                                         check; no session token)
 *   2.5. 409 variant_mismatch           — licence variant ≠ binary
 *                                         variant (e.g. Hospitality
 *                                         key in the Retail installer).
 *                                         Pro is a wildcard.
 *   3. 409 cross_user_conflict          — already activated under a
 *                                         different account on this PC
 *   4. 409 machine_owned_by_another     — this PC is claimed by a
 *                                         different user account
 *   5. 409 variant_conflict_on_machine  — Pro vs trade clash on this PC
 *   6. 402 seat_exhausted               — licence has no seats left
 *   7. revoked / suspended status       — short-circuits with 403
 *
 * Idempotent re-activation: same key + same machineId returns a new
 * authToken and refreshes the activation row without consuming a seat.
 */
import { and, eq, count, isNull, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, licenses, machines, activations, user } from '@/db'
import { createId } from '@/lib/ids'
import { effectiveModules } from '@/lib/license-modules'

export const dynamic = 'force-dynamic'

interface ActivateInput {
  licenseKey: string
  machineId: string
  /** Owning email — required for the cross-account guard. The desktop
   *  passes the email the customer used at sign-up. We compare it to
   *  the licence owner's email at gate 2. */
  email?: string
  variant?: string
  hostname?: string
  os?: string
  osVersion?: string
  arch?: string
  currentVersion?: string
}

type ResultCode =
  | 'ok'
  | 'reactivated'
  | 'unknown_key'
  | 'not_your_key'
  | 'cross_user_conflict'
  | 'machine_owned_by_another'
  | 'variant_conflict_on_machine'
  | 'variant_mismatch'
  | 'seat_exhausted'
  | 'revoked'
  | 'suspended'

/** Variant types that conflict on the same physical machine. Pro covers
 *  every trade so Pro + trade (in either direction) is rejected. Two
 *  of the same trade variant on one machine is also rejected. */
export function isVariantConflict(existing: string, incoming: string): boolean {
  if (existing === incoming) return true
  if (existing === 'pro' || incoming === 'pro') return true
  return false
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ActivateInput | null
  if (!body?.licenseKey || !body.machineId) {
    return Response.json({ ok: false, code: 'bad_request', error: 'licenseKey + machineId required' }, { status: 400 })
  }

  // ── Gate 1: licence exists ──────────────────────────────────────
  const lic = (
    await db.select().from(licenses).where(eq(licenses.licenseKey, body.licenseKey)).limit(1)
  )[0]
  if (!lic) {
    return reject('unknown_key', 404, 'Licence not recognised. Check the key or contact support.')
  }

  // One-time backfill: older licence rows (created before the `modules`
  // jsonb column was wired through every code path) ended up with an
  // empty array, which made the desktop fall back to `["core"]` and
  // gate every trade page as "Retail isn't on your licence". Repair on
  // first activation so subsequent revalidations see the correct list.
  if (Array.isArray(lic.modules) && lic.modules.length === 0) {
    const derived = effectiveModules(lic)
    if (derived.length > 0) {
      lic.modules = derived
      await db.update(licenses).set({ modules: derived, updatedAt: new Date() }).where(eq(licenses.id, lic.id))
    }
  }

  // ── Gate 7 (short-circuit): status ──────────────────────────────
  if (lic.status === 'revoked') return reject('revoked', 403, 'This licence has been revoked.')
  if (lic.status === 'suspended') return reject('suspended', 403, 'This licence is suspended. Contact support.')

  // ── Gate 2: caller claims to own it (email match) ───────────────
  if (body.email) {
    const owner = (
      await db.select({ email: user.email }).from(user).where(eq(user.id, lic.userId)).limit(1)
    )[0]
    if (owner?.email && owner.email.toLowerCase() !== body.email.toLowerCase()) {
      return reject(
        'not_your_key',
        403,
        'This licence belongs to a different account. Sign in to omnix.co.ke as the licence owner.',
      )
    }
  }

  // ── Gate 2.5: variant_mismatch ─────────────────────────────────
  // The installer self-identifies its variant (body.variant). The
  // licence has its own variant. Activation must reject when they
  // disagree — otherwise a Hospitality trial key would activate the
  // Retail binary, which is the same kind of cross-product abuse this
  // gate prevents.
  //
  // Exception: a Pro licence is a wildcard. It can activate ANY trade
  // binary (Dawa, Retail, Hardware, Hospitality) because Pro
  // entitlements include every module. The reverse is NOT true —
  // a trade licence (e.g. Retail) cannot activate the Pro binary, since
  // that would unlock modules the user never paid for.
  if (body.variant) {
    const requested = body.variant.toLowerCase()
    const owned = lic.variant.toLowerCase()
    const VALID_VARIANTS = ['pro', 'dawa', 'retail', 'hardware', 'hospitality'] as const
    const mismatch =
      VALID_VARIANTS.includes(requested as (typeof VALID_VARIANTS)[number]) &&
      owned !== requested &&
      owned !== 'pro' // Pro is a wildcard
    if (mismatch) {
      return reject(
        'variant_mismatch',
        409,
        `This licence is for Omnix ${owned.toUpperCase()}. The installer you're running is for Omnix ${requested.toUpperCase()}. ` +
          `Download the ${owned.toUpperCase()} installer from /dashboard/downloads, or use a ${requested.toUpperCase()} key for this binary.`,
      )
    }
  }

  // Existing machine row by fingerprint
  const existingMachine = (
    await db.select().from(machines).where(eq(machines.machineId, body.machineId)).limit(1)
  )[0]

  // ── Gate 3 + 4: cross-user / machine-owned-by-another ──────────
  if (existingMachine && existingMachine.userId && existingMachine.userId !== lic.userId) {
    return reject(
      'machine_owned_by_another',
      409,
      'This computer is registered to a different Omnix account. Release it from that dashboard before activating a new licence.',
    )
  }

  // ── Gate 5: variant conflict on this machine ───────────────────
  if (existingMachine) {
    const otherActives = await db
      .select({ variant: licenses.variant, licenseId: licenses.id })
      .from(activations)
      .innerJoin(licenses, eq(activations.licenseId, licenses.id))
      .where(eq(activations.machineId, existingMachine.id))

    for (const row of otherActives) {
      if (row.licenseId === lic.id) continue // same licence — idempotent path below
      if (isVariantConflict(row.variant, lic.variant)) {
        return reject(
          'variant_conflict_on_machine',
          409,
          `This computer already runs Omnix ${row.variant.toUpperCase()}. ${
            lic.variant === 'pro' || row.variant === 'pro'
              ? 'Pro and trade variants cannot coexist on the same machine.'
              : 'You cannot install two of the same trade variant on one machine.'
          }`,
        )
      }
    }
  }

  // Idempotent re-activation — same key + same machine.
  if (existingMachine) {
    const sameLicense = await db
      .select({ id: activations.id })
      .from(activations)
      .where(and(eq(activations.licenseId, lic.id), eq(activations.machineId, existingMachine.id)))
      .limit(1)
    if (sameLicense[0]) {
      const { authToken, tokenHash } = mintToken()
      await db
        .update(machines)
        .set({
          authTokenHash: tokenHash,
          hostname: body.hostname ?? existingMachine.hostname,
          os: body.os ?? existingMachine.os,
          osVersion: body.osVersion ?? existingMachine.osVersion,
          arch: body.arch ?? existingMachine.arch,
          currentVersion: body.currentVersion ?? existingMachine.currentVersion,
          activeModule: body.variant ?? existingMachine.activeModule,
          status: 'active',
          lastSeenAt: new Date(),
        })
        .where(eq(machines.id, existingMachine.id))
      return camelOK({ lic, authToken, action: 'reactivated', code: 'reactivated' })
    }
  }

  // ── Gate 6: seat capacity for THIS licence ─────────────────────
  // Auto-heal: drop any orphan activations (machineId IS NULL) for
  // this licence. These leak in when a machine row is hard-deleted
  // (activations.machine_id is ON DELETE SET NULL). We don't count
  // them in the seat-cap calculation below, but cleaning them up keeps
  // the activation history sane + speeds up future joins.
  await db
    .delete(activations)
    .where(and(eq(activations.licenseId, lic.id), isNull(activations.machineId)))
    .catch(() => {
      // Best-effort cleanup. Don't fail activation if the delete errors.
    })

  // Count only activations bound to a real, non-revoked machine. The
  // current machine (existingMachine) is also excluded — re-activating
  // on the same machine is idempotent and must never consume a seat.
  const seatCount = await db
    .select({ n: count() })
    .from(activations)
    .innerJoin(machines, eq(machines.id, activations.machineId))
    .where(
      and(
        eq(activations.licenseId, lic.id),
        sql`${machines.status} != 'revoked'`,
        existingMachine ? sql`${machines.id} != ${existingMachine.id}` : sql`true`,
      ),
    )
  const used = Number(seatCount[0]?.n ?? 0)
  if (used >= lic.maxMachines) {
    return reject(
      'seat_exhausted',
      402,
      `All ${lic.maxMachines} seats are in use. Release one from /dashboard/machines first.`,
    )
  }

  // All gates passed. Register / reuse the machine row + record the
  // activation in the join table. The (license_id, machine_id) unique
  // index added in migration 0003 makes this idempotent.
  let machineRowId = existingMachine?.id
  const { authToken, tokenHash } = mintToken()
  const now = new Date()
  if (!machineRowId) {
    machineRowId = createId()
    await db.insert(machines).values({
      id: machineRowId,
      userId: lic.userId,
      organizationId: lic.organizationId,
      licenseId: lic.id, // primary — first licence activated on this PC
      machineId: body.machineId,
      authTokenHash: tokenHash,
      hostname: body.hostname,
      os: body.os ?? 'windows',
      osVersion: body.osVersion,
      arch: body.arch,
      currentVersion: body.currentVersion,
      activeModule: body.variant,
      status: 'active',
      firstSeenAt: now,
      lastSeenAt: now,
    })
  } else {
    await db
      .update(machines)
      .set({
        authTokenHash: tokenHash,
        currentVersion: body.currentVersion ?? existingMachine?.currentVersion,
        activeModule: body.variant ?? existingMachine?.activeModule,
        status: 'active',
        lastSeenAt: now,
      })
      .where(eq(machines.id, machineRowId))
  }

  await db
    .insert(activations)
    .values({
      id: createId(),
      licenseId: lic.id,
      machineId: machineRowId,
      outcome: 'ok',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      metadata: { fingerprint: body.machineId },
    })
    .onConflictDoNothing()

  return camelOK({ lic, authToken, action: 'activated', code: 'ok' })
}

// ─── helpers ──────────────────────────────────────────────────────

function reject(code: ResultCode, status: number, message: string) {
  return Response.json({ ok: false, code, error: message }, { status })
}

function mintToken() {
  const authToken = crypto.randomBytes(24).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(authToken).digest('hex')
  return { authToken, tokenHash }
}

function camelOK({
  lic,
  authToken,
  action,
  code,
}: {
  lic: typeof licenses.$inferSelect
  authToken: string
  action: string
  code: ResultCode
}) {
  return Response.json({
    ok: true,
    code,
    authToken,
    action,
    entitlements: {
      modules: effectiveModules(lic),
      maxDevices: lic.maxMachines,
      maxBranches: lic.maxBranches,
      maintenanceUntil: lic.maintenanceUntil?.toISOString() ?? null,
      trialEndsAt: lic.trialEndsAt?.toISOString() ?? null,
      majorVersionCap: lic.majorVersionCap,
      status: lic.status,
      variant: lic.variant,
      licenseKey: lic.licenseKey,
    },
  })
}

// Stub to silence the linter about `sql` import — kept around in case
// the route later needs a raw fragment.
const _ = sql
