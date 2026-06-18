import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Blog — notes from the studio',
  description: 'Updates, case studies, and notes on building software for Kenyan businesses.',
}

const POSTS = [
  { slug: 'why-offline-first', title: 'Why offline-first is not a feature', date: '2026-05-20', category: 'Process', excerpt: 'In a country where the line drops, offline-first is the only honest architecture.' },
  { slug: 'pharmacy-compliance', title: 'Building for PPB compliance', date: '2026-04-15', category: 'Case Studies', excerpt: 'How we built the controlled-drug ledger that pharmacists actually use.' },
  { slug: 'one-time-pricing', title: 'Why we charge once', date: '2026-03-10', category: 'Notes', excerpt: 'Subscriptions optimise for the seller, not the buyer. We sell software the way Office used to be sold.' },
]

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title={<>Notes from <em>the studio.</em></>}
        description="Updates, case studies, and notes on building software for Kenyan businesses."
      />

      <section className="section">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-accent)]">
                <div className="caption-mono">{post.date} · {post.category}</div>
                <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal leading-tight text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">{post.title}</h3>
                <p className="text-[15px] text-[var(--color-fg-muted)]">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
