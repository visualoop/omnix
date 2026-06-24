'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PayloadImage, type PayloadMedia } from '@/components/marketing/payload-image'

export interface HeroContent {
  eyebrow?: string | null
  headline?: string | null
  subheadline?: string | null
  primaryCtaLabel?: string | null
  primaryCtaHref?: string | null
  screenshot?: PayloadMedia | null
}

export interface LatestRelease {
  version: string
  title?: string
  summary?: string
}

/**
 * Editorial hero. Content is CMS-editable via the `landing-page` global
 * (owner edits headline, lede, CTA + uploads a hero screenshot in /admin).
 * Falls back to the shipped defaults when a field is empty.
 *
 * The uploaded screenshot renders inside BrowserFrame (Windows Chrome chrome);
 * when no screenshot is set we fall back to the hand-built PosPreview.
 */
export function HeroSection({
  content, latestRelease, locale, priceCaption: priceCaptionOverride,
}: {
  content?: HeroContent
  latestRelease?: LatestRelease
  locale?: string
  /** Caption shown under the CTA. e.g. "KES 50,000 once" or "$620 once". */
  priceCaption?: string
}) {
  const isKenya = (locale ?? 'ke').toLowerCase() === 'ke'
  const cmsEyebrow = content?.eyebrow?.trim() || (isKenya ? 'Banking & Recurring Invoices shipped' : 'Built offline-first. Pay once. Own forever.')
  const releaseEyebrow = latestRelease
    ? `NEW · v${latestRelease.version} — ${latestRelease.title || latestRelease.summary || 'Latest release'}`
    : null
  const eyebrow = releaseEyebrow || cmsEyebrow
  const headline = content?.headline?.trim()
  // Subheadline — Kenya-pinned for /ke, globally framed for everyone else.
  const defaultSubKenya = 'Omnix is the desktop ERP built for Kenyan owner-operators. POS, inventory, banking, payroll, KRA receipts — one Windows app you download, run offline, and own. One payment, no subscription.'
  const defaultSubGlobal = 'Omnix is the offline-first desktop ERP for owner-operators. POS, inventory, banking, payroll, compliance — one Windows app you download, run offline, and own. One payment, no subscription, no per-user fees.'
  const subheadline = content?.subheadline?.trim() || (isKenya ? defaultSubKenya : defaultSubGlobal)
  const ctaLabel = content?.primaryCtaLabel?.trim() || 'Start free trial'
  const ctaHref = content?.primaryCtaHref?.trim() || '/signup'
  const screenshot = content?.screenshot ?? null

  // Caption price — show local currency reference. Falls back to a per-
  // locale generic if no explicit caption was passed.
  const priceCaption = priceCaptionOverride ?? (isKenya ? 'KES 50,000 once' : '$620 once')

  return (
    <section className="relative overflow-hidden pt-20 pb-16 sm:pt-24 lg:pt-28 lg:pb-20">
      {/* Atmosphere — soft warm pool of accent behind the headline */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_30%,var(--color-bg)_88%)]" />
      </div>

      <div className="container-wide">
        {/* Eyebrow — pill linking to latest changelog */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 flex justify-center"
        >
          <Link
            href="/changelog"
            className="group inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/70 py-1.5 pr-4 pl-1.5 backdrop-blur-md transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-foreground)]">
              New
            </span>
            <span className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-fg)]">
              {eyebrow}
            </span>
            <Icon.ArrowRight
              className="size-3 text-[var(--color-fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-fg)]"
              weight="bold"
            />
          </Link>
        </motion.div>

        {/* Headline — Fraunces 300, italic word on line 2 */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="headline-hero mx-auto max-w-[14ch] text-balance text-center"
        >
          {headline ? (
            headline
          ) : isKenya ? (
            <>
              Run your duka.
              <br />
              <em>Pay yourself.</em>
            </>
          ) : (
            <>
              Run your business.
              <br />
              <em>Own the software.</em>
            </>
          )}
        </motion.h1>

        {/* Lede — single paragraph, no proof bullets */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="lede mx-auto mt-9 text-center text-balance"
          style={{ maxWidth: '620px' }}
        >
          {subheadline}
        </motion.p>

        {/* Primary CTA — single, centred. No competing secondary. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-11 flex justify-center"
        >
          <Button asChild size="xl" className="ring-inset-soft">
            <Link href={ctaHref} className="gap-2">
              {ctaLabel}
              <Icon.ArrowRight className="size-4" weight="bold" />
            </Link>
          </Button>
        </motion.div>

        {/* Tech caption — mono 11px tracked uppercase. Only price reference above the fold. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.42 }}
          className="caption-mono mt-6 text-center"
        >
          <span>Windows 10 / 11 · 64-bit · 4 GB RAM</span>
          <span aria-hidden className="mx-2 text-[var(--color-fg-subtle)]">
            ·
          </span>
          <span className="text-[var(--color-fg-muted)]">{priceCaption}</span>
        </motion.p>

        {/* Product preview — only renders when a screenshot is uploaded in
            /admin → Landing Page → Hero → Screenshot. Until then the section
            stays empty so we don't ship a fake mock that misrepresents the app. */}
        {screenshot?.url && (
          <div className="mx-auto mt-24 max-w-[1080px]">
            <PayloadImage media={screenshot} url="omnix.co.ke/dashboard" />
          </div>
        )}
      </div>
    </section>
  )
}
