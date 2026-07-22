/* Hallmark · Working Counter · boundary ledger · technical and evidence-led */
import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/security`

  return {
    title: 'Security architecture and data boundaries — Omnix',
    description:
      'How Omnix handles local SQLite data, offline work, passwords, roles, audit records, backups, licensing, and signed desktop updates — including the limits that remain with the device owner.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/security'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix security controls and their boundaries',
      description:
        'Review the verified local, connected, operating-system, backup, update, and licensing boundaries around an Omnix installation.',
      type: 'website',
    }),
  }
}

function whatsappQuestionHref(base: string | null): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent('Hi Omnix, I have a question about security, backups, or deployment.')}`
}

const CONTROLS = [
  {
    Icon: Icon.Database,
    title: 'Local SQLite record',
    status: 'On this device',
    body: 'Core business records are written to omnix.db in the operating system app-data directory. Counter work reads and writes that local database instead of waiting for a website request.',
    boundary: 'The database file is not encrypted by Omnix. Access at rest depends on the Windows account, device access, and any full-disk encryption configured by the owner.',
  },
  {
    Icon: Icon.Users,
    title: 'Local sign-in and roles',
    status: 'Inside the app',
    body: 'Passwords are stored as Argon2id hashes. The role system includes Owner, Manager, Cashier, and Viewer, with permissions, groups, and branch or module scopes available for finer control.',
    boundary: 'Roles limit actions inside Omnix. They do not replace Windows sign-in, screen locking, or device administration.',
  },
  {
    Icon: Icon.ClipboardList,
    title: 'Permission audit trail',
    status: 'Local application record',
    body: 'Omnix records allowed and denied high-risk or critical permission checks with the user, action, permission, outcome, and available entity context.',
    boundary: 'This is an append-only application table, not a tamper-proof external ledger. Someone with administrative access to the database file remains outside that boundary.',
  },
  {
    Icon: Icon.HardDrives,
    title: 'Backup and restore',
    status: 'Local and optional cloud',
    body: 'Omnix can create local database snapshots, list them, and restore one after taking a safety copy. Optional cloud backup compresses and encrypts a snapshot on the device with AES-256-GCM before upload.',
    boundary: 'Local .db backup files are ordinary database copies and are not encrypted by the local-backup command. Cloud upload and restore require a connection, an activated machine, and the customer-held backup password.',
  },
  {
    Icon: Icon.KeyRound,
    title: 'Licence verification',
    status: 'Local check after issue',
    body: 'The desktop app carries a public key and verifies the RSA signature on an Omnix licence payload before reading its modules and device entitlement.',
    boundary: 'Issuing, activating, or synchronising a licence crosses the internet boundary. A signed key helps detect altered licence data; it does not encrypt business records.',
  },
  {
    Icon: Icon.Download,
    title: 'Desktop updates',
    status: 'Connected operation',
    body: 'The Tauri updater is configured with Omnix release endpoints and an embedded updater public key so update artifacts can be signature-checked by the updater.',
    boundary: 'Checking for and downloading a release requires internet access. Omnix does not describe that process as protection against every compromise, and this page makes no automatic-install or rollback promise.',
  },
] as const

