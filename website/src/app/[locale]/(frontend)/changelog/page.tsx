import type { Metadata } from 'next'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Changelog — what shipped',
  description: 'Every Omnix release, newest first. Variant-specific download links and what changed.',
}

// Re-fetch every minute so a fresh tag shows up quickly without a redeploy.
export const dynamic = 'force-dynamic'
export const revalidate = 60

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

interface ReleaseRow {
  id: string | number
  version: string
  variant?: VariantId
  publishedAt?: string
  title?: string
  summary?: string
  windowsNsisUrl?: string
  windowsMsiUrl?: string
  windowsNsisSize?: number
  channel?: string
}

interface VersionGroup {
  version: string
  publishedAt: string
  /** Pro row (or earliest backfill row) used for the headline copy. */
  headline: ReleaseRow
  /** All variant rows for this version, in display order. */
  variants: Record<VariantId, ReleaseRow | undefined>
}

const VARIANT_ORDER: VariantId[] = ['pro', 'dawa', 'retail', 'hospitality', 'hardware']

const VARIANT_LABEL: Record<VariantId, string> = {
  pro: 'Pro',
  dawa: 'Dawa',
  retail: 'Retail',
  hospitality: 'Hospitality',
  hardware: 'Hardware',
}

/**
 * Per-version highlight chips. Hand-curated for releases that warrant a
 * bullet recap above and beyond the GitHub-release summary line.
 * Empty by default — the standard summary is enough for most patches.
 */
