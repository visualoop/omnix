import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { Container, SectionHeader } from '@/components/ui/section'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: 'Payroll pack — P9, P10, payslips ready to file',
  description:
    'Every monthly P10 batch and yearly P9 certificate as a branded PDF. M-Pesa salary export. Replaces 8 hours of Excel formatting.',
  alternates: { canonical: '/payroll-pack' },
  openGraph: {
    title: 'Payroll pack — P9, P10, payslips on letterhead',
    description:
      'Monthly P10, yearly P9, payslips, M-Pesa salary export — all branded, all one click.',
    url: '/payroll-pack',
  },
}

const STEPS = [
  {
    n: '01',
    title: 'Run payroll',
    body:
      "Enter the month's adjustments — overtime, leave, advances. Omnix uses your saved bands to compute PAYE, NSSF, SHIF, and Housing Levy automatically.",
  },
  {
    n: '02',
    title: 'Approve + lock',
    body:
      'Review the run as a finance owner. Approve to lock the figures so nothing changes after you start paying out. Audit log records who approved.',
  },
  {
    n: '03',
    title: 'Pay everyone',
    body:
      'Export the M-Pesa salary CSV. Upload to your business M-Pesa portal in two clicks. The bank or paybill column is auto-formatted per employee record.',
  },
  {
    n: '04',
    title: 'File',
    body:
      'Download the P10 PDF for monthly KRA filing on iTax. Year-end, hand each employee their P9 certificate as a PDF or printed copy.',
  },
]

const SUPPORTED = [
  'PAYE — banded tax with personal relief',
  'NSSF — Tier 1 + Tier 2 contributions',
  'SHIF — 2.75% of gross',
  'Housing Levy — 1.5% of gross',
  'Affordable Housing rebate (where eligible)',
  'Personal relief KES 2,400/month',
  'Insurance relief (life, health, education)',
  'Disability + mortgage relief',
  'Pension contributions (employer + employee)',
  'Net pay computation per pay-type (monthly, daily, hourly)',
]

const FAQ = [
  {
    q: 'Does Omnix file P10 directly with KRA?',
    a: 'No — we don\'t connect to iTax in the file-this-for-me sense (KRA doesn\'t expose that API to third parties). What we do: print a P10 PDF that has every figure formatted exactly the way iTax\'s P10 web form expects them, so you can copy each number across in under five minutes.',
  },
  {
    q: 'Are the tax bands kept up to date?',
    a: 'Yes. PAYE bands update automatically with the Finance Act. SHIF rates, NSSF tiers, Housing Levy and any KRA-published changes ship as part of the monthly maintenance update. If you\'re on a perpetual licence + active maintenance, the new rates land before they take effect.',
  },
  {
    q: 'What about M-Pesa salary disbursement?',
    a: 'Omnix exports a CSV in the exact column shape Safaricom\'s Business M-Pesa portal expects (phone, amount, reference). Upload it, approve from your phone, salary lands. Same flow for paybill or till disbursement.',
  },
  {
    q: 'Can employees download their own P9?',
    a: 'Yes. Each employee gets a profile in the Omnix dashboard. They can sign in with their email + verify, then download every payslip and the P9 for the year. Saves the HR team a stack of forwarded emails every December.',
  },
  {
    q: 'Multi-branch payroll?',
    a: 'One run can cover the whole organisation, OR split per branch if you have separate cost centres. The P10 batch reflects whichever shape you ran. M-Pesa export still produces one CSV per run.',
  },
  {
    q: 'What if an employee is mid-month hire or terminated?',
    a: 'Omnix prorates basic salary by working days within the period. Severance, gratuity and final-month adjustments live on the run as line items. The P9 for that year reflects only the months the employee was active.',
  },
]

