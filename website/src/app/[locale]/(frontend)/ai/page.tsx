import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import {
  AiIllo, AnalyticsIllo, InventoryIllo, AccountingIllo, PurchasingIllo,
  OfflineIllo, SecurityIllo,
} from '@/components/marketing/illustrations'

export const metadata: Metadata = {
  title: 'Omnix AI — an employee that knows your numbers',
  description:
    'Not a chatbot. A working assistant wired to your live ERP data. Asks answer from your books, flags what needs attention, and prepares actions for you to approve. Bring your own model — free tiers from Groq or OpenRouter are plenty.',
}

/* ── Capabilities (one section, two columns of grounded examples) ─────── */
const ASK_YOUR_DATA = [
  {
    q: 'What made the most profit this month?',
    a: 'Returns the top products by profit (not just revenue), with margin %, computed from your live books — never guessed.',
  },
  {
    q: 'What should I reorder, and how much?',
    a: 'Uses each product\'s own sales velocity, lead time, and stock to suggest order quantities, sorted by days of cover left.',
  },
  {
    q: 'Why did revenue change this week?',
    a: 'Compares this week against the previous equal period and names the products that drove the gap, gainers and losers.',
  },
  {
    q: 'Which customers have stopped buying?',
    a: 'Segments your customers into VIP / loyal / at-risk / churned by recency, frequency, and spend — at-risk surfaces first.',
  },
  {
    q: 'Which supplier is most reliable?',
    a: 'Scores every supplier on on-time delivery %, fill rate, and total spend across your purchase orders.',
  },
  {
    q: 'What stock is expiring soon?',
    a: 'Lists batches expiring within N days and the value at risk — pharmacist-grade for chemists, useful everywhere else.',
  },
]

const CONFIRMED_ACTIONS = [
  { title: 'Draft a purchase order', body: 'Generated from reorder suggestions with the right supplier, items and quantities. Nothing is sent — you review and approve.' },
  { title: 'Categorise products', body: 'Tidy a messy catalogue: the assistant proposes a category for each product; you click Apply.' },
  { title: 'Set reorder levels', body: 'Suggests sensible reorder thresholds from velocity. Your approval applies the change.' },
  { title: 'Harmonise a messy import', body: 'Maps any supplier CSV / Excel into Omnix\'s fields — even with Swahili headers, weird casing, or missing columns.' },
]

const INTELLIGENCE = [
  { Illo: InventoryIllo, name: 'Inventory intelligence', body: 'Dead stock by value, reorder suggestions with quantities, expiry risk, duplicate detection, margin issues, price anomalies.' },
  { Illo: AnalyticsIllo, name: 'Sales & financial insights', body: 'Profit leaders, revenue change explained, cashier performance, payment-method mix, Z-report summary in plain English.' },
  { Illo: AiIllo, name: 'Customer insights', body: 'VIPs, at-risk, churned, inactive — segmented by RFM. Know who needs a follow-up before they slip away.' },
  { Illo: PurchasingIllo, name: 'Supplier intelligence', body: 'Score every supplier on on-time %, fill rate, and total spend. Find who actually delivers.' },
  { Illo: AccountingIllo, name: 'Imports & spreadsheet harmonisation', body: 'Drop in any supplier file. The assistant detects structure, maps columns, normalises units, flags duplicates, previews before you commit.' },
  { Illo: AiIllo, name: 'Anomaly narration', body: 'When something looks off — revenue dip, below-cost pricing, an unusual void — the assistant explains why it matters and what to do.' },
]

const PROVIDERS = [
  { name: 'Groq', tagline: 'Free, very fast', tier: 'Free tier' },
  { name: 'OpenRouter', tagline: 'Aggregator with free models', tier: 'Free tier' },
  { name: 'DeepSeek', tagline: 'Cheap, very capable', tier: 'Pay per token' },
  { name: 'OpenAI', tagline: 'GPT-4o, GPT-4o-mini', tier: 'Pay per token' },
  { name: 'Anthropic', tagline: 'Claude Sonnet, Haiku', tier: 'Pay per token' },
  { name: 'Google AI', tagline: 'Gemini Flash, Pro', tier: 'Free tier' },
  { name: 'Custom / Ollama', tagline: 'Any OpenAI-compatible URL', tier: 'Local or hosted' },
]

const ROADMAP = [
  { title: 'Vision ingestion', body: 'Drop a photo of a supplier invoice; the assistant drafts the goods-received note for review.' },
  { title: 'Demand forecasting', body: 'Ingredient & medicine shortage prediction, fast-mover forecasts — explained, never opaque.' },
  { title: 'Local embeddings + RAG', body: 'Semantic search over your own data + the docs. Fully offline via a local Ollama model.' },
  { title: 'Per-trade playbooks', body: 'Pharmacist, retailer, restaurateur and hardware modes with proactive insights tailored to the trade.' },
]

