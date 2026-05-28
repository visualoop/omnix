import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Verify email',
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Server-side verify: hit Payload's customers verify endpoint
  let success = false
  let error: string | null = null

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/customers/verify/${token}`, {
      method: 'POST',
      cache: 'no-store',
    })
    if (response.ok) {
      success = true
    } else {
      const data = (await response.json().catch(() => null)) as
        | { errors?: { message: string }[] }
        | null
      error = data?.errors?.[0]?.message ?? 'This link is invalid or has expired.'
    }
  } catch {
    error = 'Could not verify right now. Try the link again, or sign in.'
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-md text-center">
        <div
          className={
            success
              ? 'mx-auto inline-flex size-14 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
              : 'mx-auto inline-flex size-14 items-center justify-center rounded-full bg-[var(--color-negative)]/10 text-[var(--color-negative)]'
          }
        >
          {success ? <CheckCircle2 className="size-7" /> : <AlertCircle className="size-7" />}
        </div>

        <h1 className="mt-6 font-display text-[clamp(28px,3.5vw,40px)] font-medium leading-[1.1] text-[var(--color-fg)]">
          {success ? 'Email verified.' : 'Verification failed.'}
        </h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
          {success
            ? "Your email is now confirmed. Sign in to start your free trial."
            : (error ?? 'This link is invalid or has expired.')}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {success ? (
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/signup">Try signing up again</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Contact support</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
