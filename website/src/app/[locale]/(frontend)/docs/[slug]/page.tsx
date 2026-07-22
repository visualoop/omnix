/* Hallmark · Working Counter · documentation article */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowLeft, Icon } from '@/components/icons'
import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { DOCS_SEED, docBySlug, docSlugs } from '@/lib/docs-seed'
import { isDocPlaceholder, isLegacyExcludedDocSlug, isPublishedDoc } from '@/lib/docs-visibility'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export const dynamicParams = false

export function generateStaticParams() {
  return docSlugs()
    .filter((slug) => !isLegacyExcludedDocSlug(slug))
    .map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const doc = docBySlug(slug)
  if (!doc) {
    return { title: 'Doc not found', robots: { index: false, follow: false } }
  }
  // Legacy docs retired from the public surface keep their route for old
  // links but must never be indexed and must not expose their old
  // title/excerpt — treat them exactly like an unknown doc for metadata.
  if (isLegacyExcludedDocSlug(slug)) {
    return { title: 'Doc not found', robots: { index: false, follow: false } }
  }
  // Placeholder scaffolds keep their route but must never be indexed.
  if (isDocPlaceholder(doc)) {
    return {
      title: `${doc.title} — Omnix docs`,
      description: doc.excerpt,
      robots: { index: false, follow: true },
    }
  }
  const canonical = `${SITE_URL}/${locale}/docs/${doc.slug}`
  return {
    title: `${doc.title} — Omnix docs`,
    description: doc.excerpt,
    alternates: {
      canonical,
      languages: buildAlternatesLanguages(`/docs/${doc.slug}`),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: `${doc.title} — Omnix docs`,
      description: doc.excerpt,
      type: 'article',
    }),
  }
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const [{ locale, slug }, settings] = await Promise.all([params, getSiteSettings()])
  const doc = docBySlug(slug)
  if (!doc) notFound()

  // Legacy public exclusion: this doc was retired from the public surface.
  // Fail closed — do not render its title/excerpt/body; behave as if the
  // route does not exist (generateMetadata already returns generic noindex).
  if (isLegacyExcludedDocSlug(slug)) notFound()

  const docsHref = `/${locale}/docs`
  const demoHref = `/${locale}/contact?type=demo`

  // Placeholder scaffold: show an honest "being written" state instead of
  // the raw TODO body, and (via generateMetadata) keep it out of the index.
  if (isDocPlaceholder(doc)) {
    return (
      <article className="min-w-0 border-b border-[var(--color-border)]">
        <PageContainer width="text" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
          <Link
            href={docsHref}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5" weight="bold" />
            All docs
          </Link>
          <div className="mt-10 border-t-2 border-[var(--color-fg)] pt-8">
            <p className="caption-mono text-[var(--color-accent)]">{doc.category}</p>
            <h1 className="mt-4 max-w-[18ch] text-balance text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.0] tracking-[-0.045em] text-[var(--color-fg)]">
              {doc.title}
            </h1>
            <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.7] text-[var(--color-fg-muted)]">
              This guide is being written. Rather than publish a placeholder, we&rsquo;ve left it
              out of search until it&rsquo;s genuinely useful. {doc.excerpt}
            </p>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.7] text-[var(--color-fg-muted)]">
              Need this now? Book a demo and we&rsquo;ll walk you through it, or email{' '}
              <a
                className="underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                href={`mailto:${settings.supportEmail}`}
              >
                {settings.supportEmail}
              </a>
              .
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a demo</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={docsHref}>Browse all docs</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </article>
    )
  }

  const blocks = doc.body.split('\n\n').map((b) => b.trim()).filter(Boolean)
  const headings = blocks.filter((b) => b.startsWith('## ')).map((b) => b.slice(3))

  // Related = other published docs in the same category (placeholder scaffolds
  // and legacy-excluded docs are filtered out by isPublishedDoc).
  const related = DOCS_SEED.filter(
    (d) => d.category === doc.category && d.slug !== slug && isPublishedDoc(d),
  ).slice(0, 4)

  return (
    <article className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        <Link
          href={docsHref}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          All docs
        </Link>

        <div className="mt-10 grid min-w-0 grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          {/* Article */}
          <article className="min-w-0 max-w-[72ch]">
            <header className="border-b border-[var(--color-border)] pb-8">
              <p className="caption-mono text-[var(--color-accent)]">{doc.category}</p>
              <h1 className="mt-4 max-w-[20ch] text-balance text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--color-fg)]">
                {doc.title}
              </h1>
              <p className="mt-5 max-w-[60ch] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.6] text-[var(--color-fg-muted)]">
                {doc.excerpt}
              </p>
            </header>

            <div className="mt-8">
              {blocks.map((block, i) => {
                if (block.startsWith('## ')) {
                  const text = block.slice(3)
                  return (
                    <h2
                      key={i}
                      id={slugifyHeading(text)}
                      className="mt-11 scroll-mt-24 text-[clamp(1.4rem,2.4vw,1.85rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--color-fg)]"
                    >
                      {renderInline(text, locale)}
                    </h2>
                  )
                }
                if (block.startsWith('- ')) {
                  return (
                    <ul key={i} className="my-5 list-disc space-y-2 pl-6 text-[15px] leading-[1.75] text-[var(--color-fg-muted)] marker:text-[var(--color-border-strong)]">
                      {block.split('\n').map((line, j) => (
                        <li key={j}>{renderInline(line.replace(/^- /, ''), locale)}</li>
                      ))}
                    </ul>
                  )
                }
                return (
                  <p key={i} className="my-5 text-[15px] leading-[1.8] text-[var(--color-fg-muted)]">
                    {renderInline(block, locale)}
                  </p>
                )
              })}
            </div>

            {/* Was this helpful — demo-led, no card shadow */}
            <div className="mt-14 border-t-2 border-[var(--color-fg)] pt-8">
              <h2 className="text-[clamp(1.3rem,2.4vw,1.75rem)] font-semibold leading-none tracking-[-0.035em] text-[var(--color-fg)]">
                Something missing?
              </h2>
              <p className="mt-4 max-w-[58ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
                If a step is wrong or unclear, tell us — we update the docs when a real question
                comes in. Book a demo for a walkthrough, or email{' '}
                <a
                  className="underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
                  href={`mailto:${settings.supportEmail}`}
                >
                  {settings.supportEmail}
                </a>
                .
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href={demoHref}>Book a demo</Link>
                </Button>
                {settings.whatsappUrl ? (
                  <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                    <a
                      href={`${settings.whatsappUrl}${settings.whatsappUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent(`Hi Omnix, I have a question about the ${doc.title} guide.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ask on WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* More in category */}
            {related.length > 0 ? (
              <div className="mt-12 border-t border-[var(--color-border)] pt-10">
                <h2 className="text-[15px] font-semibold uppercase tracking-[0.02em] text-[var(--color-fg)]">
                  More in {doc.category}
                </h2>
                <ol className="mt-5 min-w-0">
                  {related.map((d) => (
                    <li key={d.slug} className="min-w-0 border-t border-[var(--color-border)] first:border-t-0">
                      <Link
                        href={`/${locale}/docs/${d.slug}`}
                        className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-4"
                      >
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold leading-[1.3] text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
                            {d.title}
                          </h3>
                          <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
                            {d.excerpt}
                          </p>
                        </div>
                        <Icon.ArrowRight
                          className="mt-1 size-4 shrink-0 text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]"
                          weight="bold"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </article>

          {/* On-this-page rail */}
          {headings.length > 0 ? (
            <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:h-fit">
              <nav aria-label="On this page">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                  On this page
                </p>
                <ol className="mt-4 space-y-1 border-l border-[var(--color-border)]">
                  {headings.map((h) => (
                    <li key={h}>
                      <a
                        href={`#${slugifyHeading(h)}`}
                        className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[13px] leading-5 text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
                      >
                        {h}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          ) : null}
        </div>
      </PageContainer>
    </article>
  )
}

function renderInline(text: string, locale: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  // Match bold, inline code, or a markdown link.
  const regex = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g
  const linkClass =
    'text-[var(--color-accent)] underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]'
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>)
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--color-fg)]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="rounded-[var(--radius-xs)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--color-fg)]"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      const label = link?.[1] ?? token
      const url = link?.[2] ?? ''
      if (/^https?:\/\//.test(url)) {
        nodes.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {label}
          </a>,
        )
      } else if (url.startsWith('/')) {
        // Keep internal links inside the active locale.
        nodes.push(
          <Link key={key++} href={`/${locale}${url}`} className={linkClass}>
            {label}
          </Link>,
        )
      } else {
        nodes.push(<span key={key++}>{label}</span>)
      }
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>)
  }
  return nodes
}
