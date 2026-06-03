import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const metadata: Metadata = {
  title: 'Downloads — get Omnix',
  description: 'Download the latest Omnix installer for Windows. Free 30-day trial, no credit card required.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface ReleaseRow {
  version: string
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

/** Strip bare URLs from legacy summaries so they can't overflow the layout. */
function cleanSummary(s?: string): string {
  if (!s) return ''
  return s
    .replace(/See\s+https?:\/\/\S+\s+for the full changelog\.?/i, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export default async function DownloadsPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const result = await payload.find({
    collection: 'releases',
    where: {
      and: [
        { status: { equals: 'published' } },
        { channel: { equals: 'stable' } },
      ],
    },
    sort: '-publishedAt',
    limit: 1,
    depth: 0,
  })
  const latest = (result.docs[0] as unknown as ReleaseRow | undefined) ?? null

  return (
    <>
      <PageHero
        eyebrow="Downloads"
        title={<>Get <em>Omnix.</em></>}
        description="Windows 10 / 11 · 64-bit · ~30s on most lines"
      />

      <section className="section">
        <div className="container-default">
          {latest ? (
            <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 lg:p-12">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="caption-mono">Latest release</span>
                    <span className="rounded-full border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-positive)]">
                      Stable
                    </span>
                  </div>
                  <h2 className="font-[family-name:var(--font-display)] mt-3 text-[clamp(32px,3.2vw,48px)] font-normal leading-tight text-[var(--color-fg)]">
                    Omnix v{latest.version}
                  </h2>
                  {cleanSummary(latest.summary) ? (
                    <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[52ch] break-words">
                      {cleanSummary(latest.summary)}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 caption-mono">
                    {latest.publishedAt ? <span>Released {formatDate(latest.publishedAt)}</span> : null}
                    {latest.windowsNsisSize ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formatBytes(latest.windowsNsisSize)}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>Tauri-signed</span>
                  </div>
                </div>
                {latest.windowsNsisUrl ? (
                  <Button asChild size="xl" className="ring-inset-soft lg:w-auto">
                    <a
                      href={latest.windowsNsisUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="gap-2 cursor-pointer"
                    >
                      <Icon.Download className="size-4" weight="bold" />
                      Download for Windows
                    </a>
                  </Button>
                ) : null}
              </div>
              {latest.windowsMsiUrl ? (
                <div className="mt-4 text-[12px] text-[var(--color-fg-subtle)]">
                  IT-managed install? Use the{' '}
                  <a
                    href={latest.windowsMsiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="underline hover:text-[var(--color-accent)] cursor-pointer"
                  >
                    MSI ({formatBytes(latest.windowsMsiSize)})
                  </a>
                  .
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
              <p className="text-[15px] text-[var(--color-fg-muted)]">
                A new release is being prepared. Check back shortly.
              </p>
            </div>
          )}

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
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">01</span><span>Download the installer</span></li>
                <li className="flex items-start gap-3"><span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]">02</span><span>Run <code className="font-[family-name:var(--font-mono)] text-[13px]">omnix-setup.exe</code></span></li>
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
