import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Omnix account.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  try {
    const result = await payload.auth({ headers: reqHeaders })
    if (result.user?.collection === 'customers') {
      const sp = (await searchParams) ?? {}
      redirect(sp.next || '/dashboard')
    }
  } catch {
    // Stale session — fall through and show the login form.
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Sign in
          </div>
          <h1 className="mt-3 font-display text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] text-[var(--color-fg)]">
            Welcome back.
          </h1>
          <p className="mt-3 text-[14px] text-[var(--color-fg-muted)]">
            Sign in to manage your licences, machines and payments.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 sm:p-8">
          <LoginForm />
        </div>

        <p className="mt-8 text-center text-[13px] text-[var(--color-fg-muted)]">
          New here?{' '}
          <Link
            href="/signup"
            className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>

        <p className="mt-3 text-center text-[12px] text-[var(--color-fg-subtle)]">
          Need to access the staff admin panel?{' '}
          <Link href="/admin" className="underline-offset-4 hover:underline">
            Go to /admin
          </Link>
        </p>
      </div>
    </div>
  )
}
