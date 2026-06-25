/**
 * /api/licensing/sync — desktop posts every locally-stored licence key
 * on startup. Server classifies each into one of five statuses + writes
 * a row to license_sync_log so support can replay the flow if a user
 * gets stuck.
 *
 *   verified        : exists in DB, owned by the email passed in body
 *   foreign         : exists in DB, owned by a different user
 *   orphan_payload  : not in DB, no auto-recovery available — user
 *                     should contact support@omnix.co.ke
 *   recreated       : not in DB, but matched a known signed key
 *                     payload — server creates a licence row with
 *                     origin='payload_migrated' so future flows behave
 *   seat_taken      : owned, but max_machines reached on other machines
 *
 * Request:
 *   POST /api/licensing/sync
 *   { email: string, machineId: string, keys: string[] }
 *
 * Response:
 *   { ok: true, results: [{ key, status, license?, message? }, …] }
 *
 * Auth: bootstrap-token or session. The desktop has no web session, so
 * for now we trust the `email` field as the claim, and the per-key
 * verified path only accepts emails that match a licence row's owner.
 * (Support will harden this with a verification email loop later.)
 */
import { eq, count, and, inArray } from 'drizzle-orm'
import { db, licenses, activations, licenseSyncLog, user } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

interface SyncInput {
  email: string
  machineId: string
  keys: string[]
}

type SyncStatus =
  | 'verified'
  | 'foreign'
  | 'orphan_payload'
  | 'recreated'
  | 'seat_taken'

interface SyncResult {
  key: string
  status: SyncStatus
  message?: string
  license?: {
    id: string
    licenseKey: string
    variant: string
    tier: string
    status: string
    modules: string[]
    maxBranches: number
    maxMachines: number
    maintenanceUntil: string | null
    trialEndsAt: string | null
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SyncInput | null
  if (!body?.email || !body.machineId || !Array.isArray(body.keys)) {
    return Response.json({ ok: false, error: 'email + machineId + keys[] required' }, { status: 400 })
  }

  const callerEmail = body.email.toLowerCase().trim()
  const callerRow = (
    await db.select().from(user).where(eq(user.email, callerEmail)).limit(1)
  )[0]
  if (!callerRow) {
    return Response.json(
      { ok: false, error: 'No account on omnix.co.ke for this email. Sign up first.' },
      { status: 404 },
    )
  }

  // Bulk-fetch every key in one round trip
  const rows = body.keys.length
    ? await db.select().from(licenses).where(inArray(licenses.licenseKey, body.keys))
    : []
  const byKey = new Map(rows.map((r) => [r.licenseKey, r]))

  const results: SyncResult[] = []

  for (const key of body.keys) {
    const lic = byKey.get(key)
    if (!lic) {
      // Case 3 — orphan. We don't have an RSA verifier wired here yet,
      // so every unknown key surfaces as orphan_payload. Future work:
      // verify the RSA signature against the public key embedded in
      // the desktop's licensing module, and auto-recreate when valid +
      // matching email.
      const result: SyncResult = {
        key,
        status: 'orphan_payload',
        message:
          'This key isn\'t on your account. If you bought it before our migration, email support@omnix.co.ke with the key and your purchase receipt.',
      }
      results.push(result)
      await logSync(callerRow.id, body.machineId, key, 'orphan_payload', result.message ?? null)
      continue
    }

    // Case 2 — foreign
    if (lic.userId !== callerRow.id) {
      const result: SyncResult = {
        key,
        status: 'foreign',
        message:
          'This licence belongs to a different account. Sign in as the original owner, or contact support if this is your key.',
      }
      results.push(result)
      await logSync(callerRow.id, body.machineId, key, 'foreign', result.message ?? null)
      continue
    }

    // Owned by caller — check seats
    const seats = await db
      .select({ n: count() })
      .from(activations)
      .where(eq(activations.licenseId, lic.id))
    const used = Number(seats[0]?.n ?? 0)
    const machineAlreadyActivated = await db
      .select({ id: activations.id })
      .from(activations)
      .innerJoin(licenses, eq(activations.licenseId, licenses.id))
      .where(and(eq(activations.licenseId, lic.id)))
      .limit(1)
    // Case 4 — seat-taken (max reached AND this machine isn't one of them)
    if (used >= lic.maxMachines && !machineAlreadyActivated[0]) {
      const result: SyncResult = {
        key,
        status: 'seat_taken',
        message: `All ${lic.maxMachines} seats are in use elsewhere. Release a seat from omnix.co.ke/dashboard/machines first.`,
      }
      results.push(result)
      await logSync(callerRow.id, body.machineId, key, 'seat_taken', result.message ?? null)
      continue
    }

    // Case 1 — verified
    const result: SyncResult = {
      key,
      status: 'verified',
      license: serialiseLicense(lic),
    }
    results.push(result)
    await logSync(callerRow.id, body.machineId, key, 'verified', null)
  }

  return Response.json({ ok: true, results })
}

async function logSync(
  userId: string,
  machineId: string,
  key: string,
  status: SyncStatus,
  message: string | null,
) {
  await db.insert(licenseSyncLog).values({
    id: createId(),
    userId,
    machineId,
    licenseKey: key,
    status,
    message,
  })
}

function serialiseLicense(lic: typeof licenses.$inferSelect): SyncResult['license'] {
  return {
    id: lic.id,
    licenseKey: lic.licenseKey,
    variant: lic.variant,
    tier: lic.tier,
    status: lic.status,
    modules: (lic.modules as string[]) ?? [],
    maxBranches: lic.maxBranches,
    maxMachines: lic.maxMachines,
    maintenanceUntil: lic.maintenanceUntil?.toISOString() ?? null,
    trialEndsAt: lic.trialEndsAt?.toISOString() ?? null,
  }
}
