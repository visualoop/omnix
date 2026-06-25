/**
 * Customer team management.
 *
 *   POST   /api/dashboard/team/invitations            — create a new invite
 *   POST   /api/dashboard/team/invitations/[id]/resend — re-send the invite email
 *   DELETE /api/dashboard/team/invitations/[id]       — cancel a pending invite
 *
 * Auth: caller must be the owner OR admin of the target organisation.
 * The org is resolved via session.user → first membership where role
 * in ('owner','admin'). Same heuristic the team page uses.
 */
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, member, organization, invitation, user } from '@/db'
import { auth } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_ROLES = ['owner', 'admin', 'member'] as const
type Role = (typeof VALID_ROLES)[number]

async function requireOwnerOrAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return {
      error: NextResponse.json({ ok: false, error: 'Sign in' }, { status: 401 }),
      session: null,
      org: null,
    }
  }
  // First org where this user is owner or admin.
  const rows = await db
    .select({ org: organization, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))
  const adminOf = rows.find((r) => r.role === 'owner' || r.role === 'admin')
  if (!adminOf) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'Only the organisation owner or an admin can invite teammates.' },
        { status: 403 },
      ),
      session: null,
      org: null,
    }
  }
  return { error: null, session, org: adminOf.org }
}

function buildInviteLink(invitationId: string): string {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://omnix.co.ke'
  return `${base}/accept-invitation/${invitationId}`
}

/**
 * POST /api/dashboard/team/invitations
 * body: { email: string, role?: 'admin' | 'member' }
 */
export async function POST(req: Request) {
  const a = await requireOwnerOrAdmin()
  if (a.error) return a.error

  let body: { email?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const email = body.email?.trim().toLowerCase()
  const role = (body.role ?? 'member') as Role
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Provide a valid email address.' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `Role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Refuse if the email is already a member of this org.
  const existingMember = await db
    .select()
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, a.org!.id), eq(user.email, email)))
    .limit(1)
  if (existingMember[0]) {
    return NextResponse.json(
      { ok: false, error: 'That email is already on your team.' },
      { status: 409 },
    )
  }

  // If there's a pending invite for this email, treat as a resend.
  const existingInvite = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, a.org!.id),
        eq(invitation.email, email),
        eq(invitation.status, 'pending'),
      ),
    )
    .limit(1)
  if (existingInvite[0]) {
    const inv = existingInvite[0]
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await db
      .update(invitation)
      .set({ expiresAt: newExpiry, role })
      .where(eq(invitation.id, inv.id))
    await sendInviteEmail({
      email,
      inviteLink: buildInviteLink(inv.id),
      inviterName: a.session!.user.name ?? a.session!.user.email,
      orgName: a.org!.name,
    })
    return NextResponse.json({ ok: true, id: inv.id, resent: true })
  }

  // Fresh invite
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.insert(invitation).values({
    id,
    email,
    inviterId: a.session!.user.id,
    organizationId: a.org!.id,
    role,
    status: 'pending',
    expiresAt,
  })

  await sendInviteEmail({
    email,
    inviteLink: buildInviteLink(id),
    inviterName: a.session!.user.name ?? a.session!.user.email,
    orgName: a.org!.name,
  })

  return NextResponse.json({ ok: true, id })
}
