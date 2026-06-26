import Link from 'next/link'

/**
 * Setup-CTA banner for the dashboard.
 *
 * Shown to customers who own a licence so they can immediately find how
 * to switch on the things that make the POS useful — M-Pesa, Paystack,
 * and the AI assistant. Each card links to the matching setup guide
 * (which explains how to get the keys and where to paste them in the
 * desktop app).
 *
 * This is a "next step" nudge, not a blocker — it always renders for
 * licence-holders since we can't see the desktop app's local config
 * from the cloud dashboard.
 */
const STEPS = [
  {
    href: '/docs/mpesa',
    eyebrow: 'Payments',
    title: 'Set up M-Pesa',
    body: 'Lipa na M-Pesa — Paybill, Till, or STK push. Get your Daraja keys and switch it on.',
    accent: '#4FC52E',
  },
  {
    href: '/docs/paystack-keys',
    eyebrow: 'Payments',
    title: 'Set up Paystack',
    body: 'Take M-Pesa and cards through one provider. Get your API keys in minutes.',
    accent: '#13B7F5',
  },
  {
    href: '/docs/ai-keys',
    eyebrow: 'Assistant',
    title: 'Set up AI',
    body: 'Bring your own key (Groq, OpenRouter, Anthropic) to switch on the in-app assistant.',
    accent: '#8B5CF6',
  },
] as const

export function SetupCtaBanner() {
  return (
    <section>
      <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)] mb-3">
        Finish setting up
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            data-tour={s.href === '/docs/mpesa' ? 'setup-mpesa' : undefined}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
          >
            <span
              className="font-mono text-[10px] uppercase tracking-[0.2em]"
              style={{ color: s.accent }}
            >
              {s.eyebrow}
            </span>
            <div className="mt-1 font-display text-[15px] font-medium text-[var(--color-fg)]">
              {s.title} →
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
              {s.body}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