export default async function PayrollPackPage() {
  const settings = await getSiteSettings()

  return (
    <>
      <PageHero
        eyebrow="Payroll pack"
        title={
          <>
            Your payroll, <em>ready to file.</em>
          </>
        }
        description="Every month: P10 batch, M-Pesa salary CSV, payslips. Every year: P9 certificates. All branded with your business name, all one click."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup?variant=pro">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/samples/p10-sample.pdf" target="_blank" rel="noopener noreferrer">
              See a sample P10 →
            </Link>
          </Button>
        </div>
      </PageHero>

      {/* What you get */}
      <section className="section">
        <Container width="wide">
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-3">
            {[
              {
                eyebrow: 'KRA · Annual',
                title: 'P9 Tax Certificate',
                body: 'Per-employee yearly summary: gross, PAYE, NSSF, SHIF, Housing Levy. Hand it to staff at year-end as a PDF.',
                href: '/samples/p9-sample.pdf',
              },
              {
                eyebrow: 'KRA · Monthly',
                title: 'P10 PAYE Return',
                body: 'Whole batch in one PDF. Employee #, name, KRA PIN, gross, PAYE, NSSF, SHIF, Housing Levy. Totals at the bottom.',
                href: '/samples/p10-sample.pdf',
              },
              {
                eyebrow: 'Per employee · Per period',
                title: 'Payslips',
                body: 'Branded, individual payslips with deductions broken out. Print in bulk or send via the dashboard.',
                href: null,
              },
            ].map((p) => (
              <div
                key={p.title}
                className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {p.eyebrow}
                </span>
                <h3
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="text-[24px] font-medium leading-[1.1] tracking-[-0.01em]"
                >
                  {p.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">{p.body}</p>
                {p.href ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                  >
                    Download sample →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Filing calendar */}
      <section className="section bg-[var(--color-surface)]/40">
        <Container width="wide">
          <SectionHeader
            eyebrow="Calendar"
            title={
              <>
                Built around <em>your filing dates.</em>
              </>
            }
          />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
              <div className="caption-mono">By the 9th</div>
              <h3 className="font-display mt-3 text-[24px] font-medium leading-tight text-[var(--color-fg)]">
                P10 monthly
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                File last month&rsquo;s PAYE on iTax. Omnix prints the P10 PDF the day
                you close payroll, so you have nine days to copy across at your own pace.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
              <div className="caption-mono">By 28 February</div>
              <h3 className="font-display mt-3 text-[24px] font-medium leading-tight text-[var(--color-fg)]">
                P9 annual
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                Issue every employee a P9 for the previous tax year. Bulk-export from
                Omnix in one click, hand them out as PDF or printed copy.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Workflow */}
      <section className="section">
        <Container width="wide">
          <SectionHeader
            eyebrow="The workflow"
            title={
              <>
                Four steps. <em>Every month.</em>
              </>
            }
          />
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-3">
                <span
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="text-[clamp(64px,8vw,96px)] font-light leading-none tracking-[-0.025em] text-[var(--color-fg-subtle)]"
                >
                  {s.n}
                </span>
                <h3 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
                  {s.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* What's supported */}
      <section className="section bg-[var(--color-surface)]/40">
        <Container width="default">
          <SectionHeader
            eyebrow="What we compute"
            title={
              <>
                Every Kenyan deduction. <em>Built in.</em>
              </>
            }
          />
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUPPORTED.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 text-[14px] leading-[1.55] text-[var(--color-fg)]"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
                {line}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Pricing pullout */}
      <section className="section">
        <Container width="default">
          <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-8 lg:p-12">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Included
                </span>
                <h3 className="mt-3 font-display text-[28px] font-medium leading-tight text-[var(--color-fg)] sm:text-[32px]">
                  No add-on fee.
                </h3>
                <p className="mt-2 text-[15px] text-[var(--color-fg-muted)]">
                  Payroll, P9, P10, payslips and M-Pesa salary export are part of every
                  Omnix licence. No per-employee fee, no monthly subscription.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/pricing">
                  See pricing
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="section">
        <Container width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="eyebrow">Honest answers</span>
              <h2 className="headline-section mt-5 text-balance">
                Questions <em>before you switch.</em>
              </h2>
            </div>
            <ol className="lg:col-span-8">
              {FAQ.map((q, i) => (
                <li
                  key={i}
                  className={
                    i === FAQ.length - 1
                      ? 'border-y border-[var(--color-border)]'
                      : 'border-t border-[var(--color-border)]'
                  }
                >
                  <details className="group">
                    <summary className="grid w-full grid-cols-[1fr_auto] items-baseline gap-6 py-7 cursor-pointer list-none">
                      <span
                        style={{ fontFamily: 'var(--font-display, serif)' }}
                        className="text-[clamp(20px,1.6vw,24px)] font-normal leading-[1.3] tracking-[-0.014em] text-[var(--color-fg)]"
                      >
                        {q.q}
                      </span>
                      <span aria-hidden className="text-[var(--color-fg-subtle)]">
                        +
                      </span>
                    </summary>
                    <p className="pb-8 pr-12 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
                      {q.a}
                    </p>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
