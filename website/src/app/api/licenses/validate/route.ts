import { and, eq } from 'drizzle-orm'
import { db, licenses, machines } from '@/db'
import crypto from 'node:crypto'

/**
 * /api/licenses/validate
 *
 * Desktop calls this on every heartbeat (~30s) to confirm the licence
 * is still valid. Auth is via the machine's hashed bearer token —
 * not Better Auth, since the desktop has no user session.
 *
 * Body: { license_key, machine_id, auth_token, current_version }
 * Returns: { status, modules, maintenance_until, major_version_cap, ... }
 */
export const dynamic = 'force-dynamic'

interface ValidateInput {
  license_key: string
  machine_id: string
  auth_token: string
  current_version?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ValidateInput | null
  if (!body?.license_key || !body.machine_id || !body.auth_token) {
    return Response.json({ ok: false, error: 'license_key + machine_id + auth_token required' }, { status: 400 })
  }

  // Find the machine and verify the auth token.
  const mRows = await db.select().from(machines).where(eq(machines.machineId, body.machine_id)).limit(1)
  const m = mRows[0]
  if (!m) return Response.json({ ok: false, error: 'machine not registered' }, { status: 404 })

  const tokenHash = crypto.createHash('sha256').update(body.auth_token).digest('hex')
  if (m.authTokenHash !== tokenHash) {
    return Response.json({ ok: false, error: 'auth token mismatch' }, { status: 401 })
  }

  // Find the licence.
  const lRows = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, m.licenseId), eq(licenses.licenseKey, body.license_key)))
    .limit(1)
  const lic = lRows[0]
  if (!lic) return Response.json({ ok: false, error: 'licence/machine mismatch' }, { status: 401 })

  if (lic.status === 'revoked' || lic.status === 'suspended') {
    return Response.json({ ok: false, error: `licence ${lic.status}` }, { status: 403 })
  }

  // Update lastSeenAt + version on the machine row.
  await db
    .update(machines)
    .set({
      lastSeenAt: new Date(),
      currentVersion: body.current_version ?? m.currentVersion,
    })
    .where(eq(machines.id, m.id))

  return Response.json({
    ok: true,
    status: lic.status,
    variant: lic.variant,
    tier: lic.tier,
    modules: lic.modules,
    max_branches: lic.maxBranches,
    max_machines: lic.maxMachines,
    major_version_cap: lic.majorVersionCap,
    maintenance_until: lic.maintenanceUntil?.toISOString() ?? null,
    trial_ends_at: lic.trialEndsAt?.toISOString() ?? null,
    cloud_backup_enabled: lic.cloudBackupEnabled,
    cloud_backup_expires_at: lic.cloudBackupExpiresAt?.toISOString() ?? null,
    signed_key: lic.signedKey,
  })
}
