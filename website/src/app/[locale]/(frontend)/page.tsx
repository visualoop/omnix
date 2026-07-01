/**
 * Omnix homepage — v0.26.0 surgical cut.
 *
 * The old page had 15 full-width sections. Buyer research (see
 * docs/plans/HOMEPAGE_CRITIQUE.md) said: shop owners already know what a POS
 * is, so 15 sections of "trust me" copy trained them to skim past headers.
 * The purchase button also lived 14 scrolls away from the emotional peak
 * (right after the hero). Both fixed here.
 *
 * Now 7 sections, in the order that answers the three questions the owner
 * actually has (Will this work for me? Can I trust it? What do I pay?):
 *
 *   1. Hero            — thesis + primary CTA + secondary "see it work" scroll
 *   2. Trust strip     — offline · M-Pesa · eTIMS · data · updates
 *   3. AI section      — the real differentiator vs any other POS
 *   4. Modules row     — "which trade are you?" → self-serve to module page
 *   5. One price       — value → price → risk reversal
 *   6. FAQ             — final objections
 *   7. Closing CTA     — convert
 *
 * Sections cut from the homepage (still exist as components — moved to
 * module pages / /about later): Unified Platform (redundant with Modules
 * Row), Reliability (belongs on module pages), Receipt Proof (belongs on
 * Dawa), Recent Work, Compliance (belongs on module pages), Three Quotes
 * (need 20+ named customers before this reads as social proof), Founder
 * Note (moved to /about).
 *
 * Sticky mini-CTA appears after the user scrolls past the hero, hides
 * when the Closing CTA enters view — solves "purchase button is 14
 * scrolls away."
 */
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { FaqSection } from '@/components/landing/faq-section'
import { HeroSection } from '@/components/landing/hero-section'
import { ModulesRowsSection } from '@/components/landing/modules-rows-section'
import { OnePriceSection } from '@/components/landing/one-price-section'
import { AiSection } from '@/components/landing/ai-section'
import { TrustStripSection } from '@/components/landing/trust-strip-section'
import { StickyBuyCta } from '@/components/marketing/sticky-buy-cta'
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
  // Hero content is CMS-editable at /admin/site-content. Empty settings
  // fall back to the built-in defaults inside HeroSection.
  let heroContent: Parameters<typeof HeroSection>[0]['content'] = undefined
  try {
    const { getSetting } = await import('@/lib/platform-settings')
    const [eyebrow, headline, subheadline, ctaLabel, ctaHref] = await Promise.all([
      getSetting('landing.hero.eyebrow'),
      getSetting('landing.hero.headline'),
      getSetting('landing.hero.subheadline'),
      getSetting('landing.hero.cta_label'),
      getSetting('landing.hero.cta_href'),
    ])
    if (eyebrow || headline || subheadline || ctaLabel || ctaHref) {
      heroContent = {
        eyebrow: eyebrow || null,
        headline: headline || null,
        subheadline: subheadline || null,
        primaryCtaLabel: ctaLabel || null,
        primaryCtaHref: ctaHref || null,
      }
    }
  } catch {
    // platform_settings unavailable — fall through to built-in defaults.
  }
  // Admin can upload a hero product-shot via /admin/media; we wire it in
  // here so the homepage swaps from PosPreview to the real screenshot
  // without a redeploy.
  try {
    const { getSlotImage } = await import('@/lib/media-slots')
    const shot = await getSlotImage('hero.product_shot')
    if (shot) {
      heroContent = {
        ...(heroContent ?? {}),
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

  // CMS content for the closing CTA + one-price sections. All fields
  // empty = shipped defaults. Founder-note copy still fetches via the
  // /about page (moved off homepage in v0.26.0), so its CMS keys stay
  // valid; we just don't read them here anymore.
  let closingContent:
    | import('@/components/landing/closing-cta-section').ClosingCtaContent
    | undefined = undefined
  let onePriceContent:
    | import('@/components/landing/one-price-section').OnePriceContent
    | undefined = undefined
  try {
    const { getSetting } = await import('@/lib/platform-settings')
    const [
      closingHeadline, closingAccent, closingCtaLabel, closingWaPrompt,
      opEyebrow, opLead, opAccent,
    ] = await Promise.all([
      getSetting('landing.closing.headline'),
      getSetting('landing.closing.headline_accent'),
      getSetting('landing.closing.cta_label'),
      getSetting('landing.closing.whatsapp_prompt'),
      getSetting('landing.one_price.eyebrow'),
      getSetting('landing.one_price.commitment_lead'),
      getSetting('landing.one_price.commitment_accent'),
    ])
    if (closingHeadline || closingAccent || closingCtaLabel || closingWaPrompt) {
      closingContent = {
        headline: closingHeadline || null,
        headlineAccent: closingAccent || null,
        ctaLabel: closingCtaLabel || null,
        whatsappPrompt: closingWaPrompt || null,
      }
    }
    if (opEyebrow || opLead || opAccent) {
      onePriceContent = {
        eyebrow: opEyebrow || null,
        commitmentLead: opLead || null,
        commitmentAccent: opAccent || null,
      }
    }
  } catch {
    // platform_settings cold — fall through to defaults.
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
      <div id="product" className="scroll-mt-24">
        <AiSection />
      </div>
      <ModulesRowsSection images={moduleRowImages} />
      <OnePriceSection price={onePrice} currency={oneCurrency} content={onePriceContent} />
      <FaqSection />
      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} content={closingContent} />
      {/* Sticky bottom-right CTA — appears after the user scrolls past
          the hero, hides again when the ClosingCtaSection enters view.
          Solves "purchase button is 14 scrolls away" from v0.26 critique. */}
      <StickyBuyCta priceCaption={`${formatPrice(onePriceAmount, currency)} once`} />
    </>
  )
}
