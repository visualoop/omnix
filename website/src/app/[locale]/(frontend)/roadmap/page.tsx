import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: 'Roadmap — what we\'re building next',
  description:
    'The public Omnix roadmap. Shipped recently, in progress now, and exploring. No calendar dates — we ship when it\'s right.',
}

interface Item { title: string; body: string; tag?: 'shipped' | 'in_progress' | 'exploring' }
const SHIPPED: Item[] = [
  { title: 'AI business partner (v0.15)', body: 'Insight engine + ask-your-data tools + confirmed write-actions + dedicated /ai workspace. AI moves from concierge to working employee.' },
  { title: 'Module identity refresh (v0.14)', body: 'Each trade (Dawa, Retail, Hardware, Hospitality) gets its own accent identity across the desktop app — distinct but disciplined.' },
  { title: 'Transactional sales & voids (v0.14)', body: 'Every sale, void and refund is all-or-nothing; integer-cents money end to end so receipts and reports always reconcile.' },
  { title: 'M-Pesa sandbox auto-confirm', body: 'Test the till flow end to end even when Safaricom\'s sandbox doesn\'t deliver a callback. Production payments are untouched.' },
]
const IN_PROGRESS: Item[] = [
  { title: 'Industry pages on the website', body: 'Dedicated pages for pharmacies, retail, restaurants, hardware and multi-branch operators with workflows, screenshots, and trade-specific proof.' },
  { title: 'AI vision ingestion', body: 'Drop a photo of a supplier invoice; Omnix drafts the goods-received note for review and approval.' },
  { title: 'Per-trade AI playbooks', body: 'Proactive insights tuned to each trade — a pharmacist sees expiry & AMR; a restaurateur sees food cost & ingredient demand.' },
]
const EXPLORING: Item[] = [
  { title: 'Demand forecasting', body: 'Explainable, deterministic forecasts for ingredient demand, medicine shortages and fast-moving SKUs.' },
  { title: 'Local embeddings + RAG', body: 'Semantic search across your own data and the Omnix docs, fully offline through a local Ollama model.' },
  { title: 'Vertical extensions', body: 'Electronics (IMEI / warranty / repairs), salon & spa (appointments, commissions). Driven by demand, not assumption.' },
]

function Column({ title, dot, items }: { title: string; dot: string; items: Item[] }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <h2 className="font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">{title}</h2>
      </div>
      <ul className="mt-6 space-y-5">
        {items.map((i) => (
          <li key={i.title} className="border-l border-[var(--color-border-strong)] pl-5">
            <h3 className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[var(--color-fg)]">{i.title}</h3>
            <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[44ch]">{i.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function RoadmapPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="Public roadmap"
        title={<>What we&rsquo;re <em>building next.</em></>}
        description="The honest version: shipped, in progress, exploring. No calendar promises — we ship when it's right. The list moves as the business does."
      >
        <div className="mt-6 flex items-center gap-4">
          <Button asChild size="lg">
            <Link href="/changelog">See what just shipped</Link>
          </Button>
          <Link href="/contact" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            Request a feature <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </PageHero>

      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-3 md:gap-10 lg:gap-16">
            <Column title="Shipped recently" dot="bg-[var(--color-positive)]" items={SHIPPED} />
            <Column title="In progress" dot="bg-[var(--color-accent)]" items={IN_PROGRESS} />
            <Column title="Exploring" dot="bg-[var(--color-fg-subtle)]" items={EXPLORING} />
          </div>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
