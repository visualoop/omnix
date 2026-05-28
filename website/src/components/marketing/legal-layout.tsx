import Link from 'next/link'
import { Container } from '@/components/ui/section'
import { PageHero } from '@/components/marketing/page-hero'
import { cn } from '@/lib/cn'

export interface LegalSection {
  id: string
  heading: string
  body: React.ReactNode
}

interface LegalLayoutProps {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  lastUpdated: string
  sections: LegalSection[]
}

/**
 * Shared template for /privacy, /terms, /refund-policy.
 * Sticky table of contents on desktop, simple scroll on mobile.
 */
export function LegalLayout({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: LegalLayoutProps) {
  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
      >
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          Last updated · {lastUpdated}
        </p>
      </PageHero>

      <section className="py-16 sm:py-20 lg:py-24">
        <Container width="wide">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr] lg:gap-16">
            {/* Sticky TOC */}
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Contents
              </div>
              <ol className="mt-4 space-y-2 text-[13px]">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-baseline gap-3 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-subtle)]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>

              <div className="mt-10 hidden text-[12px] text-[var(--color-fg-subtle)] lg:block">
                <Link
                  href="/contact"
                  className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                >
                  Questions? Get in touch →
                </Link>
              </div>
            </aside>

            {/* Body */}
            <article className="max-w-3xl">
              {sections.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  className={cn(
                    'scroll-mt-24',
                    i === 0 ? '' : 'mt-14 border-t border-[var(--color-border)] pt-14',
                  )}
                >
                  <h2 className="font-display text-[28px] font-medium leading-tight text-[var(--color-fg)] sm:text-[32px]">
                    <span className="mr-3 font-mono text-[14px] font-semibold tabular-nums text-[var(--color-accent)]">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    {section.heading}
                  </h2>
                  <div className="prose-legal mt-6 space-y-4 text-[15px] leading-[1.7] text-[var(--color-fg-muted)]">
                    {section.body}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </Container>
      </section>
    </>
  )
}
