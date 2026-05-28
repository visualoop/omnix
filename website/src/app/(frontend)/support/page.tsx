import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Support — get help',
  description: 'Submit a ticket, browse the knowledge base, or reach us on WhatsApp. Priority support for paid licences.',
}

const FAQS = [
  { q: 'How do I reset my password?', a: 'Click "Forgot password" on the login screen. We\'ll email you a reset link.' },
  { q: 'Can I use Duka offline?', a: 'Yes. POS, inventory, payroll all run locally. Internet only needed for M-Pesa, eTIMS, and updates.' },
  { q: 'How do I add a new branch?', a: 'Settings → Branches → Add branch. You\'ll need the extra-branch upgrade (KES 15,000 one-time) if you\'re past your licence limit.' },
  { q: 'Where is my data stored?', a: 'Locally on your Windows machine in an encrypted SQLite database. Cloud backup is optional (KES 500/month per branch).' },
]

export default function SupportPage() {
  return (
    <>
      <PageHero
        eyebrow="Support"
        title={<>We&rsquo;re <em>here.</em></>}
        description="Submit a ticket, browse the knowledge base, or reach us on WhatsApp. Priority support for paid licences."
      />

      <section className="section">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <Link href="/contact" className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors hover:border-[var(--color-accent)]">
              <Icon.WhatsApp className="size-8 text-[var(--color-accent)]" weight="bold" />
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal text-[var(--color-fg)]">WhatsApp</h3>
              <p className="text-[15px] text-[var(--color-fg-muted)]">Fastest way to reach us. Usually respond within 4 hours.</p>
              <span className="font-[family-name:var(--font-ui)] mt-auto inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-accent)]">
                Open WhatsApp
                <Icon.ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" weight="bold" />
              </span>
            </Link>

            <Link href="/docs" className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors hover:border-[var(--color-accent)]">
              <Icon.BookOpen className="size-8 text-[var(--color-accent)]" weight="bold" />
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal text-[var(--color-fg)]">Documentation</h3>
              <p className="text-[15px] text-[var(--color-fg-muted)]">Step-by-step guides for every feature.</p>
              <span className="font-[family-name:var(--font-ui)] mt-auto inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-accent)]">
                Browse docs
                <Icon.ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" weight="bold" />
              </span>
            </Link>

            <Link href="/contact?type=support" className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors hover:border-[var(--color-accent)]">
              <Icon.Email className="size-8 text-[var(--color-accent)]" weight="bold" />
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal text-[var(--color-fg)]">Submit a ticket</h3>
              <p className="text-[15px] text-[var(--color-fg-muted)]">For detailed issues. We respond within 24 hours.</p>
              <span className="font-[family-name:var(--font-ui)] mt-auto inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-accent)]">
                Open ticket
                <Icon.ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" weight="bold" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section-tight bg-[var(--color-surface)]/40">
        <div className="container-default">
          <div className="mb-12">
            <span className="eyebrow">Common questions</span>
            <h2 className="headline-section mt-5">Quick <em>answers.</em></h2>
          </div>
          <dl className="space-y-8">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <dt className="font-[family-name:var(--font-display)] text-[20px] font-normal text-[var(--color-fg)]">{faq.q}</dt>
                <dd className="mt-3 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[68ch]">{faq.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-12">
            <Link href="/docs" className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]">
              See all documentation
              <Icon.ArrowRight className="size-3.5" weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
