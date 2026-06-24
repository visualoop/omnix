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
