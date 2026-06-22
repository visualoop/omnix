import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Omnix with Google or a magic link.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (session) {
    const sp = (await searchParams) ?? {}
    redirect(sp.next || '/dashboard')
  }
  const sp = (await searchParams) ?? {}

  return (
    <div className="mx-auto flex min-h-[calc(100vh-128px)] w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
          Omnix
        </span>
        <h1 className="mt-2 font-display text-[clamp(28px,3vw,36px)] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--color-fg)]">
          Sign in
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
          We don&apos;t use passwords on the website. Pick Google or get a one-time link by email.
        </p>
      </div>

      <SignInForm next={sp.next} />

      <p className="mt-8 text-center text-[12px] text-[var(--color-fg-subtle)]">
        New to Omnix? Just sign in with your email — we&apos;ll create the account.
        Or <Link href="/buy" className="underline-offset-4 hover:underline text-[var(--color-fg-muted)]">buy a licence first</Link>.
      </p>
    </div>
  )
}
