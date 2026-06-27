'use client'

import { motion } from 'motion/react'

/**
 * "Why businesses switch" — overcomes status-quo bias.
 *
 * Buyer question: "Why change from what I already use?" Owners evaluating
 * 5–10-year software need a reason to leave the familiar (a subscription POS,
 * spreadsheets, or paper). We contrast the everyday pain against the Omnix
 * outcome — concrete, not slogans. No table chrome; an editorial two-column
 * "before / after" that reads like a quiet argument.
 */
const SWITCHES = [
  {
    from: 'A POS subscription that bills every month, forever — and locks your data in if you stop paying.',
    to: 'Pay once. Own it. Your data lives on your machine and stays yours whether you renew support or not.',
  },
  {
    from: 'The internet drops and the till freezes mid-queue.',
    to: 'Omnix runs fully offline. Sales, receipts, and stock keep working; M-Pesa and KRA sync when the line returns.',
  },
  {
    from: 'Stock in one spreadsheet, sales in another, suppliers in a book, and the real picture only at month-end.',
    to: 'One system holds it all in real time — and the AI can tell you what it means today, not in four weeks.',
  },
  {
    from: 'Manual KRA filing and a month-end scramble to reconcile M-Pesa.',
    to: 'Every sale is eTIMS-signed as it happens and every M-Pesa payment reconciles itself.',
  },
]

export function WhySwitchSection() {
  return (
    <section className="section border-t border-[var(--color-border)]">
      <div className="container-wide">
        <div className="max-w-[680px]">
          <span className="eyebrow">Why owners move</span>
          <h2 className="headline-section mt-5 text-balance">
            Built for how a business <em>actually runs.</em>
          </h2>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)]">
          {SWITCHES.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.45 }}
              className="grid grid-cols-1 gap-6 bg-[var(--color-bg)] p-8 md:grid-cols-2 md:gap-12 lg:p-10"
            >
              <div className="flex items-start gap-4">
                <span className="caption-mono mt-1 shrink-0 text-[var(--color-fg-subtle)]">Before</span>
                <p className="text-[15px] leading-[1.6] text-[var(--color-fg-muted)]">{s.from}</p>
              </div>
              <div className="flex items-start gap-4 md:border-l md:border-[var(--color-border)] md:pl-12">
                <span className="caption-mono mt-1 shrink-0 text-[var(--color-accent)]">Omnix</span>
                <p className="text-[15px] leading-[1.6] text-[var(--color-fg)]">{s.to}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