const BOUNDARIES = [
  {
    label: 'Works from the local installation',
    items: ['Core SQLite records', 'Local user sign-in and permissions', 'Application audit records', 'Local backup and restore'],
  },
  {
    label: 'Crosses the internet boundary',
    items: ['Licence issue, activation, and sync', 'Updater checks and downloads', 'Optional cloud backup', 'Connected payment and compliance services'],
  },
  {
    label: 'Remains the owner’s responsibility',
    items: ['Windows account security', 'Device and full-disk encryption', 'Physical access to the computer', 'Protecting local backup files and backup passwords'],
  },
] as const

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const demoHref = `/${locale}/contact?type=demo`
  const whatsappHref = whatsappQuestionHref(settings.whatsappUrl)

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        <header className="grid min-w-0 gap-10 border-b border-[var(--color-border)] pb-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end lg:gap-20 lg:pb-16">
          <div className="min-w-0">
            <h1 className="max-w-[12ch] text-balance text-[clamp(2.6rem,7vw,6.5rem)] font-semibold leading-[0.91] tracking-[-0.06em] text-[var(--color-fg)]">
              Know where the boundary is.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[54ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              Omnix keeps the working business record on the installed computer. This page separates controls implemented in the desktop app from protections supplied by the operating system and services that still need a connection.
            </p>
            <div className="mt-7 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={demoHref}>Book a security walkthrough</Link>
              </Button>
              {whatsappHref ? (
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <section aria-labelledby="boundary-heading" className="grid min-w-0 gap-8 border-b border-[var(--color-border)] py-12 sm:py-16 lg:grid-cols-[minmax(15rem,0.55fr)_minmax(0,1.45fr)] lg:gap-16">
          <div>
            <h2 id="boundary-heading" className="max-w-[13ch] text-[clamp(2rem,4vw,3.5rem)] leading-[0.98] tracking-[-0.045em]">
              Local first does not mean every service is local.
            </h2>
          </div>
          <div className="grid min-w-0 gap-px border-y border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-3">
            {BOUNDARIES.map((group) => (
              <article key={group.label} className="min-w-0 bg-[var(--color-bg)] px-5 py-6 sm:px-6">
                <h3 className="text-[15px] font-semibold leading-5 tracking-[-0.02em]">{group.label}</h3>
                <ul className="mt-5 space-y-3">
                  {group.items.map((item) => (
                    <li key={item} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-2 text-[13px] leading-5 text-[var(--color-fg-muted)]">
                      <span aria-hidden className="mt-[0.55rem] h-px bg-[var(--color-accent)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="controls-heading" className="py-12 sm:py-16 lg:py-20">
          <div className="grid min-w-0 gap-6 border-b border-[var(--color-border)] pb-8 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)] sm:items-end">
            <h2 id="controls-heading" className="max-w-[15ch] text-[clamp(2.2rem,5vw,4.75rem)] leading-[0.95] tracking-[-0.05em]">
              Six controls, with their limits attached.
            </h2>
            <p className="max-w-[48ch] text-[14px] leading-6 text-[var(--color-fg-muted)] sm:justify-self-end">
              Each boundary below names what the implementation does and what it does not cover. No “unbreakable,” “zero-risk,” or blanket encryption claim.
            </p>
          </div>

          <div className="grid min-w-0 lg:grid-cols-2">
            {CONTROLS.map((control, index) => (
              <article
                key={control.title}
                className={`min-w-0 border-b border-[var(--color-border)] py-8 sm:py-10 lg:px-10 ${index % 2 === 0 ? 'lg:border-r lg:pl-0' : 'lg:pr-0'}`}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-accent)]">
                    <control.Icon className="size-5" weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">{control.status}</p>
                    <h3 className="mt-2 text-[22px] leading-[1.05] tracking-[-0.035em] sm:text-[26px]">{control.title}</h3>
                  </div>
                </div>
                <p className="mt-6 max-w-[60ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">{control.body}</p>
                <div className="mt-6 border-t border-[var(--color-accent-line)] pt-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-accent)]">Boundary</p>
                  <p className="mt-2 max-w-[60ch] text-[13px] leading-6 text-[var(--color-fg-muted)]">{control.boundary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="review-heading" className="grid min-w-0 gap-8 border-t-2 border-[var(--color-fg)] py-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:py-12">
          <div>
            <h2 id="review-heading" className="text-[clamp(1.7rem,4vw,2.75rem)] leading-none tracking-[-0.04em]">Review the setup against your own controls.</h2>
            <p className="mt-4 max-w-[65ch] text-[14px] leading-6 text-[var(--color-fg-muted)]">
              Bring your device policy, backup routine, staff roles, and connectivity constraints to a demo. For a written security question, email{' '}
              <a className="underline decoration-[var(--color-border-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]" href={`mailto:${settings.supportEmail}`}>
                {settings.supportEmail}
              </a>.
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href={demoHref}>Book a demo</Link>
          </Button>
        </section>
      </PageContainer>
    </div>
  )
}
