import { headers } from 'next/headers'
import Link from 'next/link'
import { Download, Shield } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Downloads' }
export const revalidate = 60

interface ReleaseRow {
  version: string
  publishedAt?: string
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

export default async function DashboardDownloadsPage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  const [licensesRes, releasesRes] = await Promise.all([
    payload.find({
      collection: 'licenses',
      where: { customer: { equals: user.id } },
      limit: 5,
      sort: '-createdAt',
    }),
    payload.find({
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
    }),
  ])

  const licenses = licensesRes.docs as unknown as { id: string; licenseKey: string; status: string }[]
  const activeLicense = licenses.find(
    (l) => l.status === 'active' || l.status === 'trial' || l.status === 'maintenance_expired',
  )
  const latest = (releasesRes.docs[0] as unknown as ReleaseRow | undefined) ?? null

  return (
    <div className="space-y-8">
      <PageHeading
        title="Downloads"
        subtitle="Get the latest installer. Your licence key is auto-filled when you launch the app."
      />

      {activeLicense ? (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-hover)]">
            Your licence key
          </div>
          <code className="mt-2 block font-mono text-[18px] tabular-nums text-[var(--color-fg)]">
            {activeLicense.licenseKey}
          </code>
          <p className="mt-2 text-[12px] text-[var(--color-fg-muted)]">
            Paste this into Omnix on first launch to activate.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 lg:p-9">
        {latest ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12px] font-semibold text-[var(--color-accent)]">
                v{latest.version}
              </span>
              {latest.publishedAt ? (
                <time className="text-[12px] text-[var(--color-fg-subtle)]">
                  Released {formatDate(latest.publishedAt)}
                </time>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-[26px] font-medium text-[var(--color-fg)]">
              Latest stable release
            </h2>
            {latest.summary ? (
              <p className="mt-2 max-w-xl text-[14px] text-[var(--color-fg-muted)]">
                {latest.summary}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {latest.windowsNsisUrl ? (
                <Button asChild size="lg">
                  <a href={latest.windowsNsisUrl}>
                    <Download className="size-4" />
                    Download EXE{latest.windowsNsisSize ? ` · ${formatBytes(latest.windowsNsisSize)}` : ''}
                  </a>
                </Button>
              ) : null}
              {latest.windowsMsiUrl ? (
                <Button asChild size="lg" variant="outline">
                  <a href={latest.windowsMsiUrl}>
                    <Download className="size-4" />
                    Download MSI{latest.windowsMsiSize ? ` · ${formatBytes(latest.windowsMsiSize)}` : ''}
                  </a>
                </Button>
              ) : null}
            </div>

            <div className="mt-5 flex items-center gap-2 text-[12px] text-[var(--color-fg-subtle)]">
              <Shield className="size-3.5 text-[var(--color-accent)]" />
              Tauri-signed installer · auto-updater handles future versions
            </div>
          </>
        ) : (
          <p className="text-[14px] text-[var(--color-fg-muted)]">
            A new release is being prepared. Check back shortly.
          </p>
        )}
      </section>

      <Link
        href="/changelog"
        className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]"
      >
        Looking for an older version? See the full release archive on the public changelog →
      </Link>
    </div>
  )
}
