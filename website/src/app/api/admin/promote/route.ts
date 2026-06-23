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
 *     -d '{"email":"founder@omnix.co.ke","role":"platform_admin","name":"Founder"}'
 *
 * If the user doesn't exist yet, creates a stub row first so subsequent
 * Google sign-ins / magic-link sign-ins account-link to the existing
 * user. Useful for pre-seeding admins before they sign in.
 *
 * Idempotent. Logs to audit_log with actor=bootstrap.
 */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string
    role?: 'platform_admin' | 'support_agent' | 'sales_rep' | 'user'
    name?: string
  } | null

  if (!body?.email) return Response.json({ error: 'email required' }, { status: 400 })
  const role = body.role ?? 'platform_admin'
  const email = body.email.toLowerCase().trim()

  let u = (await db.select().from(user).where(eq(user.email, email)).limit(1))[0]

  if (!u) {
    // Pre-seed the user so they can be made admin before first sign-in.
    // Better Auth's account-linking (trustedProviders=['google']) will
    // attach the Google or magic-link account to this row when they sign in.
    const id = createId()
    const now = new Date()
    await db.insert(user).values({
      id,
      email,
      name: body.name ?? email.split('@')[0],
      emailVerified: true, // pre-seeded; verifies on first sign-in via Google or magic link
      role,
      createdAt: now,
      updatedAt: now,
    })
    u = (await db.select().from(user).where(eq(user.id, id)).limit(1))[0]!
    await db.insert(auditLog).values({
      id: createId(),
      actorId: 'bootstrap',
      action: 'user.create_seed',
      resource: `user:${u.id}`,
      metadata: { email, role, source: 'bootstrap_promote' },
    })
    return Response.json({ ok: true, created: true, user: { id: u.id, email: u.email, role } })
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
    created: false,
    user: { id: u.id, email: u.email, role },
  })
}
