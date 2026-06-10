import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'

export type VariantId = 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'pro'

export interface VariantLandingContent {
  id: VariantId
  productName: string
  tagline: string
  hero: {
    eyebrow: string
    title: React.ReactNode
    description: string
  }
  whoFor: {
    eyebrow: string
    items: string[]
  }
  signatureFeatures: Array<{ title: string; description: string }>
  compliance: string[]
  pricingNote: string
  downloadHref: string
  buyHref: string
}

export async function VariantLanding({ content }: { content: VariantLandingContent }) {
  const settings = await getSiteSettings()
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        description={content.hero.description}
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={content.buyHref}>Buy {content.productName}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={content.downloadHref}>Start 30-day free trial</Link>
          </Button>
        </div>
      </PageHero>

      {/* ── Who it's for ────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
        <div className="container-default">
          <span className="caption-mono">{content.whoFor.eyebrow}</span>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {content.whoFor.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]"
              >
                <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Signature features ─────────────────────────────────── */}
      <section className="section">
        <div className="container-wide">
          <div className="mb-12">
            <span className="caption-mono">What you get</span>
            <h2 className="headline-sub mt-3">
              {content.productName} — purpose-built for your trade
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {content.signatureFeatures.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal leading-tight text-[var(--color-fg)]">
                  {f.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-fg-muted)]">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ─────────────────────────────────────────── */}
      {content.compliance.length > 0 && (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
          <div className="container-default">
            <span className="caption-mono">Compliant with</span>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {content.compliance.map((c) => (
                <li
                  key={c}
                  className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]"
                >
                  <Icon.Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" weight="bold" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Pricing note ───────────────────────────────────────── */}
      <section className="section">
        <div className="container-default text-center">
          <span className="caption-mono">Pricing</span>
          <h2 className="font-[family-name:var(--font-display)] mt-3 text-[clamp(40px,5vw,72px)] font-normal leading-[1.05] text-[var(--color-fg)]">
            KES <em>30,000</em>
          </h2>
          <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] max-w-[44ch] mx-auto">
            {content.pricingNote}
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={content.buyHref}>Buy {content.productName}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={content.downloadHref}>30-day free trial</Link>
            </Button>
          </div>
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
