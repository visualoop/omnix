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
              An employee that <em>knows</em> your numbers.
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
              Not a chatbot — a working assistant wired into your live data. Ask
              &ldquo;what made the most profit this month?&rdquo;, &ldquo;what should I reorder, and
              how much?&rdquo;, or &ldquo;which customers have stopped buying?&rdquo; and it answers
              from your actual books, not a guess.
            </p>
            <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
              It flags what needs attention before you ask — stock about to run
              out, items priced below cost, a quiet week — and can even prepare
              the work: draft a purchase order, tidy your catalogue, harmonise a
              messy import. Nothing changes until you approve it.
            </p>
            <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
              Bring your own model — free tiers from Groq or OpenRouter handle
              daily work; plug in GPT-4o or Claude if you prefer. We never see
              your prompts; calls go direct from your machine to your provider.
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
                    What should I reorder this week, and how much?
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-3 mr-8">
                  <div className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-accent)]">
                    Omnix
                  </div>
                  <p className="mt-1 text-[14px] leading-[1.6] text-[var(--color-fg)]">
                    Three items will run out within a week at your current pace:
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg)]">
                    Amoxicillin (~3 days left, order 180), Panadol Extra (~5 days,
                    order 120), Zinc 20mg (~6 days, order 90) — all from Dawa Ltd,
                    your usual supplier.
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                    Want me to draft the purchase order?
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Draft the PO', 'Review first', 'Adjust quantities'].map((chip) => (
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
              Real data · real actions · your model · your keys
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
