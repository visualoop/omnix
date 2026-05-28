'use client'

import { motion } from 'framer-motion'

/**
 * "The studio's hand" — 3 numbered steps in Fraunces 96px accent numerals.
 *
 * Composition (per DUKA-BRIEF §6.1 ⑥):
 *   eyebrow "How we work"
 *   3 numbered rows (01 / 02 / 03)
 *   each row: huge serif numeral on the left, one-sentence statement on the right
 *
 * Typography hierarchy: numerals are the loudest, statement is mid, no body copy
 * (resists the urge to over-explain — three short statements should land).
 */

const STEPS: { n: string; statement: string; meta: string }[] = [
  {
    n: '01',
    statement: 'Download the installer.',
    meta: 'Windows 64-bit · 18 MB · ~30s on most lines',
  },
  {
    n: '02',
    statement: 'Run your duka for thirty days.',
    meta: 'Every module unlocked · no card · no nag screens',
  },
  {
    n: '03',
    statement: 'Pay once. Keep working.',
    meta: 'KES 100,000 by M-Pesa or card · perpetual licence',
  },
]

export function StudiosHandSection() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="mb-20 max-w-[44rem]">
          <span className="eyebrow">How we work</span>
          <h2 className="headline-section mt-5 text-balance">
            Three steps. <em>No subscription.</em>
          </h2>
        </div>

        <ol className="space-y-2 lg:space-y-0">
          {STEPS.map((step, i) => (
            <Step key={step.n} step={step} index={i} last={i === STEPS.length - 1} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function Step({
  step,
  index,
  last,
}: {
  step: { n: string; statement: string; meta: string }
  index: number
  last: boolean
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15%' }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      className={
        last
          ? 'grid grid-cols-[auto_1fr] items-baseline gap-8 py-12 lg:gap-16 lg:py-16'
          : 'grid grid-cols-[auto_1fr] items-baseline gap-8 border-b border-[var(--color-border)] py-12 lg:gap-16 lg:py-16'
      }
    >
      {/* Numeral — Fraunces 300, accent colour, 96px+ */}
      <span
        className="font-[family-name:var(--font-display)] text-[clamp(72px,9vw,128px)] font-light leading-none tracking-[-0.04em] text-[var(--color-accent)]"
        style={{ fontVariantNumeric: 'lining-nums' }}
      >
        {step.n}
      </span>

      {/* Statement + meta line */}
      <div>
        <p className="font-[family-name:var(--font-display)] text-[clamp(28px,3.4vw,48px)] font-light leading-[1.05] tracking-[-0.02em] text-[var(--color-fg)] text-balance">
          {step.statement}
        </p>
        <div className="caption-mono mt-5">{step.meta}</div>
      </div>
    </motion.li>
  )
}
