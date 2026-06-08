import Link from 'next/link'
import { Icon } from '@/components/icons'

/**
 * Homepage AI section.
 *
 * Editorial slot between the founder note and the modules rows. Tells
 * the AI story without overhyping it: an assistant that knows the
 * product + your live data + KRA/M-Pesa flows, and that you bring
 * your own model for.
 */
export function AiSection() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          {/* Left — copy */}
          <div>
            <span className="caption-mono">AI inside</span>
            <h2 className="font-[family-name:var(--font-display)] mt-5 text-[clamp(40px,5vw,72px)] font-normal leading-[1.05] tracking-[-0.025em] text-[var(--color-fg)]">
              An assistant that <em>knows</em> your business.
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
              Built into every till. Knows the entire app, KRA filings, M-Pesa flows, SHA claims —
              and your live data. Ask "how was lunch?" and it pulls today's sales. Ask "what's running
              low?" and it lists the reorder queue. Ask "why did this eTIMS receipt fail?" and it
              translates the cryptic CU error into plain English.
            </p>
            <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
              Bring your own model — Groq and OpenRouter offer free tiers that are plenty for daily
              work. Want GPT-4o or Claude? Plug your key in. We never see your prompts; calls go
              direct from your machine to your provider.
            </p>
            <Link
              href="/ai"
              className="font-[family-name:var(--font-ui)] mt-9 inline-flex items-center gap-2 border-b border-[var(--color-border-strong)] pb-1 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              See what the assistant can do
              <Icon.ArrowRight className="size-3.5" weight="bold" />
            </Link>
          </div>

          {/* Right — example chat */}
          <div className="self-center">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div className="flex items-center gap-2">
                  <Icon.Sparkles className="size-4 text-[var(--color-accent)]" weight="fill" />
                  <span className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-fg)]">
                    Omnix Assistant
                  </span>
                </div>
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  Groq · free
                </span>
              </div>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-[var(--color-surface-2)] px-4 py-3 ml-8">
                  <div className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-fg-subtle)]">
                    You
                  </div>
                  <p className="mt-1 text-[14px] text-[var(--color-fg)]">
                    What did we sell today? And what's running low?
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-3 mr-8">
                  <div className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-accent)]">
                    Omnix
                  </div>
                  <p className="mt-1 text-[14px] leading-[1.6] text-[var(--color-fg)]">
                    Today: KES 47,300 across 89 sales — 62% M-Pesa, 31% cash, 7% card.
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg)]">
                    3 items below reorder level: Panadol Extra (4 left), Cetrizine 10mg (2 left),
                    Cataflam 50mg (3 left). Open <code className="font-[family-name:var(--font-mono)] rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[12px] text-[var(--color-accent)]">/inventory</code> to reorder.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['/inventory', '/reports/zreport', 'Restock list'].map((chip) => (
                    <span
                      key={chip}
                      className="font-[family-name:var(--font-mono)] rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 px-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Real conversation. Real data. Your model. Your keys.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
