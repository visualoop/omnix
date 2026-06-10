import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, Download } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { PageHeading } from '@/components/dashboard/status-utils'
import { safePayloadFind, emptyPage, getDashboardCustomer } from '@/lib/dashboard-helpers'

export const metadata = { title: 'Downloads' }
export const revalidate = 60

type VariantId = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

const VARIANT_NAME: Record<VariantId, string> = {
  pro: 'Omnix Pro',
  dawa: 'Omnix Dawa',
  retail: 'Omnix Retail',
  hospitality: 'Omnix Hospitality',
  hardware: 'Omnix Hardware',
}

const VARIANT_TAGLINE: Record<VariantId, string> = {
  pro: 'All four trades — multi-trade businesses',
  dawa: 'Pharmacy management',
  retail: 'Shops, mini-marts, dukas',
  hospitality: 'Restaurants, bars, lodges',
  hardware: 'Hardware stores, contractors',
}

interface LicenseDoc {
  id: string | number
  licenseKey: string
  status?: string
  variant?: VariantId
}

export default async function DashboardDownloadsIndex() {
  const reqHeaders = await headers()
  const customer = await getDashboardCustomer(reqHeaders)
  const user = customer as unknown as { id: string | number; email: string }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const licensesRes = await safePayloadFind(
    () =>
      payload.find({
        collection: 'licenses',
        where: { customer: { equals: user.id } },
        limit: 20,
        sort: '-createdAt',
      }),
    emptyPage(),
    'downloads-index-licenses',
  )
  const licenses = licensesRes.docs as unknown as LicenseDoc[]

  // Group licenses by variant — a customer could have multiple Pro licenses
  // (e.g. for different machines), but we only need ONE installer card per
  // variant (the same installer works across all licenses of that variant).
  const seen = new Set<VariantId>()
  const cards: { variant: VariantId; license: LicenseDoc }[] = []
  for (const lic of licenses) {
    const v = (lic.variant as VariantId) ?? 'pro'
    if (seen.has(v)) continue
    seen.add(v)
    cards.push({ variant: v, license: lic })
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title="Downloads"
        subtitle="Pick the variant for the device you're installing on. Your licence key is auto-filled inside the installer page."
      />

      {cards.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center">
          <p className="text-[14px] text-[var(--color-fg-muted)]">
            No licences yet. Start a free trial to get a download.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] hover:underline"
          >
            See pricing
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map(({ variant, license }) => (
            <Link
              key={variant}
              href={`/dashboard/downloads/${variant}`}
              className="group flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-accent)]"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]">
                  <Download className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                    {VARIANT_NAME[variant]}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--color-fg-muted)]">
                    {VARIANT_TAGLINE[variant]}
                  </div>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
                <code className="font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)] truncate">
                  {license.licenseKey}
                </code>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)] flex items-center gap-1 shrink-0">
                  Open
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-fg-muted)]">
        Need another trade? Visit{' '}
        <Link href="/pricing" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
          /pricing
        </Link>{' '}
        to start a separate trial for any variant.
      </div>
    </div>
  )
}