export default async function AiPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="Omnix AI"
        title={<>An employee that <em>knows</em> your numbers.</>}
        description="Not a chatbot. A working assistant wired to your live ERP data. It answers from your actual books, flags what needs attention before you ask, and prepares the work for you to approve."
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Link href="/pricing" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            See pricing <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </PageHero>

      {/* ── Ask your data ──────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">Ask your data</span>
            <h2 className="headline-section mt-5 text-balance">
              Questions an owner actually asks. <em>Answered from your books.</em>
            </h2>
            <p className="lede mt-7 text-balance">
              Every figure comes out of your live SQLite — never a guess. The model only
              explains the numbers and tells you what to do about them.
            </p>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-2">
            {ASK_YOUR_DATA.map((row) => (
              <div key={row.q} className="bg-[var(--color-bg)] p-7 lg:p-9">
                <p className="font-[family-name:var(--font-display)] text-[20px] italic font-normal leading-snug text-[var(--color-fg)]">
                  &ldquo;{row.q}&rdquo;
                </p>
                <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">{row.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Confirmed actions ──────────────────────────────────────────── */}
      <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <span className="eyebrow">Acts, with permission</span>
              <h2 className="headline-section mt-5 text-balance">
                Prepares the work. <em>You approve.</em>
              </h2>
              <p className="mt-6 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
                The assistant never mutates anything on its own. When it has work
                ready, it shows you exactly what will change — counts, totals, who
                it affects — and waits for one tap. Every action runs through
                Omnix&rsquo;s permissions, just like a human user.
              </p>
              <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[44ch]">
                Every proposal and outcome is logged to an action ledger you can
                review in <code className="font-[family-name:var(--font-mono)] text-[14px] text-[var(--color-accent)]">/settings/ai</code>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2">
              {CONFIRMED_ACTIONS.map((a) => (
                <div key={a.title} className="bg-[var(--color-bg)] p-6">
                  <h3 className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--color-fg)]">{a.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Six kinds of intelligence ─────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">What it knows</span>
            <h2 className="headline-section mt-5 text-balance">
              Six kinds of business intelligence, <em>built in.</em>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-x-16 lg:gap-y-14">
            {INTELLIGENCE.map((row) => (
              <div key={row.name} className="flex gap-5">
                <span className="mt-1 shrink-0 text-[var(--color-accent)]"><row.Illo size={36} /></span>
                <div>
                  <h3 className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[var(--color-fg)]">{row.name}</h3>
                  <p className="mt-2 text-[14px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">{row.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bring your own model ──────────────────────────────────────── */}
      <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <span className="eyebrow">Your model, your keys</span>
              <h2 className="headline-section mt-5 text-balance">
                The AI is yours, <em>not ours.</em>
              </h2>
              <p className="mt-6 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[46ch]">
                We don&rsquo;t resell tokens. We don&rsquo;t mark up inference. Pick a provider,
                paste your key, and your calls go direct from your machine to your
                provider — Omnix never sees the prompt or the response.
              </p>
              <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-fg-muted)] max-w-[46ch]">
                Free tiers from Groq and OpenRouter handle a busy day comfortably.
                Paid tiers (OpenAI, Claude) plug in identically. Or point it at a
                local Ollama model on the same PC and run AI <em className="not-italic font-[family-name:var(--font-display)] italic">fully offline</em>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <div key={p.name} className="bg-[var(--color-bg)] p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--color-fg)]">{p.name}</h3>
                    <span className="caption-mono">{p.tier}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-[var(--color-fg-muted)]">{p.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy + offline ─────────────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-x-20">
            <div className="flex gap-5">
              <span className="mt-1 shrink-0 text-[var(--color-accent)]"><SecurityIllo size={40} /></span>
              <div>
                <h3 className="headline-sub text-[22px]">Private by default</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[46ch]">
                  Every prompt is scrubbed for PII before it leaves the machine — phone
                  numbers, KRA PINs, IDs, API keys. Keys are stored encrypted in your
                  local SQLCipher database. Disable AI completely from settings if you
                  prefer, and the rest of Omnix still works.
                </p>
              </div>
            </div>
            <div className="flex gap-5">
              <span className="mt-1 shrink-0 text-[var(--color-accent)]"><OfflineIllo size={40} /></span>
              <div>
                <h3 className="headline-sub text-[22px]">Online when it helps, offline when it must</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[46ch]">
                  Insights, reorder suggestions, dead stock, customer churn — these
                  are all computed by SQL on your machine and work with zero internet.
                  The model only steps in to explain in plain language; without a
                  provider configured, the numbers still come through.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roadmap ───────────────────────────────────────────────────── */}
      <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">What&rsquo;s next</span>
            <h2 className="headline-section mt-5 text-balance">
              Shipping <em>regularly.</em>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-2">
            {ROADMAP.map((r) => (
              <div key={r.title} className="bg-[var(--color-bg)] p-7">
                <h3 className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--color-fg)]">{r.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--color-fg-muted)]">{r.body}</p>
              </div>
            ))}
          </div>
          <p className="caption-mono mt-8">
            Roadmap is honest, no calendar dates · all shipped features in <Link href="/changelog" className="underline underline-offset-2 hover:text-[var(--color-fg)]">/changelog</Link>
          </p>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
