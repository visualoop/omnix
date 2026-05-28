import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Changelog — what shipped',
  description: 'Every Duka release, newest first. Download links, SHA-256 hashes, and what changed.',
}

const RELEASES = [
  { version: '0.2.0', date: '2026-05-22', title: 'Banking & Recurring Invoices', changes: ['M-Pesa reconciliation', 'Scheduled invoices', 'Multi-currency support', 'Bank statement import (Equity, KCB, Co-op)'], size: '18.4 MB' },
  { version: '0.1.6', date: '2026-04-15', title: 'Pharmacy Insurance Claims', changes: ['NHIF/SHA batch claims', 'Private insurance billing', 'Prescription refills', 'Drug interaction warnings'], size: '17.8 MB' },
  { version: '0.1.5', date: '2026-03-10', title: 'Retail Promotions', changes: ['Buy-X-get-Y promotions', 'Loyalty points', 'Held sales', 'Stock take improvements'], size: '17.2 MB' },
  { version: '0.1.0', date: '2026-01-15', title: 'First Public Release', changes: ['Core ERP', 'Dawa Pharmacy module', 'Soko Retail module', 'KRA eTIMS integration', 'M-Pesa STK'], size: '16.5 MB' },
]

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title={<>What <em>shipped.</em></>}
        description="Every Duka release, newest first. Download links, SHA-256 hashes, and what changed."
      />

      <section className="section">
        <div className="container-default">
          <ol className="space-y-12">
            {RELEASES.map((release, i) => (
              <li key={release.version} className={i === RELEASES.length - 1 ? '' : 'border-b border-[var(--color-border)] pb-12'}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
                  <div className="lg:w-32">
                    <div className="caption-mono">{release.date}</div>
                    <div className="font-[family-name:var(--font-mono)] mt-2 text-[20px] tabular-nums text-[var(--color-accent)]">v{release.version}</div>
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-[clamp(24px,2.2vw,32px)] font-normal leading-tight text-[var(--color-fg)]">{release.title}</h3>
                    <ul className="mt-5 space-y-2">
                      {release.changes.map((change) => (
                        <li key={change} className="flex items-start gap-3 text-[15px] text-[var(--color-fg-muted)]">
                          <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <Link href={`/api/releases/${release.version}/download`} className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                        <Icon.Download className="size-3.5" weight="bold" />
                        Download ({release.size})
                      </Link>
                      <span className="caption-mono">SHA-256 verified</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
