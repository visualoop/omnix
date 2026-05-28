import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, CloudUpload, MapPin, Plus } from '@/components/icons'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Button } from '@/components/ui/button'
import { formatDate, PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'Billing' }

export default async function BillingPage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  const res = await payload.find({
    collection: 'licenses',
    where: { customer: { equals: user.id } },
    sort: '-createdAt',
    limit: 50,
  })
  const licenses = res.docs as unknown as {
    id: string
    licenseKey: string
    tier: string
    status: string
    maintenanceUntil?: string
    cloudBackupEnabled?: boolean
    cloudBackupExpiresAt?: string
    maxBranches?: number
    maxMachines?: number
  }[]

  return (
    <div className="space-y-8">
      <PageHeading
        title="Billing & add-ons"
        subtitle="Renew maintenance, enable cloud backup, add branches or machine seats. All without recurring fees you didn't ask for."
      />

      {/* Maintenance renewals */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <header className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
            Maintenance renewals
          </h2>
          <p className="mt-1 text-[12px] text-[var(--color-fg-subtle)]">
            We don't auto-charge. We send reminders 30, 7 and 1 day before expiry.
          </p>
        </header>
        {licenses.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
            No licences yet.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {licenses.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-baseline gap-3">
                    <code className="font-mono text-[14px] tabular-nums text-[var(--color-fg)]">
                      {l.licenseKey}
                    </code>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                      {l.tier}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
                    Maintenance until {formatDate(l.maintenanceUntil)}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/buy/${l.id}?type=maintenance`}>Renew</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add-ons */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AddOnCard
          icon={CloudUpload}
          title="Cloud backup"
          price="KES 500 / month / branch"
          body="Encrypted nightly snapshots to Cloudflare R2. Restore in minutes after a stolen or lost machine."
          cta="Enable for a licence"
          href="/buy?type=cloud_backup"
        />
        <AddOnCard
          icon={MapPin}
          title="Extra branch"
          price="KES 15,000 one-time"
          body="Add a branch to an existing licence. No new key to manage."
          cta="Add a branch"
          href="/buy?type=extra_branch"
        />
        <AddOnCard
          icon={Plus}
          title="Extra machine seat"
          price="KES 5,000 one-time"
          body="Raise the number of PCs that can activate with your licence key."
          cta="Add a seat"
          href="/buy?type=extra_machine"
        />
        <AddOnCard
          icon={ArrowRight}
          title="Major version upgrade"
          price="50 % off list price"
          body="Bump your licence's majorVersionCap when v2.x ships. Stay on v1.x as long as you like."
          cta="Learn more"
          href="/changelog"
        />
      </section>
    </div>
  )
}

function AddOnCard({
  icon: Icon,
  title,
  price,
  body,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  price: string
  body: string
  cta: string
  href: string
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Icon className="size-5" />
        </div>
        <div className="text-right font-mono text-[13px] tabular-nums text-[var(--color-accent)]">
          {price}
        </div>
      </div>
      <div>
        <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
          {body}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-auto self-start">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
