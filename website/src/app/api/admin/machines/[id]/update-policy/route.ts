/**
 * PATCH /api/admin/machines/[id]/update-policy
 *
 * Toggle a machine's auto-update settings.
 *
 * Body: {
 *   updateChannel?: 'stable' | 'canary',
 *   autoUpdateEnabled?: boolean
 * }
 *
 * Auth: platform_admin only. Writes audit_log so we can trace who
 * canaried what and when.
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db, machines, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

interface Body {
  updateChannel?: string
  autoUpdateEnabled?: boolean
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!
  const { id: machineRowId } = await ctx.params

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 })

  const existing = (await db.select().from(machines).where(eq(machines.id, machineRowId)).limit(1))[0]
  if (!existing) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const updates: Partial<typeof machines.$inferInsert> = {}
  if (body.updateChannel && ['stable', 'canary', 'beta', 'nightly'].includes(body.updateChannel)) {
    updates.updateChannel = body.updateChannel
  }
  if (body.autoUpdateEnabled !== undefined) {
    updates.autoUpdateEnabled = body.autoUpdateEnabled ? 'true' : 'false'
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  }

  await db.update(machines).set(updates).where(eq(machines.id, machineRowId))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'machine.update_policy',
    resource: `machine:${machineRowId}`,
    metadata: {
      machineId: existing.machineId,
      hostname: existing.hostname,
      updates,
      previousChannel: existing.updateChannel,
      previousAutoUpdate: existing.autoUpdateEnabled,
    },
  })

  return NextResponse.json({
    ok: true,
    machineId: machineRowId,
    updateChannel: updates.updateChannel ?? existing.updateChannel,
    autoUpdateEnabled: updates.autoUpdateEnabled ?? existing.autoUpdateEnabled,
  })
}
