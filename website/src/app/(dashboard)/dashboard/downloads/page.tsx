import { headers } from 'next/headers'
import Link from 'next/link'
import { Download, Shield } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Downloads' }

const LATEST = {
  version: '0.2.0',
  date: '2026-04-12',
  msi: { url: '/downloads/Omnix_0.2.0_x64.msi', size: '52.4 MB' },
  exe: { url: '/downloads/Omnix_0.2.0_x64-setup.exe', size: '48.3 MB' },
}

export default async function DashboardDownloadsPage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  const res = await payload.find({
    collection: 'licenses',
    where: { customer: { equals: user.id } },
    limit: 5,
    sort: '-createdAt',
  })
  const licenses = res.docs as unknown as { id: string; licenseKey: string; status: string }[]
  const activeLicense = licenses.find(
    (l) => l.status === 'active' || l.status === 'trial' || l.status === 'maintenance_expired',
  )

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
            Paste this into Duka on first launch to activate.
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 lg:p-9">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[12px] font-semibold text-[var(--color-accent)]">
            v{LATEST.version}
          </span>
          <time className="text-[12px] text-[var(--color-fg-subtle)]">
            Released {LATEST.date}
          </time>
        </div>
        <h2 className="mt-3 font-display text-[26px] font-medium text-[var(--color-fg)]">
          Latest stable release
        </h2>
        <p className="mt-2 max-w-xl text-[14px] text-[var(--color-fg-muted)]">
          Banking & Recurring Invoices. Tauri-signed. Verifiable via SHA-256 on the public
          downloads page.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href={LATEST.msi.url}>
              <Download className="size-4" />
              Download MSI · {LATEST.msi.size}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={LATEST.exe.url}>
              <Download className="size-4" />
              Download EXE · {LATEST.exe.size}
            </a>
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2 text-[12px] text-[var(--color-fg-subtle)]">
          <Shield className="size-3.5 text-[var(--color-accent)]" />
          Tauri-signed installer · auto-updater handles future versions
        </div>
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
