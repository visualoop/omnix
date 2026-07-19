import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import * as Icons from '@/components/icons'
import { ArrowRight, Check } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Container, SectionHeader } from '@/components/ui/section'
import { PageHero } from '@/components/marketing/page-hero'
import { moduleBySlug, moduleSlugs, MODULES_SEED } from '@/lib/modules-seed'
import { SoftwareJsonLd } from '@/components/seo/jsonld'
import { currencyForCountry } from '@/lib/currency'

interface V10Highlight {
  eyebrow: string
  title: string
  body: string
  href?: string
}

/**
 * v0.10 highlights tailored per module. Each entry shows three things
 * the module gained in the latest release. Keep these tight — the
 * module page already has a long features bento; this row is the
 * "what's actually new" recap for repeat visitors.
 */
function moduleV10Highlights(slug: string): V10Highlight[] {
  const COMMON: V10Highlight[] = [
    {
      eyebrow: 'Compliance',
      title: 'VAT3, P9, P10 — branded',
      body: 'Every Kenyan filing prints to PDF in your masthead. Sample on the homepage.',
      href: '/#pdf-pack',
    },
    {
      eyebrow: 'Detail pages',
      title: 'Every record has its own page',
      body: 'Product, customer, supplier, sale, employee, branch — no more inline-only views.',
      href: '/changelog',
    },
  ]
  switch (slug) {
    case 'dawa':
      return [
        {
          eyebrow: 'Pharmacy compliance',
          title: 'Controlled-substances register PDF',
          body: 'Daily register with batch numbers + prescriber + patient ID, ready for the Pharmacy & Poisons Board inspection.',
          href: '/samples/grn-sample.pdf',
        },
        ...COMMON,
      ]
    case 'retail':
      return [
        {
          eyebrow: 'Stock control',
          title: 'Stock-take variance + dead stock + reorder',
          body: 'Three branded PDFs that turn a Saturday count into a 5-minute reconciliation.',
          href: '/samples/grn-sample.pdf',
        },
        ...COMMON,
      ]
    case 'hardware':
      return [
        {
          eyebrow: 'Quotation flow',
          title: 'Hardware Quote PDF with bulk discount + VAT',
          body: 'Replaces the Excel quote you used to email. Validity stamped on the page so customers know the lock-in.',
          href: '/samples/hardware-quote-sample.pdf',
        },
        ...COMMON,
      ]
    case 'hospitality':
      return [
        {
          eyebrow: 'Shift close',
          title: 'Z-Report — every payment method',
          body: 'Cash, M-Pesa, card, room-charge folio reconciled at shift close with cash variance flagged.',
          href: '/samples/z-report-sample.pdf',
        },
        ...COMMON,
      ]
    case 'pro':
    default:
      return [
        {
          eyebrow: 'Procurement',
          title: 'Mixed-currency PO + three-way match',
          body: 'Foreign-supplier POs in USD or EUR with FX snapshot at receipt. Approval workflow for high-value orders.',
          href: '/docs/purchase-orders',
        },
        ...COMMON,
      ]
  }
}

