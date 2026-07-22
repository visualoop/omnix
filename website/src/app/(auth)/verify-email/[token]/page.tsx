import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AuthFrame } from '@/components/auth/auth-frame'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Email verification',
  description: 'Omnix sign-in links verify your email automatically.',
  robots: { index: false, follow: false },
}

/**
 * /verify-email/[token] — a graceful landing for stale verification links.
 *
 * The website is passwordless: a magic link inherently verifies the inbox
 * it was sent to, and Google verifies on OAuth grant. There is no separate
 * verification step, so any old verify link lands here and points the user
 * back to sign-in rather than 404-ing.
 */
export default async function VerifyEmailPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (session) {
    redirect('/dashboard')
  }

  return (
    <AuthFrame
      eyebrow="Account access"
      title="Verification is automatic"
      description={
        <>
          There is nothing to confirm here. A one-time sign-in link already verifies the inbox it
          was sent to, and Google verifies your address when you continue with it. This older-style
          link is no longer used.
        </>
      }
      aside={[
        { term: 'Magic link', detail: 'Opening the emailed link verifies that inbox.' },
        { term: 'Google', detail: 'Continuing with Google verifies your address.' },
        { term: 'No extra step', detail: 'Omnix never asks you to verify separately.' },
      ]}
      footer={
        <>
          Signed out on this device?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Return to sign in
          </Link>
          .
        </>
      }
    >
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/login">
          Go to sign in
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </AuthFrame>
  )
}
