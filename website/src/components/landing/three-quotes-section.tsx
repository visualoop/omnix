'use client'

import { motion } from 'framer-motion'

/**
 * "Three quotes" — three Fraunces italic 32px pull quotes hung off-grid.
 *
 * Per OMNIX-BRIEF §6.1 ⑨ — replaces the marquee testimonial pattern.
 *
 * Why this composition:
 *   - No avatars (avatars are the "Trusted by" cliché)
 *   - No 4.9★ ratings (a star rating from anonymous customers reads as fake)
 *   - Just the words, hung off-grid with thin accent rules above each
 *
 * Layout: three rows, each quote occupies left 8 cols, attribution right 4 cols.
 * On every other row the layout swaps for editorial rhythm.
 */

interface Quote {
  text: string
  name: string
  role: string
  meta: string
}

const QUOTES: Quote[] = [
  {
    text:
      'Before Omnix, my pharmacist filed receipts at midnight. We installed it on a Wednesday. By Friday she went home at six.',
    name: 'Naliaka Wamalwa',
    role: 'Owner, Mama Brenda Pharmacy',
    meta: 'Kasarani · since Mar 2025',
  },
  {
    text:
      'I have used Sage. I have used Quickbooks. The first thing I noticed about Omnix is that it actually works when the line drops. The till never blinks.',
    name: 'Peter Mwangi',
    role: 'Founder, Sokoni Stores',
    meta: 'Westlands · since Nov 2024',
  },
  {
    text:
      'Paid 30,000 once, kept what I built. The next year I added a second branch. Same licence. The number on the wall stayed the same.',
    name: 'Esther Achieng',
    role: 'Director, Eldoret Farmers Mart',
    meta: 'Eldoret · since Jan 2025',
  },
]

export function ThreeQuotesSection() {
  return (
    <section className="section">
      <div className="container-wide">
        <div className="mb-16 max-w-[36rem]">
          <span className="eyebrow">In their words</span>
        </div>

        <ol className="space-y-20 lg:space-y-28">
          {QUOTES.map((q, i) => (
            <Row key={q.name} quote={q} reversed={i % 2 === 1} index={i} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function Row({
  quote,
  reversed,
  index,
}: {
  quote: Quote
  reversed: boolean
  index: number
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.6, delay: index * 0.05 }}
      className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12"
    >
      {/* Quote — 7 cols */}
      <div
        className={
          reversed
            ? 'lg:order-2 lg:col-span-7 lg:col-start-6'
            : 'lg:order-1 lg:col-span-7 lg:col-start-1'
        }
      >
        <span aria-hidden className="hairline-accent mb-7 block" />
        <blockquote
          className="font-[family-name:var(--font-display)] text-balance text-[clamp(26px,2.6vw,40px)] italic font-light leading-[1.25] tracking-[-0.014em] text-[var(--color-fg)]"
          style={{ textIndent: '-0.5em', paddingLeft: '0.5em' }}
        >
          &ldquo;{quote.text}&rdquo;
        </blockquote>
      </div>

      {/* Attribution — 4 cols, opposite side, vertical alignment to bottom */}
      <div
        className={
          reversed
            ? 'lg:order-1 lg:col-span-4 lg:col-start-1 lg:flex lg:items-end'
            : 'lg:order-2 lg:col-span-4 lg:col-start-9 lg:flex lg:items-end'
        }
      >
        <div>
          <div className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--color-fg)]">
            {quote.name}
          </div>
          <div className="font-[family-name:var(--font-ui)] mt-1 text-[13px] text-[var(--color-fg-muted)]">
            {quote.role}
          </div>
          <div className="caption-mono mt-3">{quote.meta}</div>
        </div>
      </div>
    </motion.li>
  )
}
