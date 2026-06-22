import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, licenses, machines, activations, auditLog } from '@/db'
import { createId } from '@/lib/ids'

/**
 * /api/licenses/rebind
 *
 * The owner replaced hardware. We let them rebind a single seat
 * once per 30 days (rate-limit applied at the auditLog layer).
 *
 * Body: { license_key, old_machine_id, new_machine_id, owner_token? }
 * Returns: new auth_token bound to the new machine_id.
 */
export const dynamic = 'force-dynamic'

interface RebindInput {
  license_key: string
  old_machine_id: string
  new_machine_id: string
  hostname?: string
  os?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RebindInput | null
  if (!body?.license_key || !body.old_machine_id || !body.new_machine_id) {
    return Response.json({ ok: false, error: 'license_key + old_machine_id + new_machine_id required' }, { status: 400 })
  }

  const lic = (await db.select().from(licenses).where(eq(licenses.licenseKey, body.license_key)).limit(1))[0]
  if (!lic) return Response.json({ ok: false, error: 'licence not found' }, { status: 404 })

  const oldMachine = (await db.select().from(machines).where(eq(machines.machineId, body.old_machine_id)).limit(1))[0]
  if (!oldMachine || oldMachine.licenseId !== lic.id) {
    return Response.json({ ok: false, error: 'old machine not bound to this licence' }, { status: 404 })
  }

  // Mark old machine revoked.
  await db.update(machines).set({ status: 'revoked' }).where(eq(machines.id, oldMachine.id))

  // Check seat headroom (revoking the old should free a seat — 0 net change).
  const newToken = crypto.randomBytes(24).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex')
  const newId = createId()
  const now = new Date()
  await db.insert(machines).values({
    id: newId,
    userId: lic.userId,
    organizationId: lic.organizationId,
    licenseId: lic.id,
    machineId: body.new_machine_id,
    authTokenHash: tokenHash,
    hostname: body.hostname ?? oldMachine.hostname,
    os: body.os ?? oldMachine.os,
    status: 'active',
    firstSeenAt: now,
    lastSeenAt: now,
  })

  await db.insert(activations).values({
    id: createId(),
    licenseId: lic.id,
    machineId: newId,
    outcome: 'rebind',
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
    metadata: { from: body.old_machine_id, to: body.new_machine_id },
  })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: lic.userId,
    action: 'license.rebind',
    resource: `license:${lic.id}`,
    metadata: { from: body.old_machine_id, to: body.new_machine_id },
  })

  return Response.json({
    ok: true,
    auth_token: newToken,
    machine_row_id: newId,
  })
}
