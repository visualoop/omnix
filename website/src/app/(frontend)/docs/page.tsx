import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'
import { DOCS_SEED } from '@/lib/docs-seed'

export const metadata: Metadata = {
  title: 'Documentation — learn Omnix',
  description: 'Step-by-step guides for every feature. Installation, POS, inventory, payroll, KRA filings.',
}

// Source of truth is DOCS_SEED — guarantees every card links to a real doc.
const CATEGORY_ORDER = ['Basics', 'Core', 'Modules', 'Integrations', 'Billing', 'Troubleshooting'] as const

export default function DocsPage() {
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    docs: DOCS_SEED.filter((d) => d.category === cat),
  })).filter((g) => g.docs.length > 0)

  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title={<>Learn <em>Omnix.</em></>}
        description="Step-by-step guides for every feature. Installation, POS, inventory, payroll, KRA filings."
      />

      <section className="section">
        <div className="container-default space-y-14">
          {byCategory.map((group) => (
            <div key={group.category}>
              <div className="caption-mono mb-5">{group.category}</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.docs.map((doc) => (
                  <Link key={doc.slug} href={`/docs/${doc.slug}`} className="group flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-accent)]">
                    <Icon.BookOpen className="size-6 shrink-0 text-[var(--color-accent)]" weight="bold" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-[family-name:var(--font-display)] text-[18px] font-normal text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">{doc.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-snug text-[var(--color-fg-muted)]">{doc.excerpt}</p>
                    </div>
                    <Icon.ArrowRight className="size-4 shrink-0 text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" weight="bold" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
