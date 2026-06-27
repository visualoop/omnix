import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ReceiptToKraScene } from '@/components/marketing/illustrations/scenes'
import { FAQJsonLd } from '@/components/seo/jsonld'

export const metadata: Metadata = {
  title: 'KRA eTIMS software for Kenyan SMEs',
  description:
    'Native KRA eTIMS integration. Real-time invoice control unit signing, automatic VAT3 returns, P9 payroll, common error fixes. Built for Kenyan pharmacies, retailers, restaurants, hardware stores.',
  alternates: { canonical: 'https://omnix.co.ke/ke/etims' },
}

const FAQ_ENTRIES = [
  {
    question: 'What does KRA eTIMS actually do?',
    answer:
      'eTIMS is the Kenya Revenue Authority Electronic Tax Invoice Management System. Every VAT-registered business has to sign every sales invoice with a KRA control unit number in real time. Without a CU number, the receipt is not valid for the buyer to claim input VAT.',
  },
  {
    question: 'Do I need to register for eTIMS if my turnover is below the VAT threshold?',
    answer:
      'Yes. KRA requires every business owner in Kenya — VAT registered or not — to issue eTIMS-compliant invoices. The CU number is the proof a sale happened.',
  },
  {
    question: 'How long does eTIMS setup take in Omnix?',
    answer:
      'About fifteen minutes per branch. You enter your KRA PIN, paste the eTIMS portal credentials, and Omnix tests the connection by signing a test invoice. From that point, every sale auto-files.',
  },
  {
    question: 'What happens if KRA is offline?',
    answer:
      'Omnix queues the unsigned invoices locally. The till keeps working at full speed. The moment connectivity returns, Omnix retries every queued invoice in order, signs them, and updates each printed receipt with the CU number.',
  },
  {
    question: 'How does Omnix handle eTIMS error codes?',
    answer:
      'Omnix translates the cryptic CU error codes (CU0017, CU0042, etc.) into plain English plus the specific fix. The most common issue — invalid item HS codes — gets a one-click fix from the dashboard.',
  },
  {
    question: 'Can I file VAT3 returns directly from Omnix?',
    answer:
      'Yes. Omnix generates the VAT3 return automatically from the invoices you signed during the period. You verify, click Submit, and the return lands in iTax. The same goes for P9 payroll filings.',
  },
]

