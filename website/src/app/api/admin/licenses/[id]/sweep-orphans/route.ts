/**
 * POST /api/admin/licenses/[id]/sweep-orphans
 *
 * Hard-deletes activation rows where machine_id IS NULL for this
 * licence. These accrue from the ON DELETE SET NULL on activations
 * .machine_id (when a machine is hard-deleted) — they shouldn't count
 * toward the seat cap (the new gate excludes them) but tidying them
 * up keeps the activation history clean.
 *
 * platform_admin only. Returns the number of rows removed.
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, activations, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (session.user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params

  const deleted = await db
    .delete(activations)
    .where(and(eq(activations.licenseId, id), isNull(activations.machineId)))
    .returning({ id: activations.id })

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'license.sweep_orphan_activations',
    resource: `license:${id}`,
    metadata: { removed: deleted.length },
  })

  return NextResponse.json({ ok: true, removed: deleted.length })
  // sql kept imported for potential future SQL-driven sweeps
  void sql
}
