import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { ComplianceSection } from '@/components/landing/compliance-section'
import { FaqSection } from '@/components/landing/faq-section'
import { FounderNoteSection } from '@/components/landing/founder-note-section'
import { HeroSection } from '@/components/landing/hero-section'
import { ModulesRowsSection } from '@/components/landing/modules-rows-section'
import { OnePriceSection } from '@/components/landing/one-price-section'
import { ReceiptProofSection } from '@/components/landing/receipt-proof-section'
import { RecentWorkSection } from '@/components/landing/recent-work-section'
import { ThreeQuotesSection } from '@/components/landing/three-quotes-section'
import { AiSection } from '@/components/landing/ai-section'
import { TrustStripSection } from '@/components/landing/trust-strip-section'
import { UnifiedPlatformSection } from '@/components/landing/unified-platform-section'
import { WhySwitchSection } from '@/components/landing/why-switch-section'
import { ReliabilitySection } from '@/components/landing/reliability-section'

/**
 * Omnix homepage — long-scroll editorial, reordered around the BUYER JOURNEY
 * (attention → comprehension → belief → differentiation → proof →
 * risk-reversal → action). Every section answers one buying question and uses
 * only the existing warm-luxe design tokens/utilities. See
 * docs/WEBSITE_REDESIGN_PLAN.md §3 for the per-section rationale.
 *
 *  1. Hero            — platform thesis: "the platform your business grows with"
 *  2. Trust strip     — instant credibility (offline · M-Pesa · eTIMS · data · updates)
 *  3. Unified platform— "what does it replace?" — ERP + POS + AI in one
 *  4. The product     — real screenshots; the app sells itself (#product anchor)
 *  5. AI              — a business employee that knows your numbers + acts
 *  6. Built for trade — 4 modules, self-select into a module page
 *  7. Why switch      — overcome status-quo bias (before / Omnix)
 *  8. Reliability     — data safety, offline, updates, scale — depend on it for years
 *  9. M-Pesa + eTIMS  — local proof points (receipt → KRA filing)
 * 10. Owners' words   — social proof
 * 11. One price       — value-before-price, own forever, risk reversal
 * 12. FAQ             — final objections
 * 13. Founder note    — the human behind it, just before the ask
 * 14. Closing CTA     — convert: trial / download / talk
 */
import { cookies } from 'next/headers'
import { CURRENCIES, formatPrice, tierPrice, type PricingTierShape, type SupportedCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export default async function HomePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const settings = await getSiteSettings()
  // Currency from locale URL (strongest signal) → cookie → USD fallback.
  const { COUNTRY_TO_CURRENCY } = await import('@/i18n/routing')
  const localeCurrency = COUNTRY_TO_CURRENCY[locale.toLowerCase()] as SupportedCurrency | undefined
  const cookieStore = await cookies()
  const cookieCurrency = cookieStore.get('omnix_currency')?.value as SupportedCurrency | undefined
  const currency: SupportedCurrency =
    (localeCurrency && localeCurrency in CURRENCIES) ? localeCurrency :
    (cookieCurrency && cookieCurrency in CURRENCIES) ? cookieCurrency :
    'USD'

  // Pricing read from static config (was Payload global pre-v0.8.x).
  const { pricing } = await import('@/config/pricing')
  const onePriceAmount = pricing.starter.oneTimeFee[currency] ?? pricing.starter.oneTimeFee.KES
  const onePrice = onePriceAmount.toLocaleString('en-US')
  const oneCurrency = CURRENCIES[currency].symbol

  // Landing-page hero override + latest release pulled from Drizzle.
  // Hero content stays default (FALLBACK in components) — landing-page
  // global was a Payload concept; promote a static config later if we
  // want CMS-style overrides.
  let heroContent: Parameters<typeof HeroSection>[0]['content'] = undefined
  // Admin can upload a hero product-shot via /admin/media; we wire it in
  // here so the homepage swaps from PosPreview to the real screenshot
  // without a redeploy.
  try {
    const { getSlotImage } = await import('@/lib/media-slots')
    const shot = await getSlotImage('hero.product_shot')
    if (shot) {
      heroContent = {
        screenshot: {
          url: shot.url,
          alt: shot.alt ?? 'Omnix product screenshot',
        },
      }
    }
  } catch {
    // platform_media table cold or query failed — keep PosPreview fallback.
  }
  let latestRelease: Parameters<typeof HeroSection>[0]['latestRelease'] = undefined
  try {
    const { db, releases } = await import('@/db')
    const { eq, desc } = await import('drizzle-orm')
    const rows = await db
      .select()
      .from(releases)
      .where(eq(releases.channel, 'stable'))
      .orderBy(desc(releases.publishedAt))
      .limit(1)
    const r = rows[0]
    if (r) {
      latestRelease = {
        version: r.version,
        title: r.notes?.split('\n')[0] ?? `Omnix ${r.version}`,
        summary: r.notes ?? '',
      }
    }
  } catch {
    // DB cold or no releases yet — fall through.
  }
  // Resolve the four "trades" row images through the slot system so they
  // are editable from /admin/media (DB row wins; seeded R2 default else).
  let moduleRowImages: Record<string, string> = {}
  try {
    const { getSlotImage } = await import('@/lib/media-slots')
    const slugs = ['dawa-pharmacy', 'soko-retail', 'hardware', 'hospitality']
    const pairs = await Promise.all(
      slugs.map(async (s) => [s, (await getSlotImage(`module-row.${s}`))?.url ?? ''] as const),
    )
    moduleRowImages = Object.fromEntries(pairs.filter(([, url]) => url))
  } catch {
    // slot lookup failed — section falls back to its own default URLs.
  }

  return (
    <>
      <HeroSection
        content={heroContent}
        latestRelease={latestRelease}
        locale={locale}
        priceCaption={`${formatPrice(onePriceAmount, currency)} once`}
      />
      <TrustStripSection />
      <UnifiedPlatformSection />
      <div id="product" className="scroll-mt-24">
        <AiSection />
      </div>
      <ModulesRowsSection images={moduleRowImages} />
      <WhySwitchSection />
      <ReliabilitySection />
      <ReceiptProofSection />
      <RecentWorkSection />
      <ComplianceSection />
      <ThreeQuotesSection />
      <OnePriceSection price={onePrice} currency={oneCurrency} />
      <FaqSection />
      <FounderNoteSection />
      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
