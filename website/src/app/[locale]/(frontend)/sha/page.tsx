import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { FAQJsonLd } from '@/components/seo/jsonld'

export const metadata: Metadata = {
  title: 'SHA + NHIF claims billing software for Kenyan pharmacies + clinics',
  description:
    'Native SHA (Social Health Authority) and NHIF insurance claims. Member verification, copay split, batch submission, capitation tracking. Built for Kenyan pharmacies and clinics.',
  alternates: { canonical: 'https://omnix.co.ke/ke/sha' },
}

const FAQ_ENTRIES = [
  {
    question: "What's the difference between SHA and NHIF?",
    answer:
      "SHA — the Social Health Authority — replaced NHIF in October 2024 as Kenya's primary health insurance scheme. NHIF capitation is being wound down. New claims go through SHA. Omnix handles both: SHA claims to the new portal, NHIF claims to the legacy capitation runs that are still being settled.",
  },
  {
    question: 'Does Omnix verify SHA membership?',
    answer:
      "Yes. Type the patient's SHA number → Omnix calls the SHA verification endpoint → the patient's status (Active / Suspended / Defaulted), benefits, copay rate, and dependents come back in under 5 seconds. The till knows what the insurance covers before you dispense.",
  },
  {
    question: 'How does copay work?',
    answer:
      "If the SHA cover is 80% of a KES 1,000 prescription, the till splits the bill automatically: KES 800 to insurance (queued for batch submission), KES 200 copay to the patient. The patient pays the KES 200 by M-Pesa, cash or card; the till prints two lines on the receipt.",
  },
  {
    question: 'Do I have to submit claims one by one?',
    answer:
      'No. Omnix queues claims locally and submits them in daily batches at the time you choose. End-of-day batch is the most common. Each batch confirms back with line-by-line acceptance status. Failed lines stay in the queue with the rejection reason translated to plain English.',
  },
  {
    question: 'What about private insurance?',
    answer:
      "Omnix supports the major private schemes (AAR, Britam, Jubilee, Madison, Heritage, etc.) through a member-verification template. Each scheme's API is wired in by us; you just turn it on and paste the merchant credentials.",
  },
  {
    question: 'Does this work for clinics or only pharmacies?',
    answer:
      'Both. The Dawa variant is purpose-built for pharmacies and dispensaries; the Hospitality variant covers small clinics. Multi-branch hospital chains run on Pro with the SHA + private rails active across every branch.',
  },
]

export default function SHAPage() {
  return (
    <>
      <FAQJsonLd entries={FAQ_ENTRIES} />
      <PageHero
        eyebrow="SHA + NHIF · Kenya"
        title={<>Insurance, <em>billed at the till.</em></>}
        description="Member verification, copay split, batch submission, capitation tracking. SHA and the major private schemes — wired in. The till knows what insurance covers before you dispense."
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup?variant=dawa">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact?type=demo">Book a walkthrough</Link>
          </Button>
        </div>
      </PageHero>

      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">What's wired in</span>
            <h2 className="headline-section mt-5 text-balance">SHA. NHIF capitation. <em>Private schemes.</em></h2>
            <p className="lede mt-6">
              Omnix talks to each scheme directly. No claims clearing-house, no per-claim fee. The patient
              walks out, the receipt prints, and the queue carries the claim line for batch submission.
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
            {[
              { title: 'SHA', body: 'Member status, benefits, copay rate, dependents — verified in under 5 seconds. Claim batches submitted daily.' },
              { title: 'NHIF capitation', body: 'Legacy capitation runs still being settled. Omnix tracks unsubmitted claims through to payment.' },
              { title: 'AAR', body: 'Member verification + claim submission. Real-time eligibility check before dispensing.' },
              { title: 'Britam', body: 'Hospital + outpatient cover lookup. Pre-auth flow for high-value claims.' },
              { title: 'Jubilee', body: 'Outpatient + inpatient cover. Co-pay and per-visit limits enforced at the till.' },
              { title: 'Madison · Heritage · CIC', body: 'Mid-tier private cover. Same verification + claim flow.' },
            ].map((sch) => (
              <li key={sch.title}>
                <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal leading-[1.2] tracking-[-0.01em] text-[var(--color-fg)]">
                  {sch.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">{sch.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section bg-[var(--color-surface)]">
        <div className="container-wide">
          <div className="mb-16 max-w-[44rem]">
            <span className="eyebrow">The flow</span>
            <h2 className="headline-section mt-5 text-balance">From counter to claim, <em>one screen.</em></h2>
          </div>
          <ol className="space-y-2 lg:space-y-0">
            {[
              { step: '01', title: 'Verify the patient.', body: 'Type the SHA number (or scan the card). Active → benefits and copay rate display. Suspended → the till blocks the claim line and proposes cash payment with a printed reason.' },
              { step: '02', title: 'Add the prescription / service.', body: 'Each line gets the SHA-billable category and the appropriate price. Items outside cover (e.g. cosmetics) auto-route to cash.' },
              { step: '03', title: 'The till splits the bill.', body: 'Insurance share to a queued claim line. Copay share to the customer to settle by M-Pesa, cash, or card. Two lines on the receipt; one transaction.' },
              { step: '04', title: 'End-of-day batch.', body: 'Omnix submits every queued line to SHA in one batch. Each line confirms accepted or rejected with a translated reason.' },
              { step: '05', title: 'Settlement tracking.', body: 'Claims queue moves through Submitted → Accepted → Paid. Settlement matches against the SHA payout statement automatically.' },
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

      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="eyebrow">Honest answers</span>
              <h2 className="headline-section mt-5 text-balance">Questions <em>before you switch.</em></h2>
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

      <section className="section relative overflow-hidden border-t border-[var(--color-border)] py-32 sm:py-40">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 80% at 50% 50%, var(--color-accent-soft), transparent 70%), var(--color-bg)' }} />
        <div className="container-wide relative">
          <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
            <h2 className="font-[family-name:var(--font-display)] text-balance text-[clamp(40px,5vw,72px)] italic font-light leading-[1.05] tracking-[-0.025em] text-[var(--color-fg)]">
              The patient walks out. <em className="not-italic text-[var(--color-accent)]">The claim files itself.</em>
            </h2>
            <div className="mt-10 flex flex-col items-center gap-7">
              <Button asChild size="xl">
                <Link href="/signup?variant=dawa" className="gap-2">
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
