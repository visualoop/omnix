import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Forgot password',
  description: "Send a reset link to your email. We'll get you back in.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Forgot password
          </div>
          <h1 className="mt-3 font-display text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] text-[var(--color-fg)]">
            Reset by email.
          </h1>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)]">
            Enter the email on your account. If it matches, we'll send a reset link within a
            minute.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 sm:p-8">
          <ForgotPasswordForm />
        </div>

        <p className="mt-8 text-center text-[13px] text-[var(--color-fg-muted)]">
          Remembered it?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
