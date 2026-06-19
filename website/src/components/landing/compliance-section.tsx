'use client'

import { motion } from 'motion/react'

/**
 * "Built into the systems that run Kenya" — quiet integration grid.
 *
 * Per OMNIX-BRIEF §6.1 ⑧:
 *   - 4-col on desktop, 2-col on tablet, 1-col on mobile
 *   - NO icons (icons turn this into a "Trusted by 50+" trope)
 *   - Single rule between rows, no border between columns
 *   - Each cell: name + 3-word description in mono
 *
 * Hierarchy: name in Fraunces 22px, description in JetBrains Mono 11px tracked.
 * That two-line cadence reads as a directory, not a logo wall.
 */

interface Integration {
  name: string
  what: string
}

const INTEGRATIONS: Integration[] = [
  { name: 'KRA eTIMS',     what: 'Real-time invoice control unit' },
  { name: 'M-Pesa',        what: 'STK push · paybill · till' },
  { name: 'NHIF / SHA',    what: 'Claims · capitation · batches' },
  { name: 'NSSF',          what: 'Monthly P9 batches' },
  { name: 'Paystack',      what: 'Cards · M-Pesa via API' },
  { name: 'PPB',           what: 'Pharmacy & poisons board' },
  { name: 'Equity Bank',   what: 'Statement reconciliation' },
  { name: 'KCB',           what: 'Statement reconciliation' },
  { name: 'Co-operative',  what: 'Statement reconciliation' },
  { name: 'KEBS',          what: 'Standards & marks of quality' },
  { name: 'KEMSA',         what: 'Procurement reference' },
  { name: 'PAYE',          what: 'Tax band batches · P9 · P10' },
]

export function ComplianceSection() {
  return (
    <section className="section-tight">
      <div className="container-wide">
        <div className="mb-16 max-w-[44rem]">
          <span className="eyebrow">Built into the systems that run Kenya</span>
          <h2 className="headline-section mt-5 text-balance">
            Wired in <em>natively.</em>
          </h2>
          <p className="lede mt-6">
            Every integration below is part of the install. No plug-ins, no add-on fees, no
            partner SDKs. Omnix files, settles, and reconciles directly.
          </p>
        </div>

        <motion.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        >
          {INTEGRATIONS.map((item, i) => (
            <Cell key={item.name} item={item} index={i} />
          ))}
        </motion.ul>
      </div>
    </section>
  )
}

function Cell({ item, index }: { item: Integration; index: number }) {
  // Hairline rule between rows on desktop (4 cols → row of 4).
  // Logic: every cell on the bottom edge of its row.
  // Simpler approach: top-border on every cell, hide on the very first row.
  // We use Tailwind's group syntax via row-based classes.
  const row = Math.floor(index / 4)

  return (
    <li
      className={
        row === 0
          ? 'border-b border-[var(--color-border)] py-7 sm:px-2 lg:px-4'
          : 'border-t border-[var(--color-border)] py-7 sm:px-2 lg:px-4'
      }
    >
      <div className="font-[family-name:var(--font-display)] text-[clamp(20px,1.8vw,24px)] font-normal leading-[1.1] tracking-[-0.015em] text-[var(--color-fg)]">
        {item.name}
      </div>
      <div className="caption-mono mt-3">{item.what}</div>
    </li>
  )
}
