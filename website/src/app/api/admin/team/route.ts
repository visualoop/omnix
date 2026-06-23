import { headers } from 'next/headers'
import { eq, ne, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, user, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { sendTeamInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep'] as const
type StaffRole = (typeof STAFF_ROLES)[number]

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { ok: false as const, status: 401, body: { error: 'unauthenticated' } }
  if (session.user.role !== 'platform_admin') return { ok: false as const, status: 403, body: { error: 'forbidden' } }
  return { ok: true as const, session }
}

/** GET /api/admin/team — list every staff user (role !== 'user'). */
export async function GET() {
  const a = await requireAdmin()
  if (!a.ok) return Response.json(a.body, { status: a.status })

  const rows = await db
    .select()
    .from(user)
    .where(ne(user.role, 'user'))
    .orderBy(desc(user.createdAt))

  return Response.json({
    members: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      banned: u.banned,
      banReason: u.banReason,
      createdAt: u.createdAt,
      lastSeen: u.updatedAt,
    })),
  })
}

/**
 * POST /api/admin/team — invite a teammate.
 *
 * Body: { email, name?, role }
 * Pre-seeds the user row with the given role + ships a TeamInviteEmail
 * with a magic-link sign-in URL. Idempotent if the email already exists
 * (updates role + re-sends invite).
 */
export async function POST(req: Request) {
  const a = await requireAdmin()
  if (!a.ok) return Response.json(a.body, { status: a.status })

  const body = (await req.json().catch(() => null)) as {
    email?: string
    name?: string
    role?: StaffRole
  } | null

  if (!body?.email) return Response.json({ error: 'email required' }, { status: 400 })
  if (!body.role || !STAFF_ROLES.includes(body.role)) {
    return Response.json({ error: `role must be one of ${STAFF_ROLES.join(' / ')}` }, { status: 400 })
  }

  const email = body.email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'invalid email' }, { status: 400 })
  }

  if (email === a.session.user.email && body.role !== 'platform_admin') {
    return Response.json({ error: 'use another admin to change your own role' }, { status: 400 })
  }

  let existing = (await db.select().from(user).where(eq(user.email, email)).limit(1))[0]
  let created = false

  if (!existing) {
    const id = createId()
    const now = new Date()
    await db.insert(user).values({
      id,
      email,
      name: body.name ?? email.split('@')[0],
      emailVerified: true,
      role: body.role,
      createdAt: now,
      updatedAt: now,
    })
    existing = (await db.select().from(user).where(eq(user.id, id)).limit(1))[0]!
    created = true
  } else {
    await db.update(user).set({ role: body.role, updatedAt: new Date() }).where(eq(user.id, existing.id))
  }

  // Ship a Better-Auth magic link to /admin so the invitee lands directly there.
  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: '/admin' },
      headers: req.headers,
    })
  } catch (e) {
    console.warn('[team-invite] magic-link generation failed:', e)
  }

  // Send our branded team-invite email alongside Better Auth's magic-link mail
  // so the invitee gets explicit context ("X added you as platform_admin").
  try {
    const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'
    await sendTeamInviteEmail({
      to: email,
      inviterName: a.session.user.name ?? a.session.user.email.split('@')[0],
      inviteeName: existing.name ?? email.split('@')[0],
      role: body.role,
      signInUrl: `${baseUrl}/login?next=/admin`,
    })
  } catch (e) {
    console.error('[team-invite] team-invite email failed:', e)
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: a.session.user.id,
    action: created ? 'team.create' : 'team.update_role',
    resource: `user:${existing.id}`,
    metadata: { email, role: body.role, createdNew: created },
  })

  return Response.json({
    ok: true,
    created,
    user: { id: existing.id, email, role: body.role },
  })
}
