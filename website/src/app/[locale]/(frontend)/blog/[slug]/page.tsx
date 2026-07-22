/* Hallmark · Working Counter · long-form article */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowLeft, Icon } from '@/components/icons'
import { PageContainer } from '@/components/layout/layout-primitives'
import { ArticleJsonLd } from '@/components/seo/jsonld'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { postBySlug, postSlugs, relatedPosts, type BlogPostSeed } from '@/lib/blog-seed'

export const dynamicParams = false

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

const CATEGORY_LABEL: Record<BlogPostSeed['category'], string> = {
  product: 'Product',
  industry: 'Industry',
  tutorial: 'Tutorial',
  announcement: 'Announcement',
}

export function generateStaticParams() {
  return postSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const post = postBySlug(slug)
  if (!post) {
    return { title: 'Post not found', robots: { index: false, follow: false } }
  }
  const canonical = `${SITE_URL}/${locale}/blog/${post.slug}`
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical,
      languages: buildAlternatesLanguages(`/blog/${post.slug}`),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
    }),
  }
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatPublished(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const post = postBySlug(slug)
  if (!post) notFound()

  const related = relatedPosts(slug, 3)
  const blocks = post.body.split('\n\n').map((block) => block.trim()).filter(Boolean)

  return (
    <article className="min-w-0 border-b border-[var(--color-border)]">
      <ArticleJsonLd
        headline={post.title}
        description={post.excerpt}
        url={`${SITE_URL}/${locale}/blog/${post.slug}`}
        datePublished={post.publishedAt}
      />

      <article className="min-w-0">
        <PageContainer width="text" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5" weight="bold" />
            All articles
          </Link>

          <header className="mt-8 border-b border-[var(--color-border)] pb-10">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              <span className="text-[var(--color-accent)]">{CATEGORY_LABEL[post.category]}</span>
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
              <span aria-hidden>·</span>
              <span>{post.readTime} min read</span>
            </p>
            <h1 className="mt-5 max-w-[20ch] text-balance text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.0] tracking-[-0.045em] text-[var(--color-fg)]">
              {post.title}
            </h1>
            <p className="mt-6 max-w-[60ch] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.6] text-[var(--color-fg-muted)]">
              {post.excerpt}
            </p>
            <p className="mt-6 text-[13px] text-[var(--color-fg-subtle)]">
              By <span className="text-[var(--color-fg)]">{post.author}</span>
            </p>
          </header>

          {/* Body */}
          <div className="mt-10">
            {blocks.map((block, i) => {
              if (block.startsWith('## ')) {
                const text = block.slice(3)
                return (
                  <h2
                    key={i}
                    id={slugifyHeading(text)}
                    className="mt-12 scroll-mt-24 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--color-fg)]"
                  >
                    {renderInline(text)}
                  </h2>
                )
              }
              if (block.startsWith('- ')) {
                return (
                  <ul key={i} className="my-6 list-disc space-y-2 pl-6 text-[16px] leading-[1.75] text-[var(--color-fg-muted)] marker:text-[var(--color-border-strong)]">
                    {block.split('\n').map((line, j) => (
                      <li key={j}>{renderInline(line.replace(/^- /, ''))}</li>
                    ))}
                  </ul>
                )
              }
              return (
                <p key={i} className="my-6 text-[16px] leading-[1.8] text-[var(--color-fg-muted)]">
                  {renderInline(block)}
                </p>
              )
            })}
          </div>
        </PageContainer>

        {/* Read next */}
        {related.length > 0 ? (
          <PageContainer width="wide" className="border-t border-[var(--color-border)] py-14 sm:py-16">
            <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-semibold leading-none tracking-[-0.04em] text-[var(--color-fg)]">
              Read next
            </h2>
            <ol className="mt-8 min-w-0">
              {related.map((p) => (
                <li key={p.slug} className="min-w-0 border-t border-[var(--color-border)] first:border-t-0">
                  <Link
                    href={`/${locale}/blog/${p.slug}`}
                    className="group grid min-w-0 items-baseline gap-2 py-6 lg:grid-cols-[9rem_minmax(0,1fr)_auto] lg:gap-8"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)]">
                      {CATEGORY_LABEL[p.category]}
                    </span>
                    <div className="min-w-0">
                      <h3 className="max-w-[36ch] text-[clamp(1.05rem,1.8vw,1.375rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                        {p.title}
                      </h3>
                      <p className="mt-1.5 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--color-fg-muted)]">
                        {p.excerpt}
                      </p>
                    </div>
                    <Icon.ArrowRight
                      className="hidden size-4 self-center text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)] lg:block"
                      weight="bold"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </PageContainer>
        ) : null}
      </article>
    </article>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-fg)]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}
