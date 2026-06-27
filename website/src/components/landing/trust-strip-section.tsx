'use client'

import { motion } from 'motion/react'
import {
  OfflineIllo, MpesaIllo, EtimsIllo, SecurityIllo, UpdatesIllo,
} from '@/components/marketing/illustrations'

/**
 * Trust strip — sits directly under the hero.
 *
 * Buyer question: "Is this credible, and is it built for how I actually
 * operate?" Five proof points that a Kenyan owner evaluating 5–10-year
 * software needs to see immediately — offline, M-Pesa, KRA, data safety,
 * updates. Rendered as branded line-art with a one-line outcome each, NOT a
 * logo wall or a ticked checklist (banned pattern). Quiet, hairline-framed.
 */
const PROOFS = [
  { Illo: OfflineIllo, label: 'Works offline', sub: 'The till never stops when the line drops.' },
  { Illo: MpesaIllo, label: 'M-Pesa built in', sub: 'STK push, Paybill & Till — reconciled automatically.' },
  { Illo: EtimsIllo, label: 'KRA eTIMS ready', sub: 'Every sale signed and filed, no month-end scramble.' },
  { Illo: SecurityIllo, label: 'Your data, your machine', sub: 'Encrypted on your device. Backed up automatically.' },
  { Illo: UpdatesIllo, label: 'Updates itself', sub: 'New features arrive quietly, like they should.' },
]

export function TrustStripSection() {
  return (
    <section className="section-tight border-y border-[var(--color-border)] bg-[var(--color-surface)]/40">
      <div className="container-wide">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-5">
          {PROOFS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="flex flex-col items-start"
            >
              <span className="text-[var(--color-accent)]">
                <p.Illo size={36} />
              </span>
              <h3 className="font-[family-name:var(--font-ui)] mt-4 text-[14px] font-semibold text-[var(--color-fg)]">
                {p.label}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--color-fg-muted)]">
                {p.sub}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
