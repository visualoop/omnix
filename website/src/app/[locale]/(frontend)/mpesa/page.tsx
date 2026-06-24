import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { FAQJsonLd } from '@/components/seo/jsonld'

export const metadata: Metadata = {
  title: 'M-Pesa POS for Kenyan businesses · STK push, paybill, till',
  description:
    'Native M-Pesa integration in your POS. STK push at the till, paybill + till reconciliation, automatic eTIMS receipts. No card, no manual entry.',
  alternates: { canonical: 'https://omnix.co.ke/ke/mpesa' },
}

const FAQ_ENTRIES = [
  {
    question: 'What does STK push mean?',
    answer:
      "STK push (SIM Toolkit) is the M-Pesa flow where the till sends a payment prompt straight to the customer's phone. They enter their PIN, the till receives the confirmation, and the receipt prints — usually in 8–12 seconds. No QR codes, no number-typing.",
  },
  {
    question: 'What M-Pesa modes does Omnix support?',
    answer:
      'STK push for in-store sales, paybill 4-digit + account number for credit + recurring billing, and till number for fast counter sales. All three modes reconcile back to the same Omnix sale ledger.',
  },
  {
    question: 'Do I need a Daraja API account?',
    answer:
      'You need a Daraja business account (free, registered against your KRA PIN). Omnix walks you through registration on first install. Most owners are live in under an hour.',
  },
  {
    question: 'How does reconciliation work?',
    answer:
      "Omnix listens to your paybill/till's confirmation callback in real time. Every M-Pesa transaction matches to an Omnix sale by reference number. Daily, the till compares the M-Pesa statement to its own ledger and flags any unmatched transactions for one-click reconciliation.",
  },
  {
    question: 'Does the till need internet?',
    answer:
      'The till works offline. M-Pesa STK push requires a connection at the moment of payment (the prompt has to reach the customer\'s phone). If the line is down, Omnix falls back to "M-Pesa manual": the customer pays, gives you the M-Pesa code, and Omnix files the sale. The till reconciles automatically when the line returns.',
  },
  {
    question: 'How much does Safaricom charge?',
    answer:
      "Safaricom's transaction fees aren't paid through Omnix — they go directly between you and Safaricom. Omnix doesn't take a margin on M-Pesa transactions. Whatever Safaricom charges your business is what you pay, no software middleman.",
  },
]

export default function MPESAPage() {
  return (
    <>
      <FAQJsonLd entries={FAQ_ENTRIES} />
      <PageHero
        eyebrow="M-Pesa · Kenya"
        title={<>Tap. <em>Pay.</em> Print.</>}
        description="STK push at the till. Paybill + till numbers reconcile to your Omnix ledger automatically. Every M-Pesa sale becomes an eTIMS receipt without you touching a key."
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

      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">Three M-Pesa flows. One ledger.</span>
            <h2 className="headline-section mt-5 text-balance">However your customers <em>like to pay.</em></h2>
            <p className="lede mt-6">
              Some pay by typing on their phone. Some pay against a paybill. Some hand over the till number on a sticker.
              Omnix supports all three and treats them as one.
            </p>
          </div>

          <ul className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-12">
            {[
              {
                title: 'STK push',
                lead: 'For in-person retail.',
                body: 'Cashier rings up the sale → enters customer phone → prompt lands → customer enters PIN → eTIMS receipt prints. Average round-trip: 11 seconds. The till never types a code.',
              },
              {
                title: 'Paybill',
                lead: 'For credit + recurring billing.',
                body: 'Customers pay your paybill against an account number (often the invoice number). Omnix matches the M-Pesa confirmation to the open invoice automatically and records the payment.',
              },
              {
                title: 'Till number',
                lead: 'For fast counter sales.',
                body: 'Customer keys in your till number, pays, shows you the M-Pesa code. Omnix matches the code to the open sale and signs the eTIMS receipt — same minute.',
              },
            ].map((flow) => (
              <li key={flow.title}>
                <h3 className="font-[family-name:var(--font-display)] text-[24px] font-normal leading-[1.15] tracking-[-0.01em] text-[var(--color-fg)]">
                  {flow.title}
                </h3>
                <p className="font-[family-name:var(--font-display)] mt-3 text-[18px] italic font-light leading-tight text-[var(--color-fg-muted)]">
                  {flow.lead}
                </p>
                <p className="mt-5 text-[14px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">{flow.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section bg-[var(--color-surface)]">
        <div className="container-wide">
          <div className="mb-16 max-w-[44rem]">
            <span className="eyebrow">Reconciliation</span>
            <h2 className="headline-section mt-5 text-balance">No more <em>end-of-day excel.</em></h2>
            <p className="lede mt-6">
              Omnix listens to your paybill / till callback URL in real time. Every M-Pesa code that lands gets matched to an
              open Omnix sale or invoice. The match is by reference number — exact, no fuzzy guesses.
            </p>
          </div>

          <ul className="space-y-6">
            {[
              {
                k: 'Live capture',
                v: 'Confirmation callback fires on every M-Pesa receipt. Omnix records it in under a second.',
              },
              {
                k: 'Auto-match',
                v: 'Reference number = invoice or sale number. If the buyer pays the wrong reference, Omnix queues the receipt as "unmatched" with a one-click reconcile button.',
              },
              {
                k: 'Daily statement check',
                v: "End of day, Omnix downloads your Safaricom B2B statement and compares against its own M-Pesa ledger. Variance highlights stand out in red — they're rare and usually a paybill cross-post.",
              },
              {
                k: 'Multi-paybill',
                v: 'Run more than one paybill (e.g. one for retail, one for wholesale)? Omnix routes each callback to the right branch + ledger.',
              },
            ].map((row) => (
              <li key={row.k} className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-x-8 border-t border-[var(--color-border)] py-7">
                <div className="font-[family-name:var(--font-display)] text-[18px] font-normal text-[var(--color-fg)]">{row.k}</div>
                <p className="text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[60ch]">{row.v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Z-report — shift close */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12 max-w-[44rem]">
            <span className="eyebrow">Shift close</span>
            <h2 className="headline-section mt-5 text-balance">
              The cashier&rsquo;s last screen, <em>printed.</em>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[58ch]">
              At the end of every shift Omnix prints a single PDF that breaks down cash,
              M-Pesa, card and insurance receipts &mdash; with the cash variance flagged
              when the till count doesn&rsquo;t match the system.
            </p>
          </div>
          <a
            href="/samples/z-report-sample.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            Download a sample Z-report PDF →
          </a>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="eyebrow">Honest answers</span>
              <h2 className="headline-section mt-5 text-balance">Questions about M-Pesa <em>+ Omnix.</em></h2>
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
              The customer pays. <em className="not-italic text-[var(--color-accent)]">The till knows.</em>
            </h2>
            <div className="mt-10 flex flex-col items-center gap-7">
              <Button asChild size="xl">
                <Link href="/signup?variant=pro" className="gap-2">
                  Start free trial
                  <Icon.ArrowRight className="size-4" weight="bold" />
                </Link>
              </Button>
              <p className="caption-mono text-[var(--color-fg-subtle)]">30 days · no card · works with any Safaricom paybill or till</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
