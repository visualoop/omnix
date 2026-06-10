import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, Shield } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/dashboard/status-utils'
import { safePayloadFind, emptyPage, getDashboardCustomer } from '@/lib/dashboard-helpers'

export const metadata = { title: 'Download installer' }
export const revalidate = 60

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

const VARIANTS: VariantId[] = ['pro', 'dawa', 'retail', 'hospitality', 'hardware']

const VARIANT_NAME: Record<VariantId, string> = {
  pro: 'Omnix Pro',
  dawa: 'Omnix Dawa',
  retail: 'Omnix Retail',
  hospitality: 'Omnix Hospitality',
  hardware: 'Omnix Hardware',
}

const VARIANT_LANDING: Record<VariantId, string> = {
  pro: '/pro',
  dawa: '/dawa',
  retail: '/retail',
  hospitality: '/hospitality',
  hardware: '/hardware',
}

interface ReleaseRow {
  version: string
  variant?: VariantId
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

export default async function DashboardDownloadVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>
}) {
  const { variant: variantParam } = await params
  if (!VARIANTS.includes(variantParam as VariantId)) {
    notFound()
  }
  const variant = variantParam as VariantId

  const reqHeaders = await headers()
  const customer = await getDashboardCustomer(reqHeaders)
  const user = customer as unknown as { id: string | number; email: string }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Find a licence for this customer × this variant. If they don't own
  // this variant, send them to the index (where they'll see only the
  // variants they actually have).
  const licensesRes = await safePayloadFind(
    () =>
      payload.find({
        collection: 'licenses',
        where: {
          and: [
            { customer: { equals: user.id } },
            { variant: { equals: variant } },
          ],
        },
        limit: 1,
        sort: '-createdAt',
      }),
    emptyPage(),
    'download-variant-license',
  )
  const license = (licensesRes.docs[0] ?? null) as
    | null
    | { id: string | number; licenseKey: string; status?: string; variant?: VariantId }
  if (!license) {
    notFound()
  }

  // Latest release for this variant — fall back to Pro if the variant has
  // no published release yet (legacy v0.3.x bridge state).
  const variantReleaseRes = await safePayloadFind(
    () =>
      payload.find({
        collection: 'releases',
        where: {
          and: [
            { status: { equals: 'published' } },
            { channel: { equals: 'stable' } },
            { variant: { equals: variant } },
          ],
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
      }),
    emptyPage(),
    'download-variant-release',
  )
  let latest: ReleaseRow | null =
    (variantReleaseRes.docs[0] as unknown as ReleaseRow | undefined) ?? null

  let isProFallback = false
  if (!latest && variant !== 'pro') {
    const fb = await safePayloadFind(
      () =>
        payload.find({
          collection: 'releases',
          where: {
            and: [
              { status: { equals: 'published' } },
              { channel: { equals: 'stable' } },
              { variant: { equals: 'pro' } },
            ],
          },
          sort: '-publishedAt',
          limit: 1,
          depth: 0,
        }),
      emptyPage(),
      'download-variant-pro-fallback',
    )
    latest = (fb.docs[0] as unknown as ReleaseRow | undefined) ?? null
    isProFallback = !!latest
  }

  const productName = VARIANT_NAME[variant]

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/downloads"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All downloads
      </Link>

      <PageHeading
        title={`Download ${productName}`}
        subtitle="Get the latest installer for this trade. Your licence key auto-fills when you launch the app."
      />

      <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-hover)]">
          Your {productName} licence key
        </div>
        <code className="mt-2 block font-mono text-[18px] tabular-nums text-[var(--color-fg)]">
          {license.licenseKey}
        </code>
        <p className="mt-2 text-[12px] text-[var(--color-fg-muted)]">
          Paste this into {productName} on first launch to activate. The licence is bound
          to {productName} only — installing a different variant won't accept this key.
        </p>
      </div>

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
              {isProFallback ? (
                <span className="rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Pro fallback
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-[26px] font-medium text-[var(--color-fg)]">
              {productName} — latest stable release
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
                    Download {productName} (EXE){latest.windowsNsisSize ? ` · ${formatBytes(latest.windowsNsisSize)}` : ''}
                  </a>
                </Button>
              ) : null}
              {latest.windowsMsiUrl ? (
                <Button asChild size="lg" variant="outline">
                  <a href={latest.windowsMsiUrl}>
                    <Download className="size-4" />
                    MSI{latest.windowsMsiSize ? ` · ${formatBytes(latest.windowsMsiSize)}` : ''}
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
            A new {productName} release is being prepared. Check back shortly.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href={VARIANT_LANDING[variant]}
          className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]"
        >
          What does {productName} include? See the product page →
        </Link>
        <Link
          href="/changelog"
          className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]"
        >
          Older versions · public changelog →
        </Link>
      </div>
    </div>
  )
}
