'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * "Customers running Omnix today" — 1-2-1 editorial layout.
 *
 * Per OMNIX-BRIEF §6.1 ⑦ — replaces a generic logo wall.
 *
 * Layout pattern (1-2-1):
 *   row 1 — full-width tile
 *   row 2 — two side-by-side tiles
 *   row 3 — full-width tile
 *
 * Imagery rule: until owner uploads real shop photographs to /admin → CMS,
 * each tile renders an honest placeholder per ai-slop-check skill — striped
 * warm-grey panel with mono caption stating the business + town + module.
 */

interface Customer {
  business: string
  town: string
  module: string
  size: '1600×900' | '1280×800' | '1280×720'
  size_class:
    | 'aspect-[16/9]'
    | 'aspect-[16/10]'
}

const TILES: Customer[] = [
  {
    business: 'Mama Brenda Pharmacy',
    town: 'Kasarani · Nairobi',
    module: 'Dawa · running v0.2.0',
    size: '1600×900',
    size_class: 'aspect-[16/9]',
  },
  {
    business: 'Sokoni Stores',
    town: 'Westlands · Nairobi',
    module: 'Soko Retail · running v0.2.0',
    size: '1280×800',
    size_class: 'aspect-[16/10]',
  },
  {
    business: 'Eldoret Farmers Mart',
    town: 'Eldoret CBD',
    module: 'Soko Retail + Core · v0.2.0',
    size: '1280×800',
    size_class: 'aspect-[16/10]',
  },
  {
    business: 'Penda Cosmetics',
    town: 'Kisumu · Mega City',
    module: 'Soko Retail · v0.2.0',
    size: '1600×900',
    size_class: 'aspect-[16/9]',
  },
]

export function RecentWorkSection() {
  return (
    <section className="section">
      <div className="container-wide">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[36rem]">
            <span className="eyebrow">Customers running Omnix today</span>
            <h2 className="headline-section mt-5 text-balance">
              Real shops. <em>Real receipts.</em>
            </h2>
          </div>
          <p className="lede max-w-[28rem]">
            Four of the businesses live on Omnix right now. Photographs replace these panels
            once the owner uploads them.
          </p>
        </div>

        {/* 1-2-1 grid */}
        <div className="space-y-6 lg:space-y-8">
          {/* Row 1 — full-width */}
          <CustomerTile customer={TILES[0]} variant="hero" />

          {/* Row 2 — two-up */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <CustomerTile customer={TILES[1]} variant="half" />
            <CustomerTile customer={TILES[2]} variant="half" />
          </div>

          {/* Row 3 — full-width */}
          <CustomerTile customer={TILES[3]} variant="hero" />
        </div>
      </div>
    </section>
  )
}

function CustomerTile({
  customer,
  variant,
}: {
  customer: Customer
  variant: 'hero' | 'half'
}) {
  const aspectClass = variant === 'hero' ? 'aspect-[21/9]' : customer.size_class

  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.6 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)]',
        aspectClass,
      )}
    >
      {/* Diagonal warm stripes */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] transition-opacity group-hover:opacity-[0.55]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, transparent 0px, transparent 22px, rgba(199, 123, 63, 0.06) 22px, rgba(199, 123, 63, 0.06) 23px)',
        }}
      />

      {/* Soft accent pool */}
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_70%)] blur-3xl"
      />

      {/* Hairline frame inset */}
      <div aria-hidden className="absolute inset-5 rounded-md border border-[var(--color-border)]" />

      {/* Caption block */}
      <figcaption className="absolute bottom-7 left-7 right-7 flex items-end justify-between gap-6">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-[clamp(24px,2.4vw,36px)] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--color-fg)]">
            {customer.business}
          </h3>
          <div className="caption-mono mt-3">
            {customer.town}
            <span aria-hidden className="mx-2">
              ·
            </span>
            {customer.module}
          </div>
        </div>
        <div className="caption-mono whitespace-nowrap text-end text-[var(--color-fg-subtle)] hidden sm:block">
          shop photo
          <br />
          {customer.size}
        </div>
      </figcaption>
    </motion.figure>
  )
}
