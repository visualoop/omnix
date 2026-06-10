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
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export default async function HomePage() {
  const settings = await getSiteSettings()
  let heroContent: Parameters<typeof HeroSection>[0]["content"] = undefined
  let latestRelease: Parameters<typeof HeroSection>[0]["latestRelease"] = undefined
  try {
    const payload = await getPayload({ config: await config })
    const lp = (await payload.findGlobal({ slug: 'landing-page', depth: 1 })) as unknown as {
      hero?: {
        eyebrow?: string
        headline?: string
        subheadline?: string
        primaryCtaLabel?: string
        primaryCtaHref?: string
        screenshot?: { url?: string; width?: number; height?: number; alt?: string } | null
      }
    }
    heroContent = lp?.hero

    const releasesResult = await payload.find({
      collection: 'releases',
      where: {
        and: [
          { status: { equals: 'published' } },
          { channel: { equals: 'stable' } },
        ],
      },
      sort: '-publishedAt',
      limit: 1,
    })
    const release = releasesResult.docs[0] as unknown as {
      version?: string
      title?: string
      summary?: string
    }
    if (release) {
      latestRelease = {
        version: release.version ?? '',
        title: release.title ?? '',
        summary: release.summary ?? '',
      }
    }
  } catch {
    // Payload unavailable (cold boot / build) — fall back to shipped defaults
    heroContent = undefined
  }

  return (
    <>
      <HeroSection content={heroContent} latestRelease={latestRelease} />
      <FounderNoteSection />
      <AiSection />
      <ModulesRowsSection />
      <ReceiptProofSection />
      <StudiosHandSection />
      <RecentWorkSection />
      <ComplianceSection />
      <ThreeQuotesSection />
      <OnePriceSection />
      <FaqSection />
      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
