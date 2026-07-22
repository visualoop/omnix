import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, invitation, organization, user } from '@/db'
import { AuthFrame } from '@/components/auth/auth-frame'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ArrowRight } from '@/components/icons'
import {
  AcceptInvitationPanel,
  SwitchAccountButton,
} from '@/components/auth/accept-invitation-panel'

export const metadata: Metadata = {
  title: 'Accept invitation',
  description: 'Join an Omnix organisation you were invited to.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const returnTarget = `/accept-invitation/${id}`

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    redirect(`/login?reason=invite&next=${encodeURIComponent(returnTarget)}`)
  }

  const rows = await db
    .select({
      inv: invitation,
      orgName: organization.name,
      inviterName: user.name,
      inviterEmail: user.email,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .leftJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, id))
    .limit(1)

  const row = rows[0]
  const sessionEmail = session.user.email

  // Unknown token → do not disclose anything beyond "not valid".
  if (!row) {
    return (
      <InvitationNotice
        title="This invitation link isn’t valid"
        body="The link may be mistyped or the invitation was withdrawn. Ask whoever invited you to send a fresh one."
      />
    )
  }

  const { inv, orgName, inviterName, inviterEmail } = row
  const roleLabel = ROLE_LABELS[inv.role ?? 'member'] ?? 'Member'
  const inviterLabel = inviterName || inviterEmail || 'Your organisation'
  const expired = inv.expiresAt.getTime() < Date.now()
  const wrongAccount = inv.email.toLowerCase() !== sessionEmail.toLowerCase()

  if (inv.status !== 'pending') {
    const settled =
      inv.status === 'accepted'
        ? 'This invitation has already been accepted.'
        : inv.status === 'rejected'
          ? 'This invitation was declined.'
          : 'This invitation is no longer active.'
    return <InvitationNotice title="Nothing to do here" body={settled} />
  }

  if (expired) {
    return (
      <InvitationNotice
        title="This invitation has expired"
        body={`Invitations to ${orgName} last a limited time. Ask ${inviterLabel} to resend it.`}
      />
    )
  }

  if (wrongAccount) {
    return (
      <AuthFrame
        eyebrow="Team invitation"
        title="Signed in with a different email"
        aside={null}
        description={
          <>
            This invitation was sent to <strong className="font-semibold text-[var(--color-fg)]">{inv.email}</strong>,
            but you&apos;re signed in as <strong className="font-semibold text-[var(--color-fg)]">{sessionEmail}</strong>.
            Sign in with the invited email to accept it.
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SwitchAccountButton next={returnTarget} />
          <Button asChild variant="ghost" size="lg">
            <Link href="/dashboard">Stay on this account</Link>
          </Button>
        </div>
      </AuthFrame>
    )
  }

  // Valid, pending, correct recipient → offer accept / decline.
  return (
    <AuthFrame
      eyebrow="Team invitation"
      title={`Join ${orgName}`}
      aside={null}
      description={
        <>
          {inviterLabel} invited you to join <strong className="font-semibold text-[var(--color-fg)]">{orgName}</strong> on
          Omnix. Accepting adds this account to the organisation so you can share its licences and
          machines.
        </>
      }
    >
      <dl className="mb-6 grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            Organisation
          </dt>
          <dd className="mt-1 font-ui font-semibold text-[var(--color-fg)]">{orgName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            Your role
          </dt>
          <dd className="mt-1 font-ui font-semibold text-[var(--color-fg)]">{roleLabel}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            Invited by
          </dt>
          <dd className="mt-1 truncate font-ui font-semibold text-[var(--color-fg)]">{inviterLabel}</dd>
        </div>
      </dl>

      <AcceptInvitationPanel invitationId={inv.id} orgName={orgName} />
    </AuthFrame>
  )
}

/** Shared terminal state for invalid / expired / already-settled invites. */
function InvitationNotice({ title, body }: { title: string; body: string }) {
  return (
    <AuthFrame eyebrow="Team invitation" title={title} aside={null} description={body}>
      <Alert variant="info">
        <p>
          You can keep using Omnix with your own account. Manage teams from the dashboard once
          you&apos;re signed in.
        </p>
      </Alert>
      <div className="mt-5">
        <Button asChild size="lg">
          <Link href="/dashboard">
            Go to dashboard
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </AuthFrame>
  )
}
