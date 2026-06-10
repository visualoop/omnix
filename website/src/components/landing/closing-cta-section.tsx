'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'

/**
 * Closing CTA — full-bleed dark band.
 *
 * Per OMNIX-BRIEF §6.1 ⑫:
 *   - Single line in Fraunces italic 64px (clamp 40-72px)
 *   - One filled accent CTA underneath
 *   - Small WhatsApp text link as the only secondary
 *   - Full-bleed warm-near-black background, no card
 *
 * Composition rule: this is the LAST thing the visitor reads. Strip everything
 * else. One sentence, one button, one link. No "Get in touch / Learn more / Book a demo" trio.
 */
export function ClosingCtaSection({ whatsappUrl, prompt }: { whatsappUrl: string | null; prompt?: string }) {
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-border)] py-32 sm:py-44">
      {/* Background atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 50%, var(--color-accent-soft), transparent 70%), var(--color-bg)',
        }}
      />
      {/* Subtle horizon rule centred */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[1px] w-[60%] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_right,transparent,var(--color-accent-line),transparent)] blur-[1px]"
      />

      <div className="container-wide relative">
        <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="font-[family-name:var(--font-display)] text-balance text-[clamp(40px,5.5vw,76px)] italic font-light leading-[1.05] tracking-[-0.025em] text-[var(--color-fg)]"
          >
            Run your duka <em className="not-italic text-[var(--color-accent)]">properly.</em>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-12 flex flex-col items-center gap-7"
          >
            <Button asChild size="xl" className="ring-inset-soft">
              <Link href="/signup" className="gap-2">
                Start free trial
                <Icon.ArrowRight className="size-4" weight="bold" />
              </Link>
            </Button>

            {whatsappUrl ? (
              <Link
                href={`${whatsappUrl}?text=Hi%20Omnix%2C%20I%27d%20like%20to%20talk%20to%20someone%20before%20I%20install.`}
                target="_blank"
                rel="noopener"
                className="caption-mono inline-flex items-center gap-2 transition-colors hover:text-[var(--color-fg)]"
              >
                {prompt ?? "or talk to us on WhatsApp"}
              <Icon.ArrowRight className="size-3" weight="bold" />
            </Link>) : null}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
