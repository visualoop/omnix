import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles } from '@/components/icons'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Free 30-day trial. No credit card required. Pay once if you decide to keep it. Start your duka properly.',
}

const PROOF_POINTS = [
  'Free 30 days · no card required',
  'Every module unlocked during trial',
  'Pay once if you keep it · KES 100,000 from',
  'No subscription · no auto-renewal',
] as const

export default function SignupPage() {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
      {/* Form column */}
      <section className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Create your account
          </div>
          <h1 className="mt-3 font-display text-[clamp(32px,4vw,48px)] font-medium leading-[1.05] text-[var(--color-fg)]">
            Start your{' '}
            <span className="text-[var(--color-fg-muted)]">free 30-day trial.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-[1.55] text-[var(--color-fg-muted)]">
            No credit card. Decide after 30 days whether to pay. We'll never charge you without
            you clicking pay.
          </p>

          <div className="mt-10">
            <SignupForm />
          </div>

          <p className="mt-8 text-center text-[13px] text-[var(--color-fg-muted)]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* Visual column */}
      <aside className="hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]/40 px-12 py-16 lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto max-w-md">
          <Sparkles className="size-8 text-[var(--color-accent)]" />
          <blockquote className="mt-8 font-display text-[28px] leading-snug text-[var(--color-fg)]">
            "I cancelled three subscriptions the day Omnix went live. POS, payroll and
            inventory in one place — and I own it."
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-[14px] font-semibold text-[var(--color-accent-hover)]">
              MW
            </span>
            <div className="text-[13px]">
              <div className="font-medium text-[var(--color-fg)]">Mary Wanjiru</div>
              <div className="text-[var(--color-fg-subtle)]">
                Owner · Mama Mary's Chemist · Kasarani
              </div>
            </div>
          </div>

          <ul className="mt-12 space-y-3">
            {PROOF_POINTS.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 text-[14px] text-[var(--color-fg)]"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
