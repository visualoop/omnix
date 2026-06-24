import { eq } from 'drizzle-orm'
import { db, licenses, machines } from '@/db'

/**
 * /api/licensing/validate — desktop-compatible heartbeat.
 *
 * Body: { licenseKey, machineId, variant? }
 * Returns ValidateResponse:
 *   { status, lockoutMode?, modules?, maxMachines?, maintenanceUntil?, message? }
 *
 * The desktop calls this on startup + periodically. We:
 *   1. Look up the licence
 *   2. Check the machine's fingerprint matches a bound row
 *   3. Update lastSeenAt
 *   4. Return current entitlements
 */
export const dynamic = 'force-dynamic'

interface ValidateInput {
  licenseKey: string
  machineId: string
  variant?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ValidateInput | null
  if (!body?.licenseKey || !body.machineId) {
    return Response.json({ status: 'invalid', message: 'licenseKey + machineId required' }, { status: 400 })
  }

  const lic = (await db.select().from(licenses).where(eq(licenses.licenseKey, body.licenseKey)).limit(1))[0]
  if (!lic) {
    return Response.json({ status: 'invalid', message: 'licence not found' }, { status: 404 })
  }
  if (lic.status === 'revoked') {
    return Response.json({ status: 'invalid', message: 'revoked' })
  }
  if (lic.status === 'suspended') {
    return Response.json({ status: 'suspended', message: 'suspended by admin' })
  }
  if (lic.status === 'lapsed') {
    return Response.json({ status: 'cancelled', lockoutMode: 'read_only', message: 'trial ended or maintenance lapsed' })
  }

  // Find the machine + verify the fingerprint matches.
  const m = (await db.select().from(machines).where(eq(machines.machineId, body.machineId)).limit(1))[0]
  if (!m || m.licenseId !== lic.id) {
    return Response.json({ status: 'invalid', message: 'machine not bound to this licence' }, { status: 403 })
  }

  // Update heartbeat.
  await db.update(machines).set({ lastSeenAt: new Date() }).where(eq(machines.id, m.id))

  return Response.json({
    status: lic.status === 'trial' ? 'trial' : 'active',
    modules: lic.modules ?? [],
    maxMachines: lic.maxMachines,
    maintenanceUntil: lic.maintenanceUntil?.toISOString() ?? null,
  })
}