export default function ETIMSPage() {
  return (
    <>
      <FAQJsonLd entries={FAQ_ENTRIES} />
      <PageHero
        eyebrow="KRA eTIMS · Kenya"
        title={<>Real-time eTIMS. <em>Built in.</em></>}
        description="Every Omnix sale prints a real KRA eTIMS receipt with a control unit signature, VAT line, and CU invoice number. No batch upload, no month-end scramble. The same row hits KRA the same minute."
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup?variant=pro">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact?type=demo">Book a walkthrough</Link>
          </Button>
        </div>
      </PageHero>

      <section className="-mt-8 pb-8">
        <div className="container-wide">
          <div className="mx-auto max-w-[920px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-[var(--color-accent)] sm:p-12">
            <ReceiptToKraScene className="block w-full h-auto" />
          </div>
        </div>
      </section>

      {/* What we do natively */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">What native means here</span>
            <h2 className="headline-section mt-5 text-balance">No plug-in. <em>No partner SDK.</em></h2>
            <p className="lede mt-6">
              Omnix talks to KRA&apos;s control unit directly. Every invoice is signed at sale time. The receipt
              you print is the receipt KRA accepts. There is no second tool, no exporter, and no sync button to forget.
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
            {[
              {
                title: 'Real-time CU signing',
                body: 'Every invoice carries a CU number, CU invoice number, signature, and timestamp. Files within 2.5 seconds of print on a typical line.',
              },
              {
                title: 'Offline queue',
                body: 'When the line drops, sales keep printing. Omnix queues them and retries — first-in-first-out — the moment connectivity returns. The till never blinks.',
              },
              {
                title: 'VAT3 auto-return',
                body: 'Generates your monthly VAT3 from the period&apos;s signed invoices. You verify, sign, submit. The return lands in iTax without re-keying a single number.',
              },
              {
                title: 'P9 payroll',
                body: 'Payroll runs map to P9 batches and the year-end P10. PAYE, NHIF and NSSF lines align with the current statute.',
              },
              {
                title: 'Buyer PIN capture',
                body: 'Capture the buyer&apos;s KRA PIN at checkout. The CU invoice flags B2B sales correctly so the buyer can claim input VAT.',
              },
              {
                title: 'Error translation',
                body: 'Cryptic CU errors (CU0017 invalid HS code; CU0042 stale clock; CU0203 blocked PIN) are translated to plain English with a one-click fix.',
              },
            ].map((feat) => (
              <li key={feat.title}>
                <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal leading-[1.2] tracking-[-0.01em] text-[var(--color-fg)]">
                  {feat.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">{feat.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The setup walkthrough */}
      <section className="section bg-[var(--color-surface)]">
        <div className="container-wide">
          <div className="mb-16 max-w-[44rem]">
            <span className="eyebrow">Step-by-step</span>
            <h2 className="headline-section mt-5 text-balance">Setup is <em>fifteen minutes.</em></h2>
            <p className="lede mt-6">
              The longest part is finding your KRA PIN if it isn&apos;t already on the wall. After that, every step
              has a button. Most owner-operators do this themselves.
            </p>
          </div>
          <ol className="space-y-2 lg:space-y-0">
            {[
              {
                step: '01',
                title: 'Register your business on the KRA eTIMS portal.',
                body: 'iTax → eTIMS → Register. You receive your eTIMS portal credentials (username + temporary password) by email within minutes.',
              },
              {
                step: '02',
                title: 'Open Omnix → Settings → eTIMS → Connect.',
                body: 'Paste your KRA PIN, eTIMS username, and temporary password. Omnix rotates the password to a strong one on first connect — you never need it again.',
              },
              {
                step: '03',
                title: 'Run a test invoice.',
                body: 'Omnix prints a KES 1 test sale and shows the round-trip: signature, CU number, and KRA portal entry. Until the test passes, real sales aren&apos;t signed.',
              },
              {
                step: '04',
                title: 'Map your products to HS codes.',
                body: 'Omnix suggests an HS code for every product line based on KEMSA + KEBS classifications. You confirm. Wrong codes are the #1 source of CU rejection.',
              },
              {
                step: '05',
                title: 'Ring up your first real sale.',
                body: 'Print receipt → CU number on receipt → KRA portal shows the invoice within 3 seconds.',
              },
            ].map((s) => (
              <li
                key={s.step}
                className="grid grid-cols-[auto_1fr] items-baseline gap-8 border-b border-[var(--color-border)] py-12 lg:gap-16 lg:py-14"
              >
                <span
                  className="font-[family-name:var(--font-display)] text-[clamp(56px,7vw,96px)] font-light leading-none tracking-[-0.04em] text-[var(--color-accent)]"
                  style={{ fontVariantNumeric: 'lining-nums' }}
                >
                  {s.step}
                </span>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-[clamp(20px,2.4vw,32px)] font-light leading-[1.15] tracking-[-0.015em] text-[var(--color-fg)] text-balance">
                    {s.title}
                  </p>
                  <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[60ch]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Common error reference */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">CU error reference</span>
            <h2 className="headline-section mt-5 text-balance">Every error code <em>has a fix.</em></h2>
            <p className="lede mt-6">
              Omnix shows these in plain English at the till. Listed here so you know what you&apos;re getting before you install.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-start font-[family-name:var(--font-ui)] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border-strong)]">
                  <th className="py-4 pr-6 font-[family-name:var(--font-display)] text-[16px] font-normal text-[var(--color-fg)]">Code</th>
                  <th className="py-4 pr-6 font-[family-name:var(--font-display)] text-[16px] font-normal text-[var(--color-fg)]">What KRA means</th>
                  <th className="py-4 pr-6 font-[family-name:var(--font-display)] text-[16px] font-normal text-[var(--color-fg)]">Omnix fix</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['CU0017', 'Invalid item HS code', 'Re-map the product. Omnix suggests the right HS from KEBS classification, one click confirm.'],
                  ['CU0042', 'Time skew between CU and KRA exceeds 30s', 'Omnix re-syncs the workstation clock to time.kra.go.ke automatically.'],
                  ['CU0203', 'Buyer PIN blocked or invalid', 'Re-validate the PIN against KRA&apos;s online check; if blocked, save the sale as B2C without a buyer PIN.'],
                  ['CU0085', 'Stockout for an item with serial-tracked stock', 'Reconcile the item&apos;s stock count; eTIMS won&apos;t sign sales of items it can&apos;t locate in your declared register.'],
                  ['CU0144', 'VAT category mismatch (zero-rated billed as standard)', 'Edit the product&apos;s VAT category (16%, 8%, 0%, exempt). Omnix flags drug categories per PPB and basic-foods per Finance Act.'],
                  ['CU0301', 'Branch ID not registered with eTIMS', 'Add the branch in iTax → eTIMS → Branches; copy the new branch ID into Omnix Settings.'],
                ].map(([code, desc, fix]) => (
                  <tr key={code} className="border-b border-[var(--color-border)]">
                    <td className="py-4 pr-6 font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-accent)]">{code}</td>
                    <td className="py-4 pr-6 text-[var(--color-fg)]">{desc}</td>
                    <td className="py-4 pr-6 text-[var(--color-fg-muted)] max-w-[40ch]">{fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-8 text-[13px] text-[var(--color-fg-subtle)] max-w-[60ch]">
            We mirror KRA&apos;s changelog as fixes ship. If a new error code appears, the till shows the latest English translation
            on next launch — no app update needed.
          </p>
        </div>
      </section>

      {/* Once it's signed — what comes out the other end */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">Once it&rsquo;s signed</span>
            <h2 className="headline-section mt-5 text-balance">
              Here&rsquo;s what comes out.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
              The eTIMS sign-off is just step one. Omnix turns those signed receipts into
              the documents you actually file with KRA &mdash; populated, branded, ready to
              copy across.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
            {[
              {
                eyebrow: 'KRA · Monthly',
                title: 'VAT3 Return',
                body: 'Output VAT minus input VAT, period totals, payable line. Branded with your KRA PIN.',
                href: '/samples/vat3-sample.pdf',
              },
              {
                eyebrow: 'Daily',
                title: 'Day book',
                body: 'Every product sold, every payment method, refunds, expenses, net cash.',
                href: '/#pdf-pack',
              },
              {
                eyebrow: 'Receivables',
                title: 'Aged AR + claims',
                body: 'Customers who owe you, by bucket. Insurance claim batches grouped by provider.',
                href: '/#pdf-pack',
              },
            ].map((p) => (
              <li
                key={p.title}
                className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {p.eyebrow}
                </span>
                <h3
                  style={{ fontFamily: 'var(--font-display, serif)' }}
                  className="text-[22px] font-medium leading-[1.1] tracking-[-0.01em]"
                >
                  {p.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
                  {p.body}
                </p>
                <a
                  href={p.href}
                  target={p.href.startsWith('/samples/') ? '_blank' : undefined}
                  rel={p.href.startsWith('/samples/') ? 'noopener noreferrer' : undefined}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                >
                  {p.href.startsWith('/samples/') ? 'Download sample →' : 'See all →'}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="eyebrow">Honest answers</span>
              <h2 className="headline-section mt-5 text-balance">Questions <em>before you buy.</em></h2>
            </div>
            <ol className="lg:col-span-8">
              {FAQ_ENTRIES.map((q, i) => (
                <li key={i} className={i === FAQ_ENTRIES.length - 1 ? 'border-y border-[var(--color-border)]' : 'border-t border-[var(--color-border)]'}>
                  <details className="group">
                    <summary className="grid w-full grid-cols-[1fr_auto] items-baseline gap-6 py-7 cursor-pointer list-none">
                      <span className="font-[family-name:var(--font-display)] text-[clamp(20px,1.6vw,24px)] font-normal leading-[1.3] tracking-[-0.014em] text-[var(--color-fg)]">
                        {q.question}
                      </span>
                      <span aria-hidden className="text-[var(--color-fg-subtle)]">+</span>
                    </summary>
                    <p className="pb-8 pr-12 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">{q.answer}</p>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section relative overflow-hidden border-t border-[var(--color-border)] py-32 sm:py-40">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 80% at 50% 50%, var(--color-accent-soft), transparent 70%), var(--color-bg)' }} />
        <div className="container-wide relative">
          <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
            <h2 className="font-[family-name:var(--font-display)] text-balance text-[clamp(40px,5vw,72px)] italic font-light leading-[1.05] tracking-[-0.025em] text-[var(--color-fg)]">
              File <em className="not-italic text-[var(--color-accent)]">at the till.</em> Stop staying back.
            </h2>
            <div className="mt-10 flex flex-col items-center gap-7">
              <Button asChild size="xl">
                <Link href="/signup?variant=pro" className="gap-2">
                  Start free trial
                  <Icon.ArrowRight className="size-4" weight="bold" />
                </Link>
              </Button>
              <p className="caption-mono text-[var(--color-fg-subtle)]">30 days · no card · KES 30,000 once if you keep it</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