export async function generateStaticParams() {
  return moduleSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const m = moduleBySlug(slug)
  if (!m) return { title: 'Module not found' }
  return {
    title: `${m.name} — ${m.tagline}`,
    description: m.shortDescription,
  }
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug, locale } = await params
  const module = moduleBySlug(slug)
  if (!module) notFound()

  const others = MODULES_SEED.filter((m) => m.slug !== slug && m.status !== 'planned').slice(0, 3)

  // Structured data: each shippable module is a SoftwareApplication offering.
  const VARIANTS = ["dawa", "retail", "hardware", "hospitality", "salon"] as const
  const variant = (VARIANTS as readonly string[]).includes(slug) ? (slug as (typeof VARIANTS)[number]) : null

  return (
    <>
      {variant && <SoftwareJsonLd variant={variant} currency={currencyForCountry(locale)} locale={locale} />}
      <PageHero
        eyebrow={module.shortName}
        title={module.tagline}
        description={module.shortDescription}
      >
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/signup?variant=${encodeURIComponent(module.slug)}`}>Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact?type=demo">See a live walkthrough</Link>
          </Button>
        </div>
      </PageHero>

      {/* ── Compliance check ────────────────────────────────────── */}
      {module.compliance.length > 0 ? (
        <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30 py-14">
          <Container width="default">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Compliant with
            </span>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {module.compliance.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-[var(--color-fg)]"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* ── For who ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <Container width="wide">
          <SectionHeader
            eyebrow="For who"
            title={`Built for ${module.name.toLowerCase()} operators.`}
          />
          <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {module.for.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                <p className="text-[15px] leading-[1.5] text-[var(--color-fg)]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Features bento ──────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] py-20 sm:py-28">
        <Container width="wide">
          <SectionHeader
            eyebrow="What you get"
            title={
              <>
                Six features that{' '}
                <span className="text-[var(--color-fg-muted)]">
                  do real work.
                </span>
              </>
            }
          />
          <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {module.features.map((feature, i) => {
              const Icon =
                (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
                  feature.icon
                ] ?? Icons.Sparkles
              return (
                <div
                  key={i}
                  className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
                >
                  <div className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Container>
      </section>

      {/* ── What you'll need ────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 py-20 sm:py-28">
        <Container width="wide">
          <SectionHeader
            eyebrow="Before you start"
            title="What you'll need on hand."
            subtitle="Not many. We help you set up the rest on first install."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            {module.whatYouNeed.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6"
              >
                <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                  {item.label}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── v0.10 highlights — module-specific ──────────────────── */}
      <section className="border-t border-[var(--color-border)] py-20 sm:py-24">
        <Container width="wide">
          <SectionHeader
            eyebrow="New in v0.10"
            title={<>What just shipped <em>for {module.name.toLowerCase()}.</em></>}
          />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {moduleV10Highlights(module.slug).map((h) => (
              <div
                key={h.title}
                className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {h.eyebrow}
                </span>
                <h3 className="font-display text-[20px] font-medium leading-snug text-[var(--color-fg)]">
                  {h.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
                  {h.body}
                </p>
                {h.href ? (
                  <Link
                    href={h.href}
                    className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                  >
                    See it →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Pricing pullout ─────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <Container width="default">
          <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-8 lg:p-12">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Pricing
                </span>
                <h3 className="mt-3 font-display text-[28px] font-medium leading-tight text-[var(--color-fg)] sm:text-[32px]">
                  KES {module.pricing.from.toLocaleString()}{' '}
                  <span className="text-[var(--color-fg-subtle)]">{module.pricing.cadence}</span>
                </h3>
                <p className="mt-2 text-[15px] text-[var(--color-fg-muted)]">
                  {module.pricing.note}
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/pricing">
                  See full pricing
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Other modules ───────────────────────────────────────── */}
      {others.length > 0 ? (
        <section className="border-t border-[var(--color-border)] py-20 sm:py-28">
          <Container width="wide">
            <SectionHeader
              eyebrow="Also available"
              title="Other modules in the same licence."
            />
            <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3">
              {others.map((m) => (
                <Link
                  key={m.slug}
                  href={`/modules/${m.slug}`}
                  className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]"
                >
                  <h3 className="font-display text-[20px] font-medium text-[var(--color-fg)]">
                    {m.name}
                  </h3>
                  <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                    {m.tagline}
                  </p>
                  <p className="mt-3 text-[14px] text-[var(--color-fg-muted)]">
                    {m.shortDescription}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)]">
                    Read more
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] py-24 sm:py-32">
        <Container width="default">
          <div className="text-center">
            <h2 className="text-balance font-display text-[clamp(32px,4vw,52px)] font-medium leading-[1.05] text-[var(--color-fg)]">
              Ready to {module.shortName === 'Dawa' ? 'dispense' : module.shortName === 'Retail' ? 'sell' : 'run it'} your way?
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Button asChild size="lg">
                <Link href={`/signup?variant=${encodeURIComponent(module.slug)}`}>Download {module.shortName}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact?type=demo">Get a walkthrough</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
