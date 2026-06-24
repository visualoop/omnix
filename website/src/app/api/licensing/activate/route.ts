import { and, eq, count, isNull, or } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, licenses, machines, activations } from '@/db'
import { createId } from '@/lib/ids'

/**
 * /api/licensing/activate — legacy desktop-compatible alias.
 *
 * The desktop binary (src/services/license.ts activateOnline) POSTs:
 *   { licenseKey, machineId, variant }
 *
 * The newer /api/licenses/activate route uses snake_case. Rather than
 * ship a new desktop build, this alias mirrors the same DB logic and
 * returns the camelCase shape the desktop already expects:
 *   { ok, authToken, action, entitlements: { modules, maxDevices, ... } }
 *
 * Once the desktop ships v0.10+ with snake_case migrated, this route
 * can be removed.
 */
export const dynamic = 'force-dynamic'

interface ActivateInput {
  licenseKey: string
  machineId: string
  variant?: string
  hostname?: string
  os?: string
  osVersion?: string
  arch?: string
  currentVersion?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ActivateInput | null
  if (!body?.licenseKey || !body.machineId) {
    return Response.json({ ok: false, error: 'licenseKey + machineId required' }, { status: 400 })
  }

  const lRows = await db.select().from(licenses).where(eq(licenses.licenseKey, body.licenseKey)).limit(1)
  const lic = lRows[0]
  if (!lic) {
    await logActivation(null, body.machineId, 'license_not_found', req)
    return Response.json({ ok: false, error: 'licence not found' }, { status: 404 })
  }
  if (lic.status === 'revoked' || lic.status === 'suspended') {
    await logActivation(lic.id, body.machineId, 'revoked', req)
    return Response.json({ ok: false, error: `licence ${lic.status}` }, { status: 403 })
  }

  // Idempotent re-activation.
  const existing = (await db.select().from(machines).where(eq(machines.machineId, body.machineId)).limit(1))[0]
  if (existing && existing.licenseId === lic.id) {
    const newToken = crypto.randomBytes(24).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex')
    await db
      .update(machines)
      .set({
        authTokenHash: tokenHash,
        hostname: body.hostname ?? existing.hostname,
        os: body.os ?? existing.os,
        osVersion: body.osVersion ?? existing.osVersion,
        arch: body.arch ?? existing.arch,
        currentVersion: body.currentVersion ?? existing.currentVersion,
        activeModule: body.variant ?? existing.activeModule,
        status: 'active',
        lastSeenAt: new Date(),
      })
      .where(eq(machines.id, existing.id))
    await logActivation(lic.id, body.machineId, 'reactivation', req)
    return camelOK({ lic, authToken: newToken, action: 'reactivated' })
  }
  if (existing && existing.licenseId !== lic.id) {
    await logActivation(lic.id, body.machineId, 'fingerprint_mismatch', req)
    return Response.json({ ok: false, error: 'machine already bound to a different licence' }, { status: 409 })
  }

  // Seat capacity.
  const seatCount = await db
    .select({ n: count() })
    .from(machines)
    .where(and(eq(machines.licenseId, lic.id), or(eq(machines.status, 'active'), isNull(machines.status))))
  const used = Number(seatCount[0]?.n ?? 0)
  if (used >= lic.maxMachines) {
    await logActivation(lic.id, body.machineId, 'seat_full', req)
    return Response.json({ ok: false, error: `seat limit reached (${lic.maxMachines})` }, { status: 409 })
  }

  // Issue token + insert machine.
  const machineRowId = createId()
  const authToken = crypto.randomBytes(24).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(authToken).digest('hex')
  const now = new Date()
  await db.insert(machines).values({
    id: machineRowId,
    userId: lic.userId,
    organizationId: lic.organizationId,
    licenseId: lic.id,
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
  await logActivation(lic.id, body.machineId, 'ok', req, machineRowId)
  return camelOK({ lic, authToken, action: 'activated' })
}

async function logActivation(
  licenseId: string | null,
  machineId: string,
  outcome: string,
  req: Request,
  machineRowId?: string,
) {
  if (!licenseId) return
  await db.insert(activations).values({
    id: createId(),
    licenseId,
    machineId: machineRowId ?? null,
    outcome,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
    metadata: { machine_fingerprint: machineId },
  })
}

/** camelCase response shape that matches the desktop's ActivateResponse interface. */
function camelOK({
  lic, authToken, action,
}: { lic: typeof licenses.$inferSelect; authToken: string; action: string }) {
  return Response.json({
    ok: true,
    authToken,
    action,
    entitlements: {
      modules: lic.modules ?? [],
      maxDevices: lic.maxMachines,
      maxBranches: lic.maxBranches,
      maintenanceUntil: lic.maintenanceUntil?.toISOString() ?? null,
      trialEndsAt: lic.trialEndsAt?.toISOString() ?? null,
      majorVersionCap: lic.majorVersionCap,
      status: lic.status,
    },
  })
}
