/**
 * POST /api/admin/team/[id]/resend — re-send the magic-link sign-in +
 * branded team invitation for an existing staff user.
 *
 * Used by /admin/team's "Resend invite" button. Works for any staff
 * member (we don't track "pending" explicitly — admins decide who
 * needs a nudge). Refuses banned accounts.
 */
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, user, auditLog } from '@/db'
import { createId } from '@/lib/ids'
import { sendTeamInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep'] as const
type StaffRole = (typeof STAFF_ROLES)[number]

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  if (session.user.role !== 'platform_admin')
    return Response.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const target = (await db.select().from(user).where(eq(user.id, id)).limit(1))[0]
  if (!target) return Response.json({ error: 'not found' }, { status: 404 })
  if (target.banned) {
    return Response.json(
      { error: 'This account is banned — unban first, then resend.' },
      { status: 409 },
    )
  }
  if (!STAFF_ROLES.includes(target.role as StaffRole)) {
    return Response.json(
      { error: 'Only staff accounts (platform_admin / support_agent / sales_rep) can be resent.' },
      { status: 409 },
    )
  }

  // Re-issue a Better-Auth magic link so the email contains a fresh sign-in URL.
  try {
    await auth.api.signInMagicLink({
      body: { email: target.email, callbackURL: '/admin' },
      headers: req.headers,
    })
  } catch (e) {
    console.warn('[team-resend] magic-link generation failed:', e)
  }

  // Branded letter with the role context — matches what they got first time.
  try {
    const baseUrl =
      process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'
    await sendTeamInviteEmail({
      to: target.email,
      inviterName: session.user.name ?? session.user.email.split('@')[0],
      inviteeName: target.name ?? target.email.split('@')[0],
      role: target.role as StaffRole,
      signInUrl: `${baseUrl}/login?next=/admin`,
    })
  } catch (e) {
    console.error('[team-resend] team-invite email failed:', e)
    return Response.json(
      { error: 'Email service failed — check resend.api_key in /admin/settings.' },
      { status: 502 },
    )
  }

  await db.insert(auditLog).values({
    id: createId(),
    actorId: session.user.id,
    action: 'team.resend_invite',
    resource: `user:${target.id}`,
    metadata: { email: target.email, role: target.role },
  })

  return Response.json({ ok: true })
}
