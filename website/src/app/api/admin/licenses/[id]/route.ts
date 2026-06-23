import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, licenses, machines, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/licenses/[id]
 *
 * Hard-deletes a licence + cascades to its machines. Used by platform_admin
 * to clean up bad/test licences (e.g. mis-formatted trial keys before the
 * key-format fix).
 *
 * Self-owners can also delete their own licence (useful for removing a
 * trial they no longer want). For paid licences this should be rare —
 * prefer status='revoked' over a hard delete in that case, but we keep
 * the surface available because the desktop validator checks status on
 * every heartbeat anyway.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const target = (await db.select().from(licenses).where(eq(licenses.id, id)).limit(1))[0]
  if (!target) return Response.json({ error: 'licence not found' }, { status: 404 })

  const isAdmin = session.user.role === 'platform_admin'
  const isOwner = target.userId === session.user.id
  if (!isAdmin && !isOwner) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  // Cascade to machines first (no FK ON DELETE CASCADE on machines.licenseId
  // because the desktop is allowed to keep working in a "lapsed" state).
  await db.delete(machines).where(eq(machines.licenseId, id))
  await db.delete(licenses).where(eq(licenses.id, id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'license.delete',
    resource: `license:${id}`,
    metadata: {
      licenseKey: target.licenseKey,
      variant: target.variant,
      status: target.status,
      deletedBy: isAdmin ? 'platform_admin' : 'self',
    },
  })

  return Response.json({ ok: true })
}
