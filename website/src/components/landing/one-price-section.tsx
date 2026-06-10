'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@/components/icons'

/**
 * "One price" — replaces the 3-card pricing strip.
 *
 * Per OMNIX-BRIEF §6.1 ⑩:
 *   - eyebrow "Pricing"
 *   - single huge KES 50,000 in Fraunces 144px (number-display utility)
 *   - italic line "Once. For the whole product."
 *   - three quiet text-link entry points separated by mid-dot
 *     (NOT three competing cards — editorial, not competitive)
 *
 * Composition rule: the eye lands on the number first, then the italic
 * commitment line, then the three entry points. Three primary CTAs
 * compete; three text links of equal weight read as a directory.
 */
export function OnePriceSection({
  price = '50,000',
  currency = 'KES',
}: {
  price?: string
  currency?: string
}) {
  return (
    <section className="section relative overflow-hidden">
      {/* Subtle accent pool centred behind the number */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_72%)] blur-3xl"
      />

      <div className="container-wide relative">
        <div className="mx-auto max-w-[920px] text-center">
          <span className="eyebrow mx-auto w-fit">Pricing</span>

          {/* The number */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="mt-10"
          >
            <div className="number-display text-balance">
              <span className="currency">{currency}</span>{price}
            </div>
          </motion.div>

          {/* Italic commitment */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="font-[family-name:var(--font-display)] mt-8 text-[clamp(22px,2.2vw,30px)] italic font-light leading-snug tracking-[-0.018em] text-[var(--color-fg-muted)]"
          >
            Once. <span className="text-[var(--color-fg)]">For the whole product.</span>
          </motion.p>

          {/* Three quiet text-link entry points, separated by mid-dot */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 font-[family-name:var(--font-ui)] text-[14px]"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 border-b border-[var(--color-accent)] pb-1 font-medium text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
            >
              Start free trial
              <Icon.ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>

            <span aria-hidden className="text-[var(--color-fg-subtle)]">·</span>

            <Link
              href="/signup?intent=buy"
              className="group inline-flex items-center gap-2 border-b border-transparent pb-1 font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              Buy a licence
              <Icon.ArrowRight
                className="size-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                weight="bold"
              />
            </Link>

            <span aria-hidden className="text-[var(--color-fg-subtle)]">·</span>

            <Link
              href="/contact?type=enterprise"
              className="group inline-flex items-center gap-2 border-b border-transparent pb-1 font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              Talk to us about Custom
              <Icon.ArrowRight
                className="size-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                weight="bold"
              />
            </Link>
          </motion.div>

          {/* Caveat row — mono 11px, muted */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            <span className="caption-mono">
              Perpetual licence
            </span>
            <span aria-hidden className="caption-mono text-[var(--color-fg-subtle)]">·</span>
            <span className="caption-mono">1 year free maintenance</span>
            <span aria-hidden className="caption-mono text-[var(--color-fg-subtle)]">·</span>
            <span className="caption-mono">Major upgrades 50% off list</span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
