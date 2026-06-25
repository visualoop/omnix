/**
 * DELETE /api/dashboard/machines/[id] — release a machine's seat.
 *
 * Mutations:
 *   - Set machines.status = 'revoked' (soft delete — preserves history)
 *   - Set activations.machineId = NULL for any activations bound to it
 *     (frees the seat for re-use; activations.machineId is ON DELETE SET
 *     NULL but we do it explicitly so the join-count seat check is fast)
 *
 * Returns the freed-seat count so the dashboard can show "2 of 3 seats
 * in use" on the licence detail page after a release.
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, machines, activations } from '@/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Sign in' }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, id), eq(machines.userId, session.user.id)))
    .limit(1)
  const m = rows[0]
  if (!m) {
    return NextResponse.json({ ok: false, error: 'Machine not found on your account.' }, { status: 404 })
  }

  // Soft-revoke the machine + clear activation binding. The desktop
  // app will see a 401 from the next telemetry/auth_token check and
  // exit gracefully.
  await db
    .update(machines)
    .set({ status: 'revoked' })
    .where(eq(machines.id, id))

  // Free the seat: null out machineId on every activation bound here.
  // The unique partial index `WHERE machine_id IS NOT NULL` lets us
  // null-out without breaking re-activation later.
  await db
    .update(activations)
    .set({ machineId: null })
    .where(eq(activations.machineId, id))

  return NextResponse.json({ ok: true })
}
