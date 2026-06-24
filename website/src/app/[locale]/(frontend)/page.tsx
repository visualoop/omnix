import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { ComplianceSection } from '@/components/landing/compliance-section'
import { FaqSection } from '@/components/landing/faq-section'
import { FounderNoteSection } from '@/components/landing/founder-note-section'
import { HeroSection } from '@/components/landing/hero-section'
import { ModulesRowsSection } from '@/components/landing/modules-rows-section'
import { OnePriceSection } from '@/components/landing/one-price-section'
import { ReceiptProofSection } from '@/components/landing/receipt-proof-section'
import { PdfPackSection } from '@/components/landing/pdf-pack-section'
import { RecentWorkSection } from '@/components/landing/recent-work-section'
import { StudiosHandSection } from '@/components/landing/studios-hand-section'
import { ThreeQuotesSection } from '@/components/landing/three-quotes-section'
import { AiSection } from '@/components/landing/ai-section'

/**
 * Omnix homepage — long-scroll editorial.
 *
 * Section order per OMNIX-BRIEF.md §6.1.
 * Every section title is evocative (never literally "Features" / "Services").
 * Every section uses the editorial type utilities defined in globals.css.
 *
 *  1. Hero                — headline italic-word emphasis, single CTA, mono caption, PosPreview
 *  2. Founder note        — replaces stats row; signed letter (60ch italic Geist)
 *  3. What we make        — 4 alternating image/text rows, honest placeholders
 *  4. The receipt is the proof — eTIMS receipt + KRA filing side-by-side, hung quote
 *  5. The studio's hand   — 3 numbered steps in Fraunces 96px accent
 *  6. Recent work         — 1-2-1 layout of customer placeholders
 *  7. Compliance          — quiet 4-col grid, no icons
 *  8. Three quotes        — pull quotes hung off-grid, no avatars
 *  9. One price           — single huge KES 30,000, three text-link entry points
 * 10. FAQ                 — accordion, plus glyph rotates to ×
 * 11. Closing CTA         — full-bleed dark band, italic 64px, one CTA + WhatsApp
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
  const heroContent: Parameters<typeof HeroSection>[0]['content'] = undefined
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

  return (
    <>
      <HeroSection
        content={heroContent}
        latestRelease={latestRelease}
        locale={locale}
        priceCaption={`${formatPrice(onePriceAmount, currency)} once`}
      />
      <FounderNoteSection />
      <AiSection />
      <ModulesRowsSection />
      <ReceiptProofSection />
      <PdfPackSection />
      <StudiosHandSection />
      <RecentWorkSection />
      <ComplianceSection />
      <ThreeQuotesSection />
      <OnePriceSection price={onePrice} currency={oneCurrency} />
      <FaqSection />
      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
