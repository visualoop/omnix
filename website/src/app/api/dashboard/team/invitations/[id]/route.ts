/**
 * POST   /api/dashboard/team/invitations/[id]/resend — refresh expiry + re-send email
 * DELETE /api/dashboard/team/invitations/[id]        — cancel a pending invitation
 *
 * Both gates require the caller to be owner/admin of the invitation's
 * organisation. The id must point to a `status='pending'` row; accepted
 * or expired invites can't be resent (they need a fresh invite instead).
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, member, organization, invitation } from '@/db'
import { auth } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function loadInvitationForAdmin(invitationId: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { status: 401 as const, error: 'Sign in' }
  const rows = await db
    .select({
      inv: invitation,
      org: organization,
      myRole: member.role,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(
      member,
      and(
        eq(member.organizationId, invitation.organizationId),
        eq(member.userId, session.user.id),
      ),
    )
    .where(eq(invitation.id, invitationId))
    .limit(1)
  const row = rows[0]
  if (!row) return { status: 404 as const, error: 'Invitation not found on any organisation you administer.' }
  if (row.myRole !== 'owner' && row.myRole !== 'admin') {
    return { status: 403 as const, error: 'Only owners or admins can manage invitations.' }
  }
  return { status: 200 as const, session, ...row }
}

function buildInviteLink(invitationId: string): string {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://omnix.co.ke'
  return `${base}/accept-invitation/${invitationId}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadInvitationForAdmin(id)
  if (r.status !== 200) return NextResponse.json({ ok: false, error: r.error }, { status: r.status })
  if (r.inv.status !== 'pending') {
    return NextResponse.json(
      {
        ok: false,
        error:
          r.inv.status === 'accepted'
            ? 'This invitation has already been accepted.'
            : `Invitation status is "${r.inv.status}" — only pending invitations can be resent.`,
      },
      { status: 409 },
    )
  }
  // Refresh expiry: another 7 days from now.
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.update(invitation).set({ expiresAt: newExpiry }).where(eq(invitation.id, id))
  await sendInviteEmail({
    email: r.inv.email,
    inviteLink: buildInviteLink(id),
    inviterName: r.session.user.name ?? r.session.user.email,
    orgName: r.org.name,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadInvitationForAdmin(id)
  if (r.status !== 200) return NextResponse.json({ ok: false, error: r.error }, { status: r.status })
  if (r.inv.status !== 'pending') {
    return NextResponse.json(
      { ok: false, error: 'Only pending invitations can be cancelled.' },
      { status: 409 },
    )
  }
  // Mark cancelled rather than hard-delete so we keep the audit trail.
  await db.update(invitation).set({ status: 'cancelled' }).where(eq(invitation.id, id))
  return NextResponse.json({ ok: true })
}
