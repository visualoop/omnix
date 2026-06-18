import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: 'AI in Omnix — your in-app concierge',
  description:
    'A built-in AI assistant that knows your business, KRA, M-Pesa, SHA — and can search, navigate, summarise. Bring your own model (Groq, OpenRouter, OpenAI, Anthropic). Free tier or paid, you choose.',
}

const FEATURES = [
  {
    title: 'Concierge that knows your trade',
    body: 'Ask "How do I file VAT3?" or "What\'s my low-stock list?" and the assistant answers in your language — English with natural Swahili. Variant-aware: a chemist hears chemist vocabulary; a restaurant owner hears chef vocabulary.',
    icon: 'Sparkles' as const,
  },
  {
    title: 'Acts on the app, not just talks',
    body: 'Tools that actually do things: navigate to any screen, look up today\'s sales, find a product, list low-stock items, open the docs. Tap a route chip in any reply and you\'re there.',
    icon: 'Lightning' as const,
  },
  {
    title: 'Explains your eTIMS errors',
    body: 'When KRA bounces a receipt, the assistant translates the cryptic CU error code into plain English with a fix you can follow. Saves a phone call to your accountant.',
    icon: 'Receipt' as const,
  },
  {
    title: 'Auto-fills product details',
    body: 'Type a name, hit ✨, get a description, category, tax rate, and HS code suggestion. Importing a 500-row Excel? AI maps the columns to the right fields automatically.',
    icon: 'Box' as const,
  },
  {
    title: 'Bring your own model',
    body: 'No subscription, no Omnix-branded LLM. Plug in your own API key — Groq (free, fast), OpenRouter (free models), DeepSeek, OpenAI, Anthropic, Google. Or run a local model on the same machine.',
    icon: 'Code' as const,
  },
  {
    title: 'Private by default',
    body: 'API calls go direct from your machine to your chosen provider. Omnix never sees your data, your keys, or your prompts. Keys encrypted at rest with AES-256. Disable AI completely from Settings if you prefer.',
    icon: 'Shield' as const,
  },
] as const

const PROVIDERS = [
  { name: 'Groq', tagline: 'Free, very fast', tier: 'Free tier' },
  { name: 'OpenRouter', tagline: 'Free models + premium', tier: 'Free tier' },
  { name: 'DeepSeek', tagline: 'Cheap & capable', tier: 'Pay per token' },
  { name: 'OpenAI', tagline: 'GPT-4o, GPT-4 mini', tier: 'Pay per token' },
  { name: 'Anthropic', tagline: 'Claude Sonnet, Haiku', tier: 'Pay per token' },
  { name: 'Google', tagline: 'Gemini Flash, Pro', tier: 'Free tier' },
  { name: 'Custom', tagline: 'Any OpenAI-compatible URL', tier: 'You decide' },
] as const

const TOOLS = [
  { name: 'navigate', body: 'Opens any /screen in Omnix in one click — POS, customers, eTIMS queue, settings.' },
  { name: 'getTodaySales', body: 'Today\'s revenue, sale count, payment-method breakdown — straight from your live SQLite.' },
  { name: 'getInventoryAlerts', body: 'Products at or below reorder level, sorted by urgency. The assistant can summarise or list.' },
  { name: 'searchProducts', body: 'Find products by name, SKU, or barcode. Top 10 returned with stock + price.' },
  { name: 'searchCustomers', body: 'Find customers by name, phone, or email. Top 10 returned with credit balance.' },
  { name: 'getRecentSales', body: 'Last N sales with totals, payment, cashier. Useful for "what did we sell at lunch?".' },
  { name: 'openDocs', body: 'Opens the public docs to the right page so you can read the full procedure.' },
] as const

