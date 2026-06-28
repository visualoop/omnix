import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Downloads — pick your trade',
  description:
    'Download Omnix for Windows. Five variants — Pro, Dawa (pharmacy), Retail, Hospitality, Hardware. Free 30-day trial, no credit card.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 60

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

interface VariantInfo {
  id: VariantId
  name: string
  tagline: string
  copy: string
  ctaHref: string
  accent: string
  badge?: string
}

const VARIANTS: VariantInfo[] = [
  {
    id: 'dawa',
    name: 'Omnix Dawa',
    tagline: 'Pharmacy management',
    copy: 'Prescriptions, drug labels, refills, expiry tracking, controlled-substance register, KRA eTIMS, SHA + private insurance claims. Calm and compliant.',
    ctaHref: '/buy?variant=dawa',
    accent: 'teal',
  },
  {
    id: 'retail',
    name: 'Omnix Retail',
    tagline: 'Shops, mini-marts, dukas',
    copy: 'Brands, variants, layby, special orders, shrinkage. Vibrant and quick at the till — built for fast-moving retail.',
    ctaHref: '/buy?variant=retail',
    accent: 'amber',
  },
  {
    id: 'hospitality',
    name: 'Omnix Hospitality',
    tagline: 'Restaurants, bars, lodges',
    copy: 'Tables, KOT/kitchen tickets, recipes, menu engineering, room bookings, folios. Karibu sana — hospitality-grade speed.',
    ctaHref: '/buy?variant=hospitality',
    accent: 'emerald',
  },
  {
    id: 'hardware',
    name: 'Omnix Hardware',
    tagline: 'Hardware stores',
    copy: 'Bulk pricing, quotations, delivery notes, contractor accounts, parts catalog. Built for heavy stock and heavy margins.',
    ctaHref: '/buy?variant=hardware',
    accent: 'orange',
  },
]

