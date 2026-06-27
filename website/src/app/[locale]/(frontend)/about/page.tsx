import type { Metadata } from 'next'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { UnifiedPlatformIllo, AnalyticsIllo } from '@/components/marketing/illustrations'

export const metadata: Metadata = {
  title: 'About — who builds Omnix',
  description: 'A small team in Nairobi building software for Kenyan owner-operators. Every line of code is ours.',
}

export default async function AboutPage() {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow="About"
        title={<>Built in Nairobi. <em>For Nairobi.</em></>}
        description="A small team building software for Kenyan owner-operators. Every line of code is ours."
      />

      <section className="section">
        <div className="container-text">
          <div className="space-y-6 text-[17px] leading-[1.65] text-[var(--color-fg-muted)]">
            <p>We built Omnix after watching shop owners we know — pharmacies in Westlands, mini-marts in Kisumu, hardware shops in Eldoret — fight the same software all day and still close the till at midnight not knowing what they made.</p>
            <p>The brief was simple. One Windows app you download once. Runs offline. Files KRA receipts when the line comes back. Owns its own data on its own machine. Costs less than two months of any subscription.</p>
            <p>We&rsquo;re a small team in Nairobi. Every line of code is ours. If something breaks, you can write to me.</p>
          </div>

          <div className="mt-12 flex flex-col items-start">
            <span className="font-[family-name:var(--font-display)] text-[20px] italic font-normal text-[var(--color-fg)]">— Justin</span>
            <span className="caption-mono mt-2">Founder · Nairobi</span>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-text grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <span className="text-[var(--color-accent)]"><UnifiedPlatformIllo size={36} /></span>
            <span className="eyebrow mt-5">Why we exist</span>
            <h2 className="headline-sub mt-3">The honest version.</h2>
            <p className="mt-5 text-[16px] leading-[1.7] text-[var(--color-fg-muted)]">
              Kenyan SMEs deserve software that doesn&rsquo;t rent itself back to
              them every month. Software that works when the line drops, files
              with KRA correctly the first time, and runs the whole business
              from one app — not five spreadsheets and a paper book.
            </p>
          </div>
          <div>
            <span className="text-[var(--color-accent)]"><AnalyticsIllo size={36} /></span>
            <span className="eyebrow mt-5">Where we&rsquo;re going</span>
            <h2 className="headline-sub mt-3">The next decade.</h2>
            <p className="mt-5 text-[16px] leading-[1.7] text-[var(--color-fg-muted)]">
              One platform that grows with the business — from a single till in
              Kisumu to a multi-branch operation with kitchen, pharmacy and
              warehouse running side by side. An AI that earns its keep, not
              one that demos well. Yours to own, forever.
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight bg-[var(--color-surface)]/40">
        <div className="container-default">
          <div className="mb-12">
            <span className="eyebrow">The studio&rsquo;s beliefs</span>
            <h2 className="headline-section mt-5">Five <em>principles.</em></h2>
          </div>

          <ol className="space-y-8">
            {[
              'Software you own is better than software you rent.',
              'Offline-first is not a feature. It is the only honest architecture for a country where the line drops.',
              'A business should never lose its data because it forgot to update a credit card.',
              'The receipt the cashier prints should be the entry KRA reads. No batch upload, no month-end scramble.',
              'If we can&rsquo;t explain it to your grandmother, we built it wrong.',
            ].map((belief, i) => (
              <li key={i} className="flex items-start gap-6">
                <span className="font-[family-name:var(--font-display)] text-[clamp(48px,5vw,72px)] font-light leading-none text-[var(--color-accent)]">{String(i + 1).padStart(2, '0')}</span>
                <p className="font-[family-name:var(--font-display)] flex-1 text-[clamp(20px,2vw,28px)] italic font-light leading-snug text-[var(--color-fg)]">{belief}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
