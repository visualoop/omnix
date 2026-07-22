/* Hallmark · Working Counter · editorial index · notes from building Omnix */
import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { publishedPosts, type BlogPostSeed } from '@/lib/blog-seed'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

const CATEGORY_LABEL: Record<BlogPostSeed['category'], string> = {
  product: 'Product',
  industry: 'Industry',
  tutorial: 'Tutorial',
  announcement: 'Announcement',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/blog`
  return {
    title: 'Blog — notes from building Omnix',
    description:
      'Field notes on building offline-first business software for Kenyan trades: compliance changes, product decisions, and how the parts of Omnix actually work.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/blog'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Notes from building Omnix',
      description:
        'Compliance changes, product decisions, and how the parts of Omnix work — written for the people running the counter.',
      type: 'website',
    }),
  }
}

function formatPublished(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const demoHref = `/${locale}/contact?type=demo`

  // Only explicitly reviewed articles enter the public index. Draft legacy
  // seeds remain unavailable to links, static params, and metadata.
  const posts = publishedPosts().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const [lead, ...rest] = posts

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        {/* Masthead */}
        <header className="grid min-w-0 gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div className="min-w-0">
            <p className="caption-mono text-[var(--color-accent)]">Field notes</p>
            <h1 className="mt-4 max-w-[15ch] text-balance text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--color-fg)]">
              Notes from building Omnix.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              Compliance changes, product decisions, and how the parts of Omnix actually work — for
              the people running the counter, not the ones selling to it.
            </p>
            <div className="mt-6">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a demo</Link>
              </Button>
            </div>
          </div>
        </header>

        {posts.length === 0 ? (
          <p className="py-16 text-[15px] leading-7 text-[var(--color-fg-muted)]">
            No articles yet. Check back soon, or{' '}
            <Link className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]" href={demoHref}>
              book a demo
            </Link>{' '}
            to talk to us directly.
          </p>
        ) : (
          <>
            {/* Lead article */}
            <Link
              href={`/${locale}/blog/${lead.slug}`}
              className="group grid min-w-0 gap-5 border-b border-[var(--color-border)] py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                  <span className="text-[var(--color-accent)]">Latest</span>
                  <span aria-hidden>·</span>
                  <span>{CATEGORY_LABEL[lead.category]}</span>
                </p>
                <h2 className="mt-4 max-w-[18ch] text-balance text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                  {lead.title}
                </h2>
              </div>
              <div className="min-w-0 lg:pt-1">
                <p className="max-w-[56ch] text-[16px] leading-[1.7] text-[var(--color-fg-muted)]">
                  {lead.excerpt}
                </p>
                <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-fg-subtle)]">
                  <span className="text-[var(--color-fg-muted)]">{lead.author}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={lead.publishedAt}>{formatPublished(lead.publishedAt)}</time>
                  <span aria-hidden>·</span>
                  <span>{lead.readTime} min read</span>
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                  Read article
                  <Icon.ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" weight="bold" />
                </span>
              </div>
            </Link>

            {/* Index of the rest — editorial rows, not a card grid */}
            {rest.length > 0 ? (
              <ol className="min-w-0">
                {rest.map((post) => (
                  <li key={post.slug} className="min-w-0 border-b border-[var(--color-border)]">
                    <Link
                      href={`/${locale}/blog/${post.slug}`}
                      className="group grid min-w-0 items-baseline gap-2 py-7 sm:py-8 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-10"
                    >
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] lg:flex-col lg:items-start lg:gap-1">
                        <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
                        <span aria-hidden className="lg:hidden">·</span>
                        <span className="text-[var(--color-accent)]">{CATEGORY_LABEL[post.category]}</span>
                      </p>
                      <div className="min-w-0">
                        <h3 className="max-w-[28ch] text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                          {post.title}
                        </h3>
                        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
                          {post.excerpt}
                        </p>
                        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                          {post.author} · {post.readTime} min read
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}
      </PageContainer>
    </div>
  )
}
