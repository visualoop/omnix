/* Hallmark · Working Counter · legal ledger · plain-spoken and evidence-led
 *
 * Shared template for /terms, /privacy, /refund-policy.
 *
 * Redesign notes (Task 16):
 *   - No decorative glow behind the masthead — an editorial header built from
 *     the shared type utilities instead of the old marketing hero.
 *   - No decorative "01." numbering on the table of contents or headings.
 *     Numbers were ornament, not information; they are gone.
 *   - Locale-aware: the "Talk to us" route resolves to /{locale}/contact so
 *     the legal pages honour the country routing like every other page.
 *   - Long-form copy sits in a readable measure with a sticky contents rail
 *     for navigation, and each section is a real landmark for screen readers.
 */
import Link from 'next/link'

import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'

export interface LegalSection {
  id: string
  heading: string
  body: React.ReactNode
}

interface LegalLayoutProps {
  /** Short, specific kicker (never the generic word "Legal" across pages). */
  kicker: string
  title: React.ReactNode
  description?: React.ReactNode
  /** ISO date string, rendered as a machine-readable <time>. */
  lastUpdated: string
  locale: string
  supportEmail: string
  sections: LegalSection[]
}

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function LegalLayout({
  kicker,
  title,
  description,
  lastUpdated,
  locale,
  supportEmail,
  sections,
}: LegalLayoutProps) {
  const contactHref = `/${locale}/contact`

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer
        width="wide"
        className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]"
      >
        {/* Masthead */}
        <header className="grid min-w-0 gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div className="min-w-0">
            <p className="caption-mono text-[var(--color-accent)]">{kicker}</p>
            <h1 className="mt-4 max-w-[16ch] text-balance text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--color-fg)]">
              {title}
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            {description ? (
              <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
                {description}
              </p>
            ) : null}
            <p className="mt-5">
              <time
                dateTime={lastUpdated}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]"
              >
                Last updated · {formatUpdated(lastUpdated)}
              </time>
            </p>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-12 py-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 lg:py-16">
          {/* Sticky contents rail */}
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:h-fit">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              Contents
            </p>
            <ol className="mt-4 space-y-1 border-l border-[var(--color-border)]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[13px] leading-5 text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-8 hidden lg:block">
              <Link
                href={contactHref}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              >
                Questions? Talk to us →
              </Link>
            </div>
          </nav>

          {/* Body */}
          <article className="min-w-0 max-w-[68ch]">
            {sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className={
                  i === 0
                    ? 'scroll-mt-24'
                    : 'mt-12 scroll-mt-24 border-t border-[var(--color-border)] pt-12'
                }
              >
                <h2
                  id={`${section.id}-heading`}
                  className="text-[clamp(1.35rem,2.6vw,1.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--color-fg)]"
                >
                  {section.heading}
                </h2>
                <div className="mt-5 space-y-4 text-[15px] leading-[1.75] text-[var(--color-fg-muted)] [&_a]:underline [&_a]:decoration-[var(--color-border-strong)] [&_a]:underline-offset-4 hover:[&_a]:decoration-[var(--color-accent)] [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-[var(--color-fg)] [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                  {section.body}
                </div>
              </section>
            ))}
          </article>
        </div>

        {/* Closing help block — demo-led, no gradient, no card shadow */}
        <section
          aria-labelledby="legal-help-heading"
          className="grid min-w-0 gap-6 border-t-2 border-[var(--color-fg)] py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:py-12"
        >
          <div className="min-w-0">
            <h2
              id="legal-help-heading"
              className="text-[clamp(1.5rem,3.5vw,2.4rem)] leading-none tracking-[-0.04em] text-[var(--color-fg)]"
            >
              Still have a question?
            </h2>
            <p className="mt-4 max-w-[60ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
              Bring it to a demo, or email{' '}
              <a
                className="underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
              . We answer plainly, and we update this page whenever the answer changes.
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href={`${contactHref}?type=demo`}>Book a demo</Link>
          </Button>
        </section>
      </PageContainer>
    </div>
  )
}
