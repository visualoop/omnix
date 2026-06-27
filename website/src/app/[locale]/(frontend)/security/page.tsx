import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import {
  OfflineIllo, SecurityIllo, UpdatesIllo, SyncIllo,
  AccountingIllo,
} from '@/components/marketing/illustrations'

export const metadata: Metadata = {
  title: 'Security & reliability — Omnix',
  description:
    'Offline-first by design, encrypted on your own machine, signed automatic updates, multi-device LAN sync. The architectural reasons Omnix is safe to trust with a decade of business.',
}

const PILLARS = [
  {
    Illo: OfflineIllo,
    title: 'Offline-first architecture',
    body: 'Omnix is a native Windows app with its own embedded SQLite database. It is not a website that needs an internet connection. Power dies, the line drops, the modem fails — the till keeps trading. M-Pesa receipts queue, KRA receipts queue, payment reconciliations queue. Everything syncs the moment the line returns. There is no fallback "offline mode"; offline is the mode.',
  },
  {
    Illo: SecurityIllo,
    title: 'Your data, encrypted, on your machine',
    body: 'The database lives on your own PC, encrypted at rest with SQLCipher (AES-256). It is never on someone else\'s server. We cannot see your books, suppliers, customers, or staff. Stop paying for support and the software keeps working — you do not lose access to your own data.',
  },
  {
    Illo: AccountingIllo,
    title: 'Automatic local + cloud backup',
    body: 'Local backups every hour to a folder of your choice; cloud snapshots (encrypted with a key derived from your licence) to your own Cloudflare R2 or S3 bucket. Restore to a fresh machine with one click and your licence key. A stolen laptop never means a lost business.',
  },
  {
    Illo: UpdatesIllo,
    title: 'Signed updates, quietly applied',
    body: 'Every release is built and signed by us; the in-app updater verifies the signature before it installs. Updates download in the background and install when you close the app — like a modern code editor. Roll back to any prior version through the dashboard if you ever need to.',
  },
  {
    Illo: SyncIllo,
    title: 'LAN multi-device, no monthly seats',
    body: 'Add more terminals on the same network as you grow. They share live stock and sales over your LAN through Omnix\'s own sync server — no per-seat subscription, no internet dependency. A single extra-device licence is a one-time KES 10,000.',
  },
  {
    Illo: SecurityIllo,
    title: 'Permissions, audit log, RBAC',
    body: 'Real authentication with Argon2-hashed passwords, custom roles, and granular permissions. Every sensitive action — voids, refunds, stock adjustments, login attempts — is recorded to an immutable audit log you can review or export.',
  },
]

const FACTS = [
  { label: 'Encryption at rest', value: 'SQLCipher · AES-256' },
  { label: 'Password hashing', value: 'Argon2id' },
  { label: 'Update signature', value: 'Minisign · verified pre-install' },
  { label: 'Licensing', value: 'RSA-signed, device-bound' },
  { label: 'Backup encryption', value: 'AES-256 · key derived from licence' },
  { label: 'PII redaction (AI)', value: 'Pre-flight regex scrub' },
]

export default async function SecurityPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="Security & reliability"
        title={<>Software you can <em>depend on</em> for years.</>}
        description="The honest, architectural reasons Omnix is safe to run your business on for the next decade — not marketing promises, but how the app is actually built."
      >
        <div className="mt-6 flex items-center gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Link href="/migration" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            Plan a migration <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </PageHero>

      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-x-20 lg:gap-y-16">
            {PILLARS.map((p) => (
              <div key={p.title} className="flex gap-5">
                <span className="mt-1 shrink-0 text-[var(--color-accent)]"><p.Illo size={40} /></span>
                <div>
                  <h2 className="headline-sub text-[22px]">{p.title}</h2>
                  <p className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[52ch]">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-[var(--color-surface)]/40 border-y border-[var(--color-border)]">
        <div className="container-wide">
          <div className="max-w-[680px]">
            <span className="eyebrow">The plain facts</span>
            <h2 className="headline-section mt-5 text-balance">
              Standards, <em>specified.</em>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
            {FACTS.map((f) => (
              <div key={f.label} className="bg-[var(--color-bg)] p-6">
                <div className="caption-mono">{f.label}</div>
                <div className="font-[family-name:var(--font-ui)] mt-2 text-[15px] font-medium text-[var(--color-fg)]">{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