interface ReleaseRow {
  version: string
  variant?: VariantId
  publishedAt?: string
  title?: string
  summary?: string
  /** NSIS .exe installer (the per-user click-to-install one). Mapped
   *  from `releases.exe_url` in the new schema. */
  windowsNsisUrl?: string
  /** MSI installer (IT-managed / GPO deploys). Mapped from
   *  `releases.msi_url`. */
  windowsMsiUrl?: string
  windowsNsisSize?: number
  windowsMsiSize?: number
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

export default async function DownloadsPage() {
  // The new schema stores per-variant download URLs in releases.metadata.variants.
  // Each variant card resolves to its own .exe / .msi from the latest stable
  // release. Falls back to the canonical Pro URL stored in exeUrl/msiUrl if
  // metadata isn't populated yet.
  const { db, releases } = await import('@/db')
  const { eq, desc } = await import('drizzle-orm')
  const rows = await db
    .select()
    .from(releases)
    .where(eq(releases.channel, 'stable'))
    .orderBy(desc(releases.publishedAt))
    .limit(1)
  const r = rows[0]

  type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
  interface VariantUrls { exe?: string; msi?: string }

  const meta = (r?.metadata ?? {}) as { variants?: Partial<Record<VariantId, VariantUrls>> }
  const variants = meta.variants ?? {}

  // Canonical asset naming convention used by the CI build matrix:
  //   pro          → Omnix_<v>_x64-setup.exe  /  Omnix_<v>_x64_en-US.msi
  //   dawa         → Omnix.Dawa_<v>_x64-setup.exe  / .msi
  //   retail       → Omnix.Retail_<v>_x64-setup.exe / .msi
  //   hospitality  → Omnix.Hospitality_<v>_x64-setup.exe / .msi
  //   hardware     → Omnix.Hardware_<v>_x64-setup.exe / .msi
  // GitHub release URLs follow the same pattern under
  //   /releases/download/v<version>/<asset-name>
  // We use this as a deterministic fallback so a single missing entry in
  // metadata.variants (e.g. if one variant's CI notify failed silently)
  // never silently serves the Pro installer for a non-Pro variant.
  const PRODUCT_NAME: Record<VariantId, string> = {
    pro: 'Omnix',
    dawa: 'Omnix.Dawa',
    retail: 'Omnix.Retail',
    hospitality: 'Omnix.Hospitality',
    hardware: 'Omnix.Hardware',
  }

  function githubAssetUrl(v: VariantId, kind: 'exe' | 'msi'): string | undefined {
    if (!r) return undefined
    const tag = `v${r.version}`
    const file = kind === 'exe'
      ? `${PRODUCT_NAME[v]}_${r.version}_x64-setup.exe`
      : `${PRODUCT_NAME[v]}_${r.version}_x64_en-US.msi`
    return `https://github.com/visualoop/omnix/releases/download/${tag}/${file}`
  }

  function urlsFor(v: VariantId): VariantUrls {
    const stored = variants[v] ?? {}
    // If the sync populated a real URL for this variant, prefer it.
    // (Future-proofs against renamed assets / mirror URLs.)
    if (stored.exe || stored.msi) {
      return {
        exe: stored.exe ?? githubAssetUrl(v, 'exe'),
        msi: stored.msi ?? githubAssetUrl(v, 'msi'),
      }
    }
    // Otherwise derive from the canonical asset naming — NEVER fall back to
    // r.exeUrl/msiUrl for a non-Pro variant, because that would silently
    // serve the Pro installer in place of the trade-specific build.
    return {
      exe: githubAssetUrl(v, 'exe'),
      msi: githubAssetUrl(v, 'msi'),
    }
  }

  const baseRow: ReleaseRow | null = r
    ? {
        version: r.version,
        title: r.notes?.split('\n')[0] ?? `Omnix ${r.version}`,
        summary: r.notes ?? '',
        publishedAt: r.publishedAt.toISOString(),
        variant: 'pro',
      }
    : null

  const latestByVariant: Record<VariantId, (ReleaseRow & VariantUrls) | null> = {
    pro:         baseRow ? { ...baseRow, ...urlsFor('pro'),         windowsNsisUrl: urlsFor('pro').exe,         windowsMsiUrl: urlsFor('pro').msi } : null,
    dawa:        baseRow ? { ...baseRow, ...urlsFor('dawa'),        windowsNsisUrl: urlsFor('dawa').exe,        windowsMsiUrl: urlsFor('dawa').msi } : null,
    retail:      baseRow ? { ...baseRow, ...urlsFor('retail'),      windowsNsisUrl: urlsFor('retail').exe,      windowsMsiUrl: urlsFor('retail').msi } : null,
    hospitality: baseRow ? { ...baseRow, ...urlsFor('hospitality'), windowsNsisUrl: urlsFor('hospitality').exe, windowsMsiUrl: urlsFor('hospitality').msi } : null,
    hardware:    baseRow ? { ...baseRow, ...urlsFor('hardware'),    windowsNsisUrl: urlsFor('hardware').exe,    windowsMsiUrl: urlsFor('hardware').msi } : null,
  }

  const proRelease = latestByVariant.pro

  return (
    <>
      <PageHero
        eyebrow="Downloads"
        title={<>Pick your <em>trade.</em></>}
        description="Four Omnix variants — one purpose-built for each Kenyan SME trade. Windows 10 / 11, 64-bit, ~30s install."
      />

      {/* What's new in v0.10 */}
      <section className="section pb-0">
        <div className="container-wide">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[44rem]">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                  What&rsquo;s new in v0.10
                </span>
                <h2
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="mt-2 text-[clamp(22px,2vw,28px)] font-medium leading-[1.15] tracking-[-0.01em]"
                >
                  Sixteen branded PDFs, mixed-currency POs, customer display playlist, every record gets its own page.
                </h2>
              </div>
              <Link
                href="/changelog"
                className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline whitespace-nowrap"
              >
                Full changelog →
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-3 text-[13.5px] leading-[1.55] text-[var(--color-fg-muted)] sm:grid-cols-3">
              {[
                {
                  title: '16 branded PDFs',
                  body: 'VAT3, P9, P10, GRN, hardware quote, Z-report, aged AR/AP and more.',
                  href: '/#pdf-pack',
                },
                {
                  title: 'PO lifecycle',
                  body: 'Mixed currency, approval thresholds, three-way match, reverse-GRN.',
                  href: '/docs/purchase-orders',
                },
                {
                  title: '14 entity detail pages',
                  body: 'Product, customer, supplier, sale, employee, branch — each on its own page with tabs + activity.',
                  href: '/changelog',
                },
              ].map((b) => (
                <li key={b.title} className="flex flex-col gap-1">
                  <Link href={b.href} className="font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors">
                    {b.title}
                  </Link>
                  <span>{b.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {VARIANTS.map((v) => {
              const release = latestByVariant[v.id] ?? (v.id !== 'pro' ? proRelease : null)
              return <VariantCard key={v.id} variant={v} release={release} />
            })}
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal text-[var(--color-fg)]">
                System requirements
              </h3>
              <ul className="mt-5 space-y-3 text-[15px] text-[var(--color-fg-muted)]">
                <li className="flex items-start gap-3"><Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" /><span>Windows 10 (build 1809+) or Windows 11</span></li>
                <li className="flex items-start gap-3"><Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" /><span>64-bit processor (x86_64)</span></li>
                <li className="flex items-start gap-3"><Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" /><span>4 GB RAM minimum (8 GB recommended)</span></li>
                <li className="flex items-start gap-3"><Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" /><span>500 MB free disk space</span></li>
                <li className="flex items-start gap-3"><Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" /><span>Internet for M-Pesa, eTIMS, updates (optional)</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal text-[var(--color-fg)]">Installation guide</h3>
              <ol className="mt-5 space-y-3 text-[15px] text-[var(--color-fg-muted)]">
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">01</span><span>Download the variant for your trade</span></li>
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">02</span><span>Run <code className="font-[family-name:var(--font-mono)] text-[13px]">Omnix-{'{Variant}'}-setup.exe</code></span></li>
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">03</span><span>Sign in with your trial or paid licence</span></li>
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">04</span><span>Import your product list (Excel, CSV, or scan)</span></li>
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">05</span><span>Ring up your first sale</span></li>
              </ol>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-between border-t border-[var(--color-border)] pt-8">
            <Link href="/changelog" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
              <Icon.ArrowLeft className="size-3.5" weight="bold" />
              View changelog
            </Link>
            <Link href="/docs" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
              Read documentation
              <Icon.ArrowRight className="size-3.5" weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function VariantCard({ variant, release }: { variant: VariantInfo; release: ReleaseRow | null }) {
  const installerUrl = release?.windowsNsisUrl
  const msiUrl = release?.windowsMsiUrl
  return (
    <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-7 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="caption-mono">{variant.tagline}</span>
            {variant.badge ? (
              <span className="rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-0.5 font-[family-name:var(--font-ui)] text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                {variant.badge}
              </span>
            ) : null}
          </div>
          <h2 className="font-[family-name:var(--font-display)] mt-2 text-[28px] font-normal leading-tight text-[var(--color-fg)]">
            {variant.name}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">
            {variant.copy}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
        <div className="caption-mono">
          {release ? (
            <>
              v{release.version}
              {release.publishedAt ? <> · {formatDate(release.publishedAt)}</> : null}
              {release.windowsNsisSize ? <> · {formatBytes(release.windowsNsisSize)}</> : null}
            </>
          ) : (
            <>Coming soon</>
          )}
        </div>
        {installerUrl ? (
          <Button asChild size="lg">
            <a
              href={installerUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="gap-2 cursor-pointer"
            >
              <Icon.Download className="size-4" weight="bold" />
              Download
            </a>
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline" disabled>
            <span>Coming soon</span>
          </Button>
        )}
      </div>

      {msiUrl ? (
        <div className="mt-3 text-[12px] text-[var(--color-fg-subtle)]">
          IT-managed install? Use the{' '}
          <a
            href={msiUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="underline hover:text-[var(--color-accent)] cursor-pointer"
          >
            MSI{release?.windowsMsiSize ? ` (${formatBytes(release.windowsMsiSize)})` : ''}
          </a>
          .
        </div>
      ) : null}
    </div>
  )
}
