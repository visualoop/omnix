import { and, eq, count, isNull, or } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, licenses, machines, activations } from '@/db'
import { createId } from '@/lib/ids'

/**
 * /api/licenses/activate
 *
 * Desktop calls this on first launch with a licence key. We:
 *  1. Find the licence by key
 *  2. Verify seat capacity (count machines bound to it)
 *  3. Create the machine row + return a fresh auth token
 *
 * Body: { license_key, machine_id, hostname?, os, current_version? }
 * Returns: { ok, auth_token, signed_key, modules, ... }
 */
export const dynamic = 'force-dynamic'

interface ActivateInput {
  license_key: string
  machine_id: string
  hostname?: string
  os?: string
  os_version?: string
  arch?: string
  current_version?: string
  active_module?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ActivateInput | null
  if (!body?.license_key || !body.machine_id) {
    return Response.json({ ok: false, error: 'license_key + machine_id required' }, { status: 400 })
  }

  const lRows = await db.select().from(licenses).where(eq(licenses.licenseKey, body.license_key)).limit(1)
  const lic = lRows[0]
  if (!lic) {
    await logActivation(null, body.machine_id, 'license_not_found', req)
    return Response.json({ ok: false, error: 'licence not found' }, { status: 404 })
  }
  if (lic.status === 'revoked' || lic.status === 'suspended') {
    await logActivation(lic.id, body.machine_id, 'revoked', req)
    return Response.json({ ok: false, error: `licence ${lic.status}` }, { status: 403 })
  }

  // Check if this exact machine is already bound (idempotent re-activation).
  const existing = (await db.select().from(machines).where(eq(machines.machineId, body.machine_id)).limit(1))[0]
  if (existing && existing.licenseId === lic.id) {
    // Re-activation — issue a new auth token.
    const newToken = crypto.randomBytes(24).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex')
    await db
      .update(machines)
      .set({
        authTokenHash: tokenHash,
        hostname: body.hostname ?? existing.hostname,
        os: body.os ?? existing.os,
        osVersion: body.os_version ?? existing.osVersion,
        arch: body.arch ?? existing.arch,
        currentVersion: body.current_version ?? existing.currentVersion,
        activeModule: body.active_module ?? existing.activeModule,
        status: 'active',
        lastSeenAt: new Date(),
      })
      .where(eq(machines.id, existing.id))
    await logActivation(lic.id, body.machine_id, 'reactivation', req)
    return ok({ lic, machineId: existing.id, authToken: newToken })
  }
  if (existing && existing.licenseId !== lic.id) {
    await logActivation(lic.id, body.machine_id, 'fingerprint_mismatch', req)
    return Response.json({ ok: false, error: 'machine already bound to a different licence' }, { status: 409 })
  }

  // Check seat capacity.
  const seatCount = await db
    .select({ n: count() })
    .from(machines)
    .where(and(eq(machines.licenseId, lic.id), or(eq(machines.status, 'active'), isNull(machines.status))))
  const used = Number(seatCount[0]?.n ?? 0)
  if (used >= lic.maxMachines) {
    await logActivation(lic.id, body.machine_id, 'seat_full', req)
    return Response.json({ ok: false, error: `seat limit reached (${lic.maxMachines})` }, { status: 403 })
  }

  // Issue a fresh token + insert the machine.
  const machineRowId = createId()
  const authToken = crypto.randomBytes(24).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(authToken).digest('hex')
  const now = new Date()
  await db.insert(machines).values({
    id: machineRowId,
    userId: lic.userId,
    organizationId: lic.organizationId,
    licenseId: lic.id,
    machineId: body.machine_id,
    authTokenHash: tokenHash,
    hostname: body.hostname,
    os: body.os ?? 'windows',
    osVersion: body.os_version,
    arch: body.arch,
    currentVersion: body.current_version,
    activeModule: body.active_module,
    status: 'active',
    firstSeenAt: now,
    lastSeenAt: now,
  })
  await logActivation(lic.id, body.machine_id, 'ok', req, machineRowId)

  return ok({ lic, machineId: machineRowId, authToken })
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

function ok({ lic, machineId, authToken }: { lic: typeof licenses.$inferSelect; machineId: string; authToken: string }) {
  return Response.json({
    ok: true,
    auth_token: authToken,
    machine_row_id: machineId,
    signed_key: lic.signedKey,
    variant: lic.variant,
    tier: lic.tier,
    modules: lic.modules,
    max_branches: lic.maxBranches,
    max_machines: lic.maxMachines,
    major_version_cap: lic.majorVersionCap,
    maintenance_until: lic.maintenanceUntil?.toISOString() ?? null,
    trial_ends_at: lic.trialEndsAt?.toISOString() ?? null,
  })
}
