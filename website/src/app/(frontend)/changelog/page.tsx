import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const metadata: Metadata = {
  title: 'Changelog — what shipped',
  description: 'Every Omnix release, newest first. Download links and what changed.',
}

// Re-fetch every minute so a fresh tag shows up quickly without a redeploy.
export const revalidate = 60

interface ReleaseRow {
  id: string | number
  version: string
  publishedAt?: string
  title?: string
  summary?: string
  windowsNsisUrl?: string
  windowsMsiUrl?: string
  windowsNsisSize?: number
  channel?: string
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return ''
  const mb = n / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function formatDate(d?: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ChangelogPage() {
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
    limit: 100,
    depth: 0,
  })
  const releases = result.docs as unknown as ReleaseRow[]

  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title={<>What <em>shipped.</em></>}
        description="Every Omnix release, newest first. Download links and what changed."
      />

      <section className="section">
        <div className="container-default">
          {releases.length === 0 ? (
            <p className="text-[15px] text-[var(--color-fg-muted)]">No releases published yet.</p>
          ) : (
            <ol className="space-y-12">
              {releases.map((r, i) => {
                const downloadUrl = r.windowsNsisUrl ?? r.windowsMsiUrl
                return (
                  <li
                    key={r.id}
                    className={i === releases.length - 1 ? '' : 'border-b border-[var(--color-border)] pb-12'}
                  >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
                      <div className="lg:w-32">
                        <div className="caption-mono">{formatDate(r.publishedAt)}</div>
                        <div className="font-[family-name:var(--font-mono)] mt-2 text-[20px] tabular-nums text-[var(--color-accent)]">
                          v{r.version}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-[family-name:var(--font-display)] text-[clamp(24px,2.2vw,32px)] font-normal leading-tight text-[var(--color-fg)]">
                          {r.title ?? `Omnix v${r.version}`}
                        </h3>
                        {r.summary ? (
                          <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[60ch]">
                            {r.summary}
                          </p>
                        ) : null}
                        {downloadUrl ? (
                          <div className="mt-6 flex flex-wrap items-center gap-4">
                            <Link
                              href={downloadUrl}
                              className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            >
                              <Icon.Download className="size-3.5" weight="bold" />
                              Download
                              {r.windowsNsisSize ? ` (${formatBytes(r.windowsNsisSize)})` : ''}
                            </Link>
                            <span className="caption-mono">Tauri-signed</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </section>
    </>
  )
}
