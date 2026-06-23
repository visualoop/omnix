import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, user, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep', 'user'] as const

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { ok: false as const, status: 401, body: { error: 'unauthenticated' } }
  if (session.user.role !== 'platform_admin') return { ok: false as const, status: 403, body: { error: 'forbidden' } }
  return { ok: true as const, session }
}

/**
 * PATCH /api/admin/team/[id]
 *
 * Body shapes:
 *   { role: 'platform_admin' | 'support_agent' | 'sales_rep' | 'user' }
 *   { banned: true, banReason?: string }
 *   { banned: false }
 *
 * 'user' role demotes the user from staff (revokes /admin access).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await requireAdmin()
  if (!a.ok) return Response.json(a.body, { status: a.status })

  const { id } = await params
  const target = (await db.select().from(user).where(eq(user.id, id)).limit(1))[0]
  if (!target) return Response.json({ error: 'user not found' }, { status: 404 })

  // Prevent admins from locking themselves out by changing their own role
  // or banning themselves.
  if (target.id === a.session.user.id) {
    return Response.json({ error: 'cannot modify your own staff record from this endpoint' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as {
    role?: typeof STAFF_ROLES[number]
    banned?: boolean
    banReason?: string
  } | null
  if (!body) return Response.json({ error: 'body required' }, { status: 400 })

  const updates: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
  let action = 'team.update'

  if (body.role !== undefined) {
    if (!STAFF_ROLES.includes(body.role)) {
      return Response.json({ error: `role must be one of ${STAFF_ROLES.join(' / ')}` }, { status: 400 })
    }
    updates.role = body.role
    action = body.role === 'user' ? 'team.demote' : 'team.update_role'
  }

  if (body.banned !== undefined) {
    updates.banned = body.banned
    updates.banReason = body.banned ? (body.banReason ?? null) : null
    action = body.banned ? 'team.ban' : 'team.unban'
  }

  await db.update(user).set(updates).where(eq(user.id, id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: a.session.user.id,
    action,
    resource: `user:${id}`,
    metadata: { email: target.email, ...body },
  })

  return Response.json({ ok: true })
}
