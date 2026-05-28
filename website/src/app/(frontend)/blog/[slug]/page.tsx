import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from '@/components/icons'
import { Container } from '@/components/ui/section'
import { POSTS_SEED, postBySlug, postSlugs, relatedPosts } from '@/lib/blog-seed'

const CATEGORY_LABEL = {
  product: 'Product',
  industry: 'Industry',
  tutorial: 'Tutorial',
  announcement: 'Announcement',
} as const

export async function generateStaticParams() {
  return postSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = postBySlug(slug)
  if (!post) return { title: 'Post not found' }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = postBySlug(slug)
  if (!post) notFound()

  const related = relatedPosts(slug, 3)

  // Tiny markdown-ish parser: split paragraphs, recognise **bold** and ## headers
  const blocks = post.body.split('\n\n').map((block) => block.trim()).filter(Boolean)

  return (
    <>
      <article className="pt-28 sm:pt-32">
        <Container width="default">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5" />
            All articles
          </Link>

          <div className="mt-10 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-[var(--color-accent-hover)]">
                {CATEGORY_LABEL[post.category]}
              </span>
              <time className="text-[var(--color-fg-subtle)]">{post.publishedAt}</time>
              <span className="text-[var(--color-border-strong)]">·</span>
              <span className="text-[var(--color-fg-subtle)]">{post.readTime} min read</span>
            </div>
            <h1 className="text-balance font-display text-[clamp(36px,5vw,72px)] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-fg)]">
              {post.title}
            </h1>
            <p className="max-w-2xl text-balance text-[18px] leading-[1.55] text-[var(--color-fg-muted)] sm:text-[20px]">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-3 text-[13px] text-[var(--color-fg-subtle)]">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-[12px] font-semibold text-[var(--color-accent-hover)]">
                {post.author
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="text-[var(--color-fg)]">{post.author}</span>
            </div>
          </div>
        </Container>

        {/* Hero placeholder visual */}
        <Container width="default" className="mt-14">
          <div className="relative aspect-[16/8] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[radial-gradient(60%_60%_at_50%_30%,var(--color-accent-soft),transparent_70%)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="font-display text-[140px] font-medium leading-none text-[var(--color-accent)] opacity-25 sm:text-[200px]">
                D
              </div>
            </div>
          </div>
        </Container>

        {/* Body */}
        <Container width="narrow" className="mt-14 mb-24">
          <div className="prose prose-invert max-w-none">
            {blocks.map((block, i) => {
              if (block.startsWith('## ')) {
                return (
                  <h2
                    key={i}
                    className="mt-12 font-display text-[28px] font-medium leading-tight text-[var(--color-fg)]"
                  >
                    {renderInline(block.slice(3))}
                  </h2>
                )
              }
              if (block.startsWith('- ')) {
                return (
                  <ul key={i} className="my-5 list-disc space-y-2 pl-6 text-[17px] leading-[1.7] text-[var(--color-fg-muted)]">
                    {block.split('\n').map((line, j) => (
                      <li key={j}>{renderInline(line.replace(/^- /, ''))}</li>
                    ))}
                  </ul>
                )
              }
              return (
                <p
                  key={i}
                  className="my-5 text-[17px] leading-[1.7] text-[var(--color-fg-muted)]"
                >
                  {renderInline(block)}
                </p>
              )
            })}
          </div>
        </Container>
      </article>

      {/* Related posts */}
      {related.length > 0 ? (
        <section className="border-t border-[var(--color-border)] py-20">
          <Container width="wide">
            <h2 className="font-display text-[24px] font-medium text-[var(--color-fg)] sm:text-[28px]">
              Read next
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]"
                >
                  <span className="inline-flex w-fit rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-hover)]">
                    {CATEGORY_LABEL[p.category]}
                  </span>
                  <h3 className="font-display text-[18px] font-medium leading-tight text-[var(--color-fg)]">
                    {p.title}
                  </h3>
                  <p className="text-[13px] leading-[1.5] text-[var(--color-fg-muted)]">
                    {p.excerpt}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-accent)]">
                    Read article
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  )
}

function renderInline(text: string): React.ReactNode {
  // Replace **text** with <strong>
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
