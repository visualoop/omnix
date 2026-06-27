'use client'

import { motion } from 'motion/react'
import {
  RetailIllo, InventoryIllo, AccountingIllo, PurchasingIllo,
  AnalyticsIllo, MpesaIllo, EtimsIllo, AiIllo,
} from '@/components/marketing/illustrations'

/**
 * Unified-platform comprehension section.
 *
 * Buyer question: "What does Omnix actually replace?" The single most
 * important reframing on the page — moves perception from "a POS" to "the one
 * system the whole business runs on." We name the eight things owners usually
 * stitch together from separate tools/spreadsheets/books, and show them as one
 * surface. This is the elevate move: ERP + POS + AI, not a till.
 */
const CAPABILITIES = [
  { Illo: RetailIllo, name: 'Point of sale', note: 'Fast checkout, every payment type' },
  { Illo: InventoryIllo, name: 'Inventory', note: 'Stock, batches, expiry, reorder' },
  { Illo: PurchasingIllo, name: 'Purchasing', note: 'Suppliers, orders, goods received' },
  { Illo: AccountingIllo, name: 'Accounting', note: 'Banking, expenses, P&L' },
  { Illo: AnalyticsIllo, name: 'Reports', note: 'Daily Z-report to full analytics' },
  { Illo: MpesaIllo, name: 'Payments', note: 'M-Pesa, cards, cash, credit' },
  { Illo: EtimsIllo, name: 'Tax & compliance', note: 'KRA eTIMS, VAT, SHA claims' },
  { Illo: AiIllo, name: 'AI assistant', note: 'Ask your data, act on it' },
]

export function UnifiedPlatformSection() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="mx-auto max-w-[760px] text-center">
          <span className="eyebrow justify-center">One system</span>
          <h2 className="headline-section mt-5 text-balance">
            Everything the business runs on, <em>in one place.</em>
          </h2>
          <p className="lede mx-auto mt-7 text-balance">
            Most shops run on a till, a stock spreadsheet, a separate book for
            suppliers, a phone for M-Pesa, and an accountant who sees it all a
            month late. Omnix is the one app that does the lot — so nothing falls
            through the gaps between them.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3 lg:grid-cols-4">
          {CAPABILITIES.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
              className="group flex flex-col gap-3 bg-[var(--color-bg)] p-7 transition-colors hover:bg-[var(--color-surface)]"
            >
              <span className="text-[var(--color-accent)]">
                <c.Illo size={32} />
              </span>
              <div>
                <h3 className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--color-fg)]">
                  {c.name}
                </h3>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--color-fg-muted)]">
                  {c.note}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="caption-mono mt-8 text-center">
          One licence · one install · no modules to buy piecemeal
        </p>
      </div>
    </section>
  )
}
