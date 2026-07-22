import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { safeNextPath } from '@/lib/safe-redirect'
import { AuthFrame } from '@/components/auth/auth-frame'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Alert } from '@/components/ui/alert'

// Account routes stay out of the index — unprefixed, private surfaces.
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Omnix with Google or a one-time email link.',
  robots: { index: false, follow: false },
}

type Reason = 'session-expired' | 'signed-out' | 'expired-link' | 'invite'

const REASONS: Record<Reason, { variant: 'info' | 'warning'; title: string; body: string }> = {
  'session-expired': {
    variant: 'warning',
    title: 'Your session expired',
    body: 'Sign in again to pick up where you left off.',
  },
  'signed-out': {
    variant: 'info',
    title: 'Signed out',
    body: 'You have been signed out of this device.',
  },
  'expired-link': {
    variant: 'warning',
    title: 'That link has expired',
    body: 'Sign-in links last 15 minutes. Request a fresh one below.',
  },
  invite: {
    variant: 'info',
    title: 'Sign in to continue',
    body: 'Use the email your invitation was sent to, then you can accept it.',
  },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; reason?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (session) {
    redirect(safeNextPath(sp.next))
  }

  const reason = sp.reason && sp.reason in REASONS ? (sp.reason as Reason) : null
  const notice = reason ? REASONS[reason] : null

  return (
    <AuthFrame
      eyebrow="Account access"
      title="Sign in"
      description={
        <>
          Omnix does not use a website password. Continue with Google or get a one-time link by
          email. This is your <strong className="font-semibold text-[var(--color-fg)]">buyer
          account</strong> for licences and billing — day-to-day staff sign in inside the desktop
          app.
        </>
      }
      footer={
        <>
          New to Omnix? Sign in with your email and we&apos;ll create the account.{' '}
          <Link
            href="/buy"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Buy a licence
          </Link>{' '}
          if you don&apos;t have one yet.
        </>
      }
    >
      {notice ? (
        <div className="mb-5">
          <Alert variant={notice.variant} title={notice.title}>
            {notice.body}
          </Alert>
        </div>
      ) : null}

      <SignInForm next={sp.next} />
    </AuthFrame>
  )
}