export default async function AiPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="AI in Omnix"
        title={<>An assistant that <em>knows</em> your business</>}
        description="A built-in AI concierge that knows the entire app, KRA filings, M-Pesa flows, SHA claims and your live data. Acts on the app, not just talks. Bring your own model."
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs/ai">Read the AI guide</Link>
          </Button>
        </div>
      </PageHero>

      {/* ── 6 feature cards ───────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">What it does</span>
            <h2 className="headline-section mt-5 text-balance">Six things <em>worth</em> showing up for.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const I = Icon[f.icon as keyof typeof Icon] as (typeof Icon)['Sparkles']
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
                >
                  <I className="size-5 text-[var(--color-accent)]" weight="bold" />
                  <h3 className="font-[family-name:var(--font-display)] mt-4 text-[20px] font-normal leading-tight text-[var(--color-fg)]">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
                    {f.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── BYOK / providers ────────────────────────────────── */}
      <section className="section-tight bg-[var(--color-surface)]/30 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
            <div>
              <span className="eyebrow">Bring your own model</span>
              <h2 className="headline-section mt-5 text-balance">Your keys. <em>Your call.</em></h2>
              <p className="mt-5 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[40ch]">
                Omnix doesn't sell you tokens. Plug in any provider's API key in Settings → AI and the in-app
                assistant talks to it directly. Groq and OpenRouter offer truly free tiers that are plenty for a
                busy till. Want GPT-4o? Add an OpenAI key and switch.
              </p>
              <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[40ch]">
                Switch providers any time. Keys are encrypted at rest with AES-256 and never leave your machine.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[family-name:var(--font-display)] text-[18px] font-normal text-[var(--color-fg)]">
                      {p.name}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                      {p.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">{p.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tools ───────────────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[36rem]">
            <span className="eyebrow">It acts, doesn&rsquo;t just talk</span>
            <h2 className="headline-section mt-5 text-balance">Seven tools. <em>Real work.</em></h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">
              The assistant has read-only access to your live data and a few app actions. No mutations yet — those
              ship with a confirmation flow in v0.5.
            </p>
          </div>
          <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {TOOLS.map((t) => (
              <li key={t.name} className="grid grid-cols-1 gap-3 py-6 md:grid-cols-[14rem_1fr] md:gap-12">
                <div className="font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--color-accent)]">
                  {t.name}()
                </div>
                <p className="text-[15px] leading-[1.65] text-[var(--color-fg-muted)]">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Privacy ─────────────────────────────────────────── */}
      <section className="section-tight bg-[var(--color-surface)]/30 border-t border-[var(--color-border)]">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="eyebrow">Privacy</span>
              <h2 className="headline-section mt-5 text-balance">Your data <em>doesn&rsquo;t</em> route through us.</h2>
              <p className="mt-5 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">
                When you ask the assistant a question, the request goes from your machine straight to the AI
                provider you chose. Omnix isn't in the path. We never see your prompts, your responses, your keys,
                your customers, or your sales.
              </p>
            </div>
            <div className="space-y-4">
              <PrivacyRow
                icon="Shield"
                title="No middleman"
                body="Direct browser → provider HTTPS calls. We can't see what you ask even if we wanted to."
              />
              <PrivacyRow
                icon="Lock"
                title="Keys encrypted"
                body="API keys stored AES-256-encrypted in your local SQLite. Never leave the machine."
              />
              <PrivacyRow
                icon="Settings"
                title="Disable any time"
                body="Settings → AI → Disable. The assistant button hides and no AI calls leave the app."
              />
              <PrivacyRow
                icon="Cloud"
                title="Offline-respectful"
                body="The assistant detects offline state and tells you. Core POS, inventory, eTIMS — all keep working."
              />
            </div>
          </div>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}

function PrivacyRow({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  const I = (Icon[icon as keyof typeof Icon] ?? Icon.Check) as (typeof Icon)['Check']
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 grid size-9 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]">
        <I className="size-4" weight="bold" />
      </div>
      <div>
        <div className="font-[family-name:var(--font-display)] text-[18px] font-normal leading-tight text-[var(--color-fg)]">
          {title}
        </div>
        <p className="mt-1 text-[14px] leading-[1.6] text-[var(--color-fg-muted)] max-w-[42ch]">{body}</p>
      </div>
    </div>
  )
}
