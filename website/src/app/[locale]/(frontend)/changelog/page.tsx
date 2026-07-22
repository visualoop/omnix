/* Hallmark · Working Counter · shipped release ledger */
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

// Re-fetch every minute so a fresh tag shows up quickly without a redeploy.
export const dynamic = 'force-dynamic'
export const revalidate = 60

interface ReleaseRow {
  version: string
  title: string
  summary: string
  publishedAt: string
}

interface VersionGroup {
  version: string
  publishedAt: string
  title: string
  summary: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/changelog`
  return {
    title: 'Changelog — every Omnix release',
    description:
      'Every shipped Omnix release, newest first. What changed, in plain language — only work that is actually in customers’ hands, never dated promises.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/changelog'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix changelog',
      description: 'Every shipped Omnix release, newest first, in plain language.',
      type: 'website',
    }),
  }
}

/**
 * Per-version highlight recap. Hand-curated for releases that warrant a
 * bullet list above and beyond the release summary line. Empty by default —
 * the standard summary is enough for most patches.
 */
const VERSION_HIGHLIGHTS: Record<string, string[]> = {
  '0.16.0': [
    'Hospitality customer display redesigned — guests see their order grouped by course with a live status chip on every line (Queued → In kitchen → Cooking → Ready → Served), plus table number and server name in the header.',
    'New Order Board mode for hospitality — a wall-mounted screen showing every active order in two columns, PREPARING and READY, with a short chime when an order moves to READY.',
    'KOT polling on the customer display refreshes every two seconds, so the customer sees the same status the kitchen sees.',
    'Strict proprietary licence added — Omnix source is published for security review only; use, modification, redistribution and reselling require a signed agreement.',
    'New /partners page — resellers, integrators, OEMs and referral partners can submit an enquiry that reaches the partnerships inbox.',
  ],
  '0.15.4': [
    'Critical fix: split payments with M-Pesa plus another method no longer fail with a foreign-key error after the M-Pesa charge has been taken.',
    'Variant picker now shows a real SKU on the parent product card instead of the "Parent SKU" placeholder.',
    'Customer display shows each line item’s image (or a clean icon placeholder), themed to the active module accent.',
    'Customer display shows the customer’s name at the top of the sale when the cashier sets one.',
  ],
  '0.15.3': [
    'Native on-screen keyboard replaces the third-party library that caused blank-screen crashes in touch mode.',
    'M-Pesa sandbox auto-confirm now resolves the test transaction during the 15-second grace; production charges unchanged.',
    'Payment modal shows the running tendered amount inside each method card.',
    'POS search bar redesigned — the magnifier sits in its own slot to the left of the input.',
  ],
  '0.15.2': [
    'Dashboard downloads page derives the right installer for every variant.',
    'Error boundary now catches non-render errors so blank screens always surface a message.',
  ],
  '0.15.1': [
    'M-Pesa sandbox testing no longer falsely fails on the first poll; production unchanged.',
    'Payment modal redesigned — wider, single scroll axis, genuinely sticky "Complete sale" button.',
    'Checkout dialogs share one masthead and brand colours so the flow feels continuous.',
    'New route error boundary surfaces the real error and stack instead of blanking out.',
  ],
  '0.14.0': [
    'Every sale, void and refund is now all-or-nothing — a power cut mid-transaction can no longer leave a half-written sale or money recorded twice.',
    'Voiding a sale reverses everything: stock returns, payment undone, bank deposit withdrawn, KRA invoice flagged for a credit note.',
    'Money is counted in exact cents end to end, so receipts, reports, tax back-out and insurance copay splits reconcile to the shilling.',
    'Redesigned module screens — Pharmacy, Retail, Hardware and Hospitality each get a distinct, disciplined identity.',
  ],
  '0.13.0': [
    'Auto-update on close — non-major updates download quietly while you work and install when you close the app.',
    'Machines now show every module activated on them.',
    'Full provider-side setup guides for Daraja and Paystack.',
  ],
  '0.12.0': [
    'Payment modal rebuilt — remaining always visible, brand-coloured method blocks, one contextual CTA.',
    'Paystack Popup for card payments; manual M-Pesa Paybill/Till flow with confirmation-code capture.',
    'In-app setup guides for M-Pesa and Paystack.',
  ],
}

function formatDate(d?: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * Sanitise a database-sourced release note before it reaches the public
 * changelog. Two jobs:
 *
 *   1. Strip bare URLs — legacy notes embedded the now-private GitHub /
 *      installer links, which must never surface on a public page.
 *   2. Drop any sentence carrying acquisition-facing positioning we do not
 *      run on public surfaces: AI marketing, a "Pro" tier, trial-start
 *      language, or a restated / stale price. Neutral release facts survive.
 *
 * Word boundaries keep the "Pro" tier match narrow: "provider",
 * "professional", "process" and "product" are deliberately left untouched.
 */
const FORBIDDEN_SUMMARY_PATTERNS: RegExp[] = [
  /\bA\.?I\b/i, // AI marketing or "AI keys" positioning
  /\bPro\b/, // "Pro" tier only (case-sensitive; spares provider/professional)
  /\b(?:free\s+trial|start(?:ing)?\s+(?:a\s+|your\s+)?trial|trial)\b/i, // trial-start
  /(?:KES|USD|NGN|GHS|ZAR|Ksh|\$)\s*[\d][\d,]*/i, // restated / stale price positioning
]

/** Strip URLs and redact acquisition-facing positioning from legacy summaries. */
function cleanSummary(s?: string): string {
  if (!s) return ''
  const withoutUrls = s
    .replace(/See\s+https?:\/\/\S+\s+for the full changelog\.?/i, '')
    .replace(/https?:\/\/\S+/g, '')
  return withoutUrls
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .filter((sentence) => !FORBIDDEN_SUMMARY_PATTERNS.some((re) => re.test(sentence)))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function groupByVersion(rows: ReleaseRow[]): VersionGroup[] {
  const map = new Map<string, VersionGroup>()
  for (const r of rows) {
    if (map.has(r.version)) continue
    map.set(r.version, {
      version: r.version,
      publishedAt: r.publishedAt ?? '',
      title: r.title,
      summary: r.summary,
    })
  }
  return [...map.values()].sort((a, b) =>
    String(b.publishedAt).localeCompare(String(a.publishedAt)),
  )
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const roadmapHref = `/${locale}/roadmap`
  const demoHref = `/${locale}/contact?type=demo`

  let rows: ReleaseRow[] = []
  try {
    const { db, releases } = await import('@/db')
    const { eq, desc } = await import('drizzle-orm')
    const drizzleRows = await db
      .select()
      .from(releases)
      .where(eq(releases.channel, 'stable'))
      .orderBy(desc(releases.publishedAt))
      .limit(100)
    rows = drizzleRows.map((release) => ({
      version: release.version,
      title: release.notes?.split('\n')[0] ?? `Omnix ${release.version}`,
      summary: release.notes ?? '',
      publishedAt: release.publishedAt.toISOString(),
    }))
  } catch {
    // Public release history fails closed when storage is unavailable.
  }
  const groups = groupByVersion(rows)

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        {/* Masthead */}
        <header className="grid min-w-0 gap-8 border-b border-[var(--color-border)] pb-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end lg:gap-16 lg:pb-14">
          <div className="min-w-0">
            <p className="caption-mono text-[var(--color-accent)]">Shipped</p>
            <h1 className="mt-4 max-w-[16ch] text-balance text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--color-fg)]">
              Every release, in the open.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              Only work that is actually in customers&rsquo; hands, newest first. Updates install
              through the app; there are no public installer links here. For what&rsquo;s planned
              next, see the roadmap.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={roadmapHref}>See the roadmap</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a demo</Link>
              </Button>
            </div>
          </div>
        </header>

        {groups.length === 0 ? (
          <p className="py-16 text-[15px] leading-7 text-[var(--color-fg-muted)]">
            No releases published yet. When the first build ships, it will appear here.
          </p>
        ) : (
          <ol className="min-w-0">
            {groups.map((group) => {
              const highlights = VERSION_HIGHLIGHTS[group.version]
              const summary = cleanSummary(group.summary)
              // Titles come from the same DB notes, so they pass through the
              // same guard; fall back to the neutral version label if empty.
              const title = cleanSummary(group.title) || `Omnix v${group.version}`
              return (
                <li
                  key={group.version}
                  className="grid min-w-0 gap-4 border-b border-[var(--color-border)] py-10 sm:py-12 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-16"
                >
                  <div className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
                    <p className="font-mono text-[clamp(1.25rem,2vw,1.6rem)] tabular-nums leading-none tracking-[-0.02em] text-[var(--color-accent)]">
                      v{group.version}
                    </p>
                    {group.publishedAt ? (
                      <time
                        dateTime={group.publishedAt}
                        className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]"
                      >
                        {formatDate(group.publishedAt)}
                      </time>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <h2 className="max-w-[26ch] text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--color-fg)]">
                      {title}
                    </h2>
                    {summary && summary !== title ? (
                      <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.7] text-[var(--color-fg-muted)]">
                        {summary}
                      </p>
                    ) : null}
                    {highlights ? (
                      <ul className="mt-5 space-y-2.5">
                        {highlights.map((h) => (
                          <li
                            key={h}
                            className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]"
                          >
                            <span aria-hidden className="mt-[0.6rem] h-px bg-[var(--color-accent)]" />
                            <span className="max-w-[64ch]">{h}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </PageContainer>
    </div>
  )
}
