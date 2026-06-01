'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { PosPreview } from './pos-preview'

/**
 * Editorial hero — Linear/Cereal composition.
 *
 * Composition:
 *   eyebrow pill (changelog link)
 *   headline · 2 lines · italic word emphasis on line 2
 *   lede · 1 paragraph · max-w 620px
 *   ONE primary CTA · "Start free trial"
 *   mono caption · system req + price hint
 *   PosPreview window · max-w 1080
 *
 * No 3-card pricing strip above the fold (moved to its own section later).
 * No secondary CTA, no logo cloud, no "Trusted by" — confidence shows through restraint.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 lg:pt-44 lg:pb-28">
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
            href="/changelog#v0.2.0"
            className="group inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/70 py-1.5 pr-4 pl-1.5 backdrop-blur-md transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-foreground)]">
              v0.2.0
            </span>
            <span className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-fg)]">
              Banking & Recurring Invoices shipped
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
          Run your duka.
          <br />
          <em>Pay yourself.</em>
        </motion.h1>

        {/* Lede — single paragraph, no proof bullets */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="lede mx-auto mt-9 text-center text-balance"
          style={{ maxWidth: '620px' }}
        >
          Omnix is the desktop ERP built for Kenyan owner-operators. POS, inventory, banking,
          payroll, KRA receipts — one Windows app you download, run offline, and own. One
          payment, no subscription.
        </motion.p>

        {/* Primary CTA — single, centred. No competing secondary. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-11 flex justify-center"
        >
          <Button asChild size="xl" className="ring-inset-soft">
            <Link href="/signup" className="gap-2">
              Start free trial
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
          <span className="text-[var(--color-fg-muted)]">KES 100,000 once</span>
        </motion.p>

        {/* Product preview — hand-built window, max-w 1080 */}
        <div className="mx-auto mt-24 max-w-[1080px]">
          <PosPreview />
        </div>
      </div>
    </section>
  )
}
