import { eq } from 'drizzle-orm'
import { db, user, auditLog } from '@/db'
import { createId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

/**
 * Bootstrap a platform_admin.
 *
 * Authenticated by Bearer BOOTSTRAP_TOKEN — the same token used for
 * /api/bootstrap-db + /api/migrate-db. Used once to elevate the first
 * staff user. After v0.9.0 the bootstrap surface goes away entirely.
 *
 *   curl -X POST https://omnix.co.ke/api/admin/promote \
 *     -H "Authorization: Bearer $BOOTSTRAP_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"founder@omnix.co.ke","role":"platform_admin"}'
 *
 * Idempotent. Refuses if email isn't found — sign in first, then
 * call this. Logs to audit_log with actor=bootstrap.
 */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string
    role?: 'platform_admin' | 'support_agent' | 'sales_rep' | 'user'
  } | null

  if (!body?.email) return Response.json({ error: 'email required' }, { status: 400 })
  const role = body.role ?? 'platform_admin'

  const rows = await db.select().from(user).where(eq(user.email, body.email)).limit(1)
  const u = rows[0]
  if (!u) {
    return Response.json({
      error: 'user not found — sign in via /login first, then call this endpoint',
      email: body.email,
    }, { status: 404 })
  }

  await db.update(user).set({ role }).where(eq(user.id, u.id))

  await db.insert(auditLog).values({
    id: createId(),
    actorId: 'bootstrap',
    action: 'user.role_change',
    resource: `user:${u.id}`,
    metadata: { email: u.email, oldRole: u.role ?? 'user', newRole: role },
  })

  return Response.json({
    ok: true,
    user: { id: u.id, email: u.email, role },
  })
}
