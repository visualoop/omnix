'use client'

import { motion } from 'motion/react'

/**
 * Founder note — replaces the conventional "4 hard stats" strip.
 *
 * Why: a 4-stats row ("30 days · KES 30,000 · <300ms · Offline-ready") signals
 * Bootstrap template even when the values are real. A short signed letter signals
 * a person built the product. Per ai-slop-check: subtly toned background,
 * 1px hairline above and below, no card, no icons, no border-left rule.
 *
 * Composition:
 *   ─── hairline-accent ───
 *   eyebrow-plain · "A note from the studio"
 *   3 short paragraphs · Geist 19px italic · max 60ch · centred
 *   signature · Plus Jakarta tracked · "— Justin · founder · Nairobi"
 *   ─── hairline ───
 */
export interface FounderNoteContent {
  eyebrow?: string | null
  /** Multiple paragraphs, one per blank-line-separated block. */
  body?: string | null
  signature?: string | null
  tagline?: string | null
}

export function FounderNoteSection({ content }: { content?: FounderNoteContent } = {}) {
  const eyebrow = content?.eyebrow?.trim() || 'A note from the studio'
  const signature = content?.signature?.trim() || '— Justin'
  const tagline = content?.tagline?.trim() || 'Founder · Nairobi'
  const bodyRaw = content?.body?.trim()
  const paragraphs = bodyRaw
    ? bodyRaw
        .split(/\n\s*\n+/) // blank-line-separated
        .map((p) => p.trim())
        .filter(Boolean)
    : null
  return (
    <section className="relative section-tight">
      <div className="container-text">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          {/* Top accent rule — single short line, centred */}
          <span aria-hidden className="hairline-accent mb-10" />

          <span className="eyebrow-plain">{eyebrow}</span>

          <div className="mt-8 space-y-6 text-balance lede-italic">
            {paragraphs ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <>
                <p>
                  We built Omnix after watching shop owners we know — pharmacies in Westlands,
                  mini-marts in Kisumu, hardware shops in Eldoret — fight the same software all day and
                  still close the till at midnight not knowing what they made.
                </p>
                <p>
                  The brief was simple. One Windows app you download once. Runs offline. Files
                  KRA receipts when the line comes back. Owns its own data on its own machine.
                  Costs less than two months of any subscription.
                </p>
                <p>
                  We&rsquo;re a small team in Nairobi. Every line of code is ours. If something
                  breaks, you can write to me.
                </p>
              </>
            )}
          </div>

          {/* Signature */}
          <div className="mt-10 flex flex-col items-center">
            <span className="font-[family-name:var(--font-display)] text-[20px] italic font-normal text-[var(--color-fg)]">
              {signature}
            </span>
            <span className="caption-mono mt-2">{tagline}</span>
          </div>

          <span aria-hidden className="hairline mt-16 max-w-[280px]" />
        </motion.div>
      </div>
    </section>
  )
}
