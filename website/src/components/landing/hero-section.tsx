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
  /** Direct URL to a short (10-25s) muted loop mp4/webm. Renders in
   *  place of the screenshot when set. */
  videoUrl?: string | null
  /** Still frame shown before the video loads. Also the mobile fallback
   *  when we can't autoplay. */
  videoPoster?: string | null
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
  /** Caption shown under the CTA. e.g. "KES 30,000 once" or "$620 once". */
  priceCaption?: string
}) {
  const isKenya = (locale ?? 'ke').toLowerCase() === 'ke'
  const cmsEyebrow = content?.eyebrow?.trim() || 'One platform · offline-first · pay once, own forever'
  const releaseEyebrow = latestRelease
    ? `NEW · v${latestRelease.version} — ${latestRelease.title || latestRelease.summary || 'Latest release'}`
    : null
  const eyebrow = releaseEyebrow || cmsEyebrow
  const headline = content?.headline?.trim()
  // Subheadline — outcome-led. Names what the business actually does (sell,
  // stock, bank, pay staff, file tax, ask its data) rather than listing specs.
  // The differentiators (offline, M-Pesa, own-it) are implied through outcomes,
  // not enumerated like a checklist.
  const defaultSubKenya = 'Sell, manage stock, bank the takings, pay staff, file KRA receipts, and ask your own data what to do next — from one Windows app that runs offline, takes M-Pesa, and is yours to keep. No monthly fees. No lock-in.'
  const defaultSubGlobal = 'Sell, manage stock, bank the takings, pay staff, handle tax, and ask your own data what to do next — from one desktop app that runs offline and is yours to own. Pay once. No subscription. No lock-in.'
  const subheadline = content?.subheadline?.trim() || (isKenya ? defaultSubKenya : defaultSubGlobal)
  const ctaLabel = content?.primaryCtaLabel?.trim() || 'Start free trial'
  const ctaHref = content?.primaryCtaHref?.trim() || '/signup'
  const screenshot = content?.screenshot ?? null
  const videoUrl = content?.videoUrl?.trim() || null
  const videoPoster = content?.videoPoster?.trim() || null

  // Caption price — show local currency reference. Falls back to a per-
  // locale generic if no explicit caption was passed.
  const priceCaption = priceCaptionOverride ?? (isKenya ? 'KES 30,000 once' : '$620 once')

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
              The platform your
              <br />
              business <em>grows with.</em>
            </>
          ) : (
            <>
              The platform your
              <br />
              business <em>grows with.</em>
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
          className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button asChild size="xl" className="ring-inset-soft">
            <Link href={ctaHref} className="gap-2">
              {ctaLabel}
              <Icon.ArrowRight className="size-4" weight="bold" />
            </Link>
          </Button>
          <Link
            href="#product"
            className="font-[family-name:var(--font-ui)] group inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            See it in action
            <Icon.ArrowDown className="size-3.5 transition-transform group-hover:translate-y-0.5" weight="bold" />
          </Link>
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

        {/* v0.10 sub-rail — anchors the cold visitor on what makes the
            release worth their time. Mono, hairline-thin, sits below the
            price caption so it doesn't compete with the headline. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="caption-mono mt-2 text-center text-[var(--color-fg-muted)]"
        >
          <span>STK Push · Paybill · Till · eTIMS</span>
          <span aria-hidden className="mx-2 text-[var(--color-fg-subtle)]">
            ·
          </span>
          <span>every M-Pesa payment + KRA receipt, built in</span>
        </motion.p>

        {/* Industry pills — direct routes to each trade landing so the
            visitor can self-select into their version of the product in
            one click. Keeps the homepage useful for cold traffic that
            already knows their trade. */}
        <motion.nav
          aria-label="Pick your trade"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.62 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {[
            { href: '/pharmacy', label: 'Pharmacy POS' },
            { href: '/retail', label: 'Retail & duka POS' },
            { href: '/hospitality', label: 'Restaurant & bar POS' },
            { href: '/hardware', label: 'Hardware store POS' },
          ].map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="font-[family-name:var(--font-ui)] inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/60 px-4 py-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
            >
              {p.label}
              <Icon.ArrowRight className="size-3 text-[var(--color-fg-subtle)] transition-colors group-hover:text-[var(--color-accent)]" weight="bold" />
            </Link>
          ))}
        </motion.nav>

        {/* Product preview — video wins over screenshot when both are set.
            Neither → the section stays empty (we don't ship a fake mock).
            Video is muted + loops + autoplays inline; mobile browsers that
            reject autoplay fall back to the poster still. Preload=metadata
            keeps the initial page weight low. */}
        {videoUrl ? (
          <div className="mx-auto mt-24 max-w-[1080px]">
            <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_-24px_rgba(0,0,0,0.35)]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                className="block h-auto w-full"
                src={videoUrl}
                poster={videoPoster ?? undefined}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label="Omnix — a short loop showing the product in action"
              />
            </div>
          </div>
        ) : screenshot?.url ? (
          <div className="mx-auto mt-24 max-w-[1080px]">
            <PayloadImage media={screenshot} url="omnix.co.ke/dashboard" />
          </div>
        ) : null}
      </div>
    </section>
  )
}
