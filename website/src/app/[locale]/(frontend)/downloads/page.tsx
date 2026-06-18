import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { getPayload } from 'payload'
import config from '@/payload.config'

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
    id: 'pro',
    name: 'Omnix Pro',
    tagline: 'Multi-trade — every module',
    copy: 'For businesses that span more than one trade. Bundles Dawa, Retail, Hospitality and Hardware into one binary. Ideal for pharmacy + canteen, hotel + retail, hardware + canteen.',
    ctaHref: '/buy?variant=pro',
    accent: 'navy',
    badge: 'Recommended',
  },
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
  windowsNsisUrl?: string
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
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Latest release per variant. Fan out 5 queries in parallel.
  const latestByVariant: Record<VariantId, ReleaseRow | null> = {
    pro: null,
    dawa: null,
    retail: null,
    hospitality: null,
    hardware: null,
  }
  await Promise.all(
    (Object.keys(latestByVariant) as VariantId[]).map(async (v) => {
      const result = await payload.find({
        collection: 'releases',
        where: {
          and: [
            { status: { equals: 'published' } },
            { channel: { equals: 'stable' } },
            { variant: { equals: v } },
          ],
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
      })
      latestByVariant[v] = (result.docs[0] as unknown as ReleaseRow) ?? null
    }),
  )

  // For pre-v0.4.0 backfill: if a variant has no row yet, fall back to the
  // latest "pro" row so the legacy installer still appears for visitors.
  const proRelease = latestByVariant.pro

  return (
    <>
      <PageHero
        eyebrow="Downloads"
        title={<>Pick your <em>trade.</em></>}
        description="Five Omnix variants — one purpose-built for each Kenyan SME trade, plus Pro for multi-trade businesses. Windows 10 / 11, 64-bit, ~30s install."
      />

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
            MSI ({formatBytes(release?.windowsMsiSize)})
          </a>
          .
        </div>
      ) : null}
    </div>
  )
}