const VERSION_HIGHLIGHTS: Record<string, string[]> = {
  '0.15.4': [
    'Critical fix: split payments with M-Pesa + another method no longer fail with a foreign-key error after the M-Pesa charge has already been taken. The synthetic M-Pesa method ids the UI uses are now seeded + auto-upserted before the payment row is inserted, so the local sale always lands.',
    'Variant picker: the parent product card now shows a real SKU (the product\'s own SKU, or a stable synthesised one) instead of the literal "Parent SKU" placeholder.',
    'Customer display: each line item now shows the product\'s image (or a clean icon placeholder when no image is set). The thumbnail is themed to the active module accent.',
    'Customer display: when the cashier sets a customer on the sale, their name appears at the top of the display so it\'s clear whose order is on screen.',
  ],
  '0.15.3': [
    'Native on-screen keyboard — the third-party library was the source of the blank-screen crashes when typing in touch mode. The new one is fully ours; it dismisses cleanly when a dialog closes and never leaves dangling overlays.',
    'M-Pesa sandbox auto-confirm now actually fires — Daraja\'s sandbox routinely returns a "cancelled" code on the first poll even when nothing was cancelled; we now treat it as pending so the 15-second grace can resolve the test transaction. Production charges unchanged.',
    'Payment modal shows the running tendered amount inside each method card (e.g. "Cash · KES 100") — no more scrolling to the "Paid so far" list to see how a split is going.',
    'M-Pesa STK waiting screen shows the real M-Pesa wordmark; Paystack-via-M-Pesa shows both lockups so the customer knows who\'s charging the phone.',
    'POS search bar redesigned — the magnifier sits in its own slot to the left of the input, not on top of it. Scanner-ready indicator now lives in the same row.',
    'Variant picker now includes the parent SKU as a sellable option, scrolls when there are many variants, and matches the main POS product card visually with image-first cards.',
    'Customer display second-screen now reads the right currency on first paint (was flashing $ instead of KES because each Tauri window has its own state tree). Footer URL fixed to omnix.co.ke and the "Omnix Omnix Retail" duplicate is gone.',
    'Dead-stock insight no longer flags products that were just added — it now floors by product age so a SKU has to have been in the catalogue for the full idle window before being called dead.',
    'AI assistant\'s tool flow is more resilient — when one provider rate-limits or stalls mid-stream (no narration after a tool result), the chat now falls over to the next configured provider instead of leaving an empty bubble.',
    'AI workspace (/ai) now has conversation history, a New chat button, and persists chats between sessions — same behaviour as the side panel.',
    'Assistant won\'t auto-navigate the app when you ask vague questions like "can you add a cashier?" — it answers in chat first; navigation only fires when you\'ve asked to be taken somewhere or accepted a suggestion.',
  ],
  '0.15.2': [
    'Dashboard downloads page now derives the right installer URL for every variant — Pro no longer shows "no .exe / no .msi" when the GitHub release has the binary.',
    'Error boundary now also catches non-render errors (click-handler crashes, unhandled promise rejections, Tauri plugin failures) so blank screens always surface an error message instead of vanishing silently.',
  ],
  '0.15.1': [
    'M-Pesa sandbox testing no longer falsely fails — Safaricom\'s sandbox returns a stray "cancelled" code on the first poll; we now ignore it during the 15-second grace so auto-confirm always lands. Production unchanged.',
    'Payment modal redesigned — wider so cards don\'t clip, focus rings stay inside the dialog, one scroll axis instead of two, the "Complete sale" button is genuinely sticky.',
    'The M-Pesa / Paystack / Insurance dialogs that open during checkout now share the same masthead + brand colours as the main payment modal (Safaricom green, Paystack cyan, insurance sky-blue) — checkout feels like one continuous flow, not five different screens.',
    'Brand selector showed the brand id instead of the name when you picked one — fixed in the product panel and quick-add.',
    'New route error boundary — when something crashes in a deep child the app no longer blanks out; you see the actual error message + stack you can paste in a bug report.',
  ],
  '0.15.0': [
    'Omnix AI grew from a help concierge into a business partner — ask it real questions about your shop and it answers from your live data',
    'Ask things like "what made the most profit this month?", "what should I reorder and how much?", "which customers have stopped buying?", "why did revenue change?" — grounded in your actual numbers, never guessed',
    'New "Needs attention" feed on the dashboard: stockouts about to happen, stock expiring soon, dead stock tying up cash, items priced below cost, and revenue dips — each with a one-tap "ask AI why"',
    'The assistant can now prepare actions for you — draft a purchase order, categorise products, set reorder levels — and nothing changes until you review and approve it',
    'New full-page Omnix AI workspace (sidebar → Omnix AI) for working with your data and recommendations in one place',
    'End-of-day Z-report can now write you a plain-language shift summary to share with the team',
    'M-Pesa sandbox testing no longer hangs — STK test payments auto-confirm so you can trial the till flow end to end (production payments are untouched)',
  ],
  '0.14.0': [
    'Every sale, void, and refund is now all-or-nothing — a power cut or crash mid-transaction can no longer leave a half-written sale, orphaned stock, or money recorded twice',
    'Voiding a sale now reverses everything: stock returns, the payment is undone, the bank deposit is withdrawn back, and the KRA invoice is flagged for a credit note',
    'Money is counted in exact cents end to end — receipts, reports, tax back-out, and insurance copay splits always reconcile to the shilling',
    'Insurance claims guarantee copay + claim equals the bill exactly, so claims stop bouncing on rounding mismatches',
    'Restaurant stock stays honest: ingredients of a dish that was cooked then comped are written off instead of silently lingering in inventory',
    'Refunds and layby cancellations now mirror back to the bank automatically, keeping reconciliation clean',
    'Redesigned module screens — Pharmacy, Retail, Hardware, and Hospitality each get a distinct, disciplined identity (teal, amber, orange, rose) with clearer KPIs and tables',
  ],
  '0.13.1': [
    'Long-term speed: SQLite tuned for production (WAL, memory-mapped reads, bigger cache) so the till stays instant after years of sales',
    'Daily sales rollup keeps all-time reports fast no matter how much history accumulates',
    'Automatic background maintenance (planner stats, space reclaim, log pruning) runs quietly once a day',
    'Marketing images now load everywhere (hero, modules, pricing, social cards)',
  ],
  '0.13.0': [
    'Auto-update on close — non-major updates download quietly while you work and install when you close the app, like VSCode',
    'Machines now show every module activated on them (was showing only the last one)',
    'Full provider-side setup guides — applying for a Daraja Paybill/Till, the Daraja portal flow, Paystack onboarding, and AI keys, step by step',
    'WhatsApp chat widget polish + Lighthouse SEO/accessibility fixes (valid hreflang, contrast, link/button labels)',
    'Branded STK push success screens (M-Pesa green pulse, Paystack blue)',
  ],
  '0.12.0': [
    'Payment modal rebuilt — remaining always visible, brand-coloured method blocks, single contextual CTA, internal scroll',
    'Paystack Popup (hosted iframe) for card payments — no PCI scope, no fraud-flag penalty',
    'Manual M-Pesa Paybill/Till — the no-API flow most Kenyan SMEs use, with confirmation-code capture',
    'STK push "Mark as paid manually" fallback when Safaricom is slow',
    'Upgraded payment brand icons (M-Pesa, Paystack, Visa, Mastercard, cash, card)',
    'Tap a cart quantity to type it; on-screen QWERTY keyboard for touch terminals',
    'Customer display now carries Omnix branding + your business name + module + www.blyss.co.ke',
    'Fixed: variants now add from the product page, POS shows product images, SKU is optional',
    'Fixed: PDFs + receipts now show your real business name (was "Your Business")',
    'Marketing site leads with M-Pesa: hero, variant landings, SEO keywords, structured data',
    'In-app setup guides for M-Pesa, Paystack, and AI keys + dashboard setup prompts',
    'Public Team page (admin-managed) + WhatsApp chat widget',
  ],
  '0.11.1': [
    'Touch keypad on every cash dialog (POS terminals)',
    'Customer display local images now render',
    'Pharmacy → Patients tab',
    'Search-and-create patient/doctor pickers in dispense',
    'Mobile-responsive admin shell',
    'Editorial tables with search + pagination + filters on every list page',
    'Schema-stale SQL audit prevents dispense + bulk-edit crashes',
    '48 native form elements migrated to shadcn primitives',
  ],
  '0.11.0': [
    'Multi-licence per machine — seven activation gates',
    'Pro covers all four trades, trade variants compose freely',
    'Local↔cloud licence sync with auto-heal of orphan seats',
    'Settings → Licences page with module switcher',
    'Sidebar module switcher (auto-hides single-licence installs)',
    'Pro pricing fixed: KES 150,000 (was charging trade price)',
    'Downloads page lists every owned variant',
    'Dashboard release-seat button',
  ],
  '0.10.7': [
    'Trade variants now KES 30,000 (was 50,000)',
    'Pro stays at KES 150,000 — all four trades covered',
    'Checkout page redesigned with bigger total + accent rule',
  ],
  '0.10.6': [
    'POS product cards: image-first when set, module accent throughout',
    'Inline edit on inventory detail page (Edit toggles every field)',
  ],
  '0.10.5': [
    'YouTube + Vimeo URLs in customer display auto-convert to embed form',
  ],
  '0.10.4': [
    'Customer display playlist supports local images + videos (file picker)',
    'Toast confirmation on every PDF download',
  ],
  '0.10.3': ['Row click drills to detail page (customers, suppliers, sales, employees, branches)'],
  '0.10.2': ['Product detail page — Variants tab + Images tab'],
  '0.10.1': ['Login profile picker — tile per active user with avatar + role pill'],
  '0.10.0': [
    '16 branded PDFs',
    'PO lifecycle hardening',
    'Customer display playlist',
    '14 entity detail pages',
    '7-step onboarding wizard',
    'CSV auto-map (English + Swahili)',
    'Unified PDF engine',
    'P&L COGS bug fix',
  ],
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return ''
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(d?: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Strip bare URLs from legacy summaries that embedded the (now-private) GitHub link. */
function cleanSummary(s?: string): string {
  if (!s) return ''
  return s
    .replace(/See\s+https?:\/\/\S+\s+for the full changelog\.?/i, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Group the flat release list by version. v0.3.x rows have variant=pro
 * (default backfilled by migration). v0.4.0+ rows have one row per variant
 * — we collapse those into a single version card with multiple download
 * buttons.
 */
function groupByVersion(rows: ReleaseRow[]): VersionGroup[] {
  const map = new Map<string, VersionGroup>()
  for (const r of rows) {
    const v = (r.variant ?? 'pro') as VariantId
    const existing = map.get(r.version)
    if (existing) {
      existing.variants[v] = r
      // Prefer the Pro variant row's headline copy when available.
      if (v === 'pro') {
        existing.headline = r
      }
    } else {
      map.set(r.version, {
        version: r.version,
        publishedAt: r.publishedAt ?? '',
        headline: r,
        variants: {
          pro: undefined,
          dawa: undefined,
          retail: undefined,
          hospitality: undefined,
          hardware: undefined,
          [v]: r,
        } as Record<VariantId, ReleaseRow | undefined>,
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    String(b.publishedAt).localeCompare(String(a.publishedAt)),
  )
}

export default async function ChangelogPage() {
  const { db, releases } = await import('@/db')
  const { eq, desc } = await import('drizzle-orm')
  const drizzleRows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(100)
  // Map Drizzle row → ReleaseRow shape used by the rest of this page.
  const rows: ReleaseRow[] = drizzleRows.map((r) => ({
    version: r.version,
    title: r.notes?.split('\n')[0] ?? `Omnix ${r.version}`,
    summary: r.notes ?? '',
    publishedAt: r.publishedAt.toISOString(),
    variant: 'pro',                                       // single shipped variant per row in the new schema
    status: 'published',
    channel: r.channel,
  })) as unknown as ReleaseRow[]
  const groups = groupByVersion(rows)

  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title={<>What <em>shipped.</em></>}
        description="Every Omnix release, newest first. From v0.4.0 onwards each version ships five variants — pick the one you run."
      />

      <section className="section">
        <div className="container-default">
          {groups.length === 0 ? (
            <p className="text-[15px] text-[var(--color-fg-muted)]">No releases published yet.</p>
          ) : (
            <ol className="space-y-14">
              {groups.map((g, i) => (
                <li
                  key={g.version}
                  className={i === groups.length - 1 ? '' : 'border-b border-[var(--color-border)] pb-14'}
                >
                  <ReleaseCard group={g} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  )
}

function ReleaseCard({ group }: { group: VersionGroup }) {
  const { headline, variants, version, publishedAt } = group
  const presentVariants = VARIANT_ORDER.filter((v) => variants[v])
  const hasMultiVariant = presentVariants.length > 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="lg:w-36">
        <div className="caption-mono">{formatDate(publishedAt)}</div>
        <div className="font-[family-name:var(--font-mono)] mt-2 text-[20px] tabular-nums text-[var(--color-accent)]">
          v{version}
        </div>
        {hasMultiVariant ? (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            {presentVariants.length} variants
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-display)] text-[clamp(24px,2.2vw,32px)] font-normal leading-tight text-[var(--color-fg)]">
          {headline.title ?? `Omnix v${version}`}
        </h3>
        {cleanSummary(headline.summary) ? (
          <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[60ch] break-words">
            {cleanSummary(headline.summary)}
          </p>
        ) : null}

        {/* Hand-curated highlight chips for marquee releases. The fallback
            is empty (most releases don't need bullet copy beyond the
            summary above). Add new versions here as they ship. */}
        {VERSION_HIGHLIGHTS[version] ? (
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {VERSION_HIGHLIGHTS[version].map((h) => (
              <li
                key={h}
                className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]"
              >
                {h}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Download grid — one button per variant that has an installer */}
        {presentVariants.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {presentVariants.map((v) => {
              const r = variants[v]!
              const url = r.windowsNsisUrl ?? r.windowsMsiUrl
              if (!url) return null
              const isMulti = hasMultiVariant
              return (
                <a
                  key={v}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer"
                  title={`${formatBytes(r.windowsNsisSize) || ''} · Tauri-signed`.trim().replace(/^· /, '')}
                >
                  <Icon.Download className="size-3.5" weight="bold" />
                  {isMulti ? VARIANT_LABEL[v] : 'Download'}
                  {!isMulti && r.windowsNsisSize ? ` (${formatBytes(r.windowsNsisSize)})` : ''}
                </a>
              )
            })}
          </div>
        ) : null}
        <span className="caption-mono mt-3 inline-block">Tauri-signed</span>
      </div>
    </div>
  )
}
