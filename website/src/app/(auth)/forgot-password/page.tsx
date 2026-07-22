import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { safeNextPath } from '@/lib/safe-redirect'
import { AuthFrame } from '@/components/auth/auth-frame'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Recover access',
  description: 'Get a fresh one-time sign-in link for your Omnix account.',
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (session) {
    redirect(safeNextPath(sp.next))
  }

  return (
    <AuthFrame
      eyebrow="Account access"
      title="Recover access"
      description={
        <>
          Omnix has no website password, so there is nothing to reset. Enter your email and
          we&apos;ll send a fresh one-time sign-in link.
        </>
      }
      footer={
        <>
          Remembered how you got in?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
          .
        </>
      }
    >
      <ForgotPasswordForm next={sp.next} />
    </AuthFrame>
  )
}
