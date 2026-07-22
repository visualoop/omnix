/* Hallmark · Working Counter · documentation index */
import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { DOCS_SEED, type DocSeed } from '@/lib/docs-seed'
import { isPublishedDoc } from '@/lib/docs-visibility'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

// Category display order. Only categories that have at least one published
// (non-placeholder) doc are rendered.
const CATEGORY_ORDER: DocSeed['category'][] = [
  'Basics',
  'Core',
  'Modules',
  'Integrations',
  'Billing',
  'Troubleshooting',
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/docs`
  return {
    title: 'Documentation — Omnix',
    description:
      'Step-by-step guides for running Omnix: installation and setup, point of sale, inventory, M-Pesa and KRA eTIMS, backups, and filings.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/docs'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix documentation',
      description:
        'Guides for installation, POS, inventory, M-Pesa, KRA eTIMS, backups, and filings — written from the way the app actually works.',
      type: 'website',
    }),
  }
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const demoHref = `/${locale}/contact?type=demo`

  // Only published docs are surfaced. Scaffolds (still marked "TODO: document
  // this.") keep their route but are never listed or indexed here.
  const published = DOCS_SEED.filter(isPublishedDoc)
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    docs: published.filter((d) => d.category === category),
  })).filter((group) => group.docs.length > 0)

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        {/* Masthead */}
        <header className="grid min-w-0 gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div className="min-w-0">
            <p className="caption-mono text-[var(--color-accent)]">Documentation</p>
            <h1 className="mt-4 max-w-[16ch] text-balance text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--color-fg)]">
              Everything you need to run Omnix.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              Practical guides written the way the app behaves — from installing and ringing your
              first sale to M-Pesa, KRA eTIMS, backups, and month-end filings.
            </p>
            <div className="mt-6">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a demo</Link>
              </Button>
            </div>
          </div>
        </header>

        {groups.length === 0 ? (
          <p className="py-16 text-[15px] leading-7 text-[var(--color-fg-muted)]">
            Guides are being written. In the meantime,{' '}
            <Link className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]" href={demoHref}>
              book a demo
            </Link>{' '}
            and we&rsquo;ll walk you through it.
          </p>
        ) : (
          <div className="min-w-0">
            {groups.map((group) => (
              <section
                key={group.category}
                aria-labelledby={`docs-${group.category.toLowerCase()}`}
                className="grid min-w-0 gap-6 border-b border-[var(--color-border)] py-10 sm:py-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16"
              >
                <div className="min-w-0">
                  <h2
                    id={`docs-${group.category.toLowerCase()}`}
                    className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-none tracking-[-0.04em] text-[var(--color-fg)] lg:sticky lg:top-24"
                  >
                    {group.category}
                  </h2>
                </div>
                <ol className="min-w-0">
                  {group.docs.map((doc) => (
                    <li key={doc.slug} className="min-w-0 border-t border-[var(--color-border)] first:border-t-0">
                      <Link
                        href={`/${locale}/docs/${doc.slug}`}
                        className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5"
                      >
                        <div className="min-w-0">
                          <h3 className="text-[clamp(1.05rem,1.8vw,1.3rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                            {doc.title}
                          </h3>
                          <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                            {doc.excerpt}
                          </p>
                        </div>
                        <Icon.ArrowRight
                          className="mt-1.5 size-4 shrink-0 text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]"
                          weight="bold"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  )
}
