import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from '@/components/icons'
import { Container } from '@/components/ui/section'
import { DOCS_SEED, docBySlug, docSlugs } from '@/lib/docs-seed'

export async function generateStaticParams() {
  return docSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc = docBySlug(slug)
  if (!doc) return { title: 'Doc not found' }
  return {
    title: `${doc.title} — docs`,
    description: doc.excerpt,
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = docBySlug(slug)
  if (!doc) notFound()

  const blocks = doc.body.split('\n\n').map((b) => b.trim()).filter(Boolean)
  const headings = blocks.filter((b) => b.startsWith('## ')).map((b) => b.slice(3))

  // Show 3 next docs from same category
  const others = DOCS_SEED.filter((d) => d.category === doc.category && d.slug !== slug).slice(0, 3)

  return (
    <article className="pt-28 sm:pt-32">
      <Container width="wide">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-3.5" />
          All docs
        </Link>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_220px] lg:gap-16">
          {/* Body */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {doc.category}
            </div>
            <h1 className="mt-4 text-balance font-display text-[clamp(32px,4vw,52px)] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--color-fg)]">
              {doc.title}
            </h1>
            <p className="mt-4 max-w-2xl text-balance text-[18px] leading-[1.55] text-[var(--color-fg-muted)]">
              {doc.excerpt}
            </p>

            <div className="prose prose-invert mt-12 max-w-none">
              {blocks.map((block, i) => {
                if (block.startsWith('## ')) {
                  const text = block.slice(3)
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  return (
                    <h2
                      key={i}
                      id={id}
                      className="mt-12 scroll-mt-24 font-display text-[24px] font-medium leading-tight text-[var(--color-fg)] sm:text-[28px]"
                    >
                      {text}
                    </h2>
                  )
                }
                if (block.startsWith('- ')) {
                  return (
                    <ul key={i} className="my-5 list-disc space-y-2 pl-6 text-[16px] leading-[1.7] text-[var(--color-fg-muted)]">
                      {block.split('\n').map((line, j) => (
                        <li key={j}>{renderInline(line.replace(/^- /, ''))}</li>
                      ))}
                    </ul>
                  )
                }
                return (
                  <p
                    key={i}
                    className="my-5 text-[16px] leading-[1.7] text-[var(--color-fg-muted)]"
                  >
                    {renderInline(block)}
                  </p>
                )
              })}
            </div>

            {/* Was this helpful? */}
            <div className="mt-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                Was this helpful?
              </h3>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                If something is wrong or missing, WhatsApp the owner. We update the docs every
                time a real question comes in.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="https://wa.me/254700000000"
                  className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-[12px] font-medium text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)]"
                >
                  WhatsApp the owner
                </a>
                <a
                  href="mailto:support@omnix.co.ke"
                  className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-[12px] font-medium text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)]"
                >
                  Email support
                </a>
              </div>
            </div>

            {/* Related */}
            {others.length > 0 ? (
              <div className="mt-16 border-t border-[var(--color-border)] pt-12">
                <h3 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
                  More in {doc.category}
                </h3>
                <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {others.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/docs/${d.slug}`}
                        className="group flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-border-strong)]"
                      >
                        <h4 className="font-display text-[16px] font-medium text-[var(--color-fg)]">
                          {d.title}
                        </h4>
                        <p className="text-[12px] leading-[1.45] text-[var(--color-fg-muted)]">
                          {d.excerpt}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Right rail TOC */}
          {headings.length > 0 ? (
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                On this page
              </div>
              <ul className="mt-4 space-y-2 border-l border-[var(--color-border)] pl-4 text-[12px]">
                {headings.map((h) => {
                  const id = h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  return (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
                      >
                        {h}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </aside>
          ) : null}
        </div>
      </Container>
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
