import type { Metadata } from 'next'

/**
 * /onboarding is a one-off top-level route. No special chrome — the
 * page renders its own centred wizard. The root layout (app/layout.tsx)
 * already provides <html>, <body>, fonts, and globals.css.
 */

// Post-signup wizard: a private surface that must never be indexed.
// robots.ts also disallows /onboarding — this is defence in depth.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-dvh min-w-0 bg-[var(--color-bg)]">
      {children}
    </main>
  )
}
