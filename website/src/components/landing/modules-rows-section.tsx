'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'

/**
 * "What we make" — four full-width alternating image/text rows.
 *
 * Per OMNIX-BRIEF §6.1 ④ — replaces the previous Linear-bento.
 * Each row: 6/12 image, 5/12 text with offset (2 / 5+offset / 5 / 5+offset).
 *
 * Imagery rule (per ai-slop-check skill):
 *   Real screenshot > pro illustration > **honest placeholder**.
 *   Until owner uploads via /admin → Modules.heroImage we render a
 *   striped warm-grey panel with a mono caption — no hand-drawn SVG.
 */

interface ModuleRow {
  slug: string
  name: string
  tagline: string
  body: string
  status: 'live' | 'planned'
  size: '1280×800' | '1440×900'
  for: string
}

const ROWS: ModuleRow[] = [
  {
    slug: 'dawa-pharmacy',
    name: 'Dawa Pharmacy',
    tagline: 'Calm and compliant.',
    body:
      'Prescription dispensing with prescriber + license capture, controlled-drug ledger, expiry alerts, NHIF / SHA + private claims, KRA receipts. Built with PPB rules in the spine.',
    status: 'live',
    size: '1440×900',
    for: 'pharmacies · clinics · dispensaries',
  },
  {
    slug: 'soko-retail',
    name: 'Soko Retail',
    tagline: 'Sell faster. Reorder smarter.',
    body:
      'Brands and variants, multi-UOM, layby, special orders, returns, promotions, loyalty, held sales, stock takes. Z-report at the end of the day. Reorder from low-stock in two clicks.',
    status: 'live',
    size: '1280×800',
    for: 'mini-marts · hardware · electronics · grocery',
  },
  {
    slug: 'hardware',
    name: 'Hardware',
    tagline: 'Heavy stock. Heavier margins.',
    body:
      'Quotations that convert to sales, delivery notes, contractor accounts with credit and aged receivables, tiered pricing, and sales commissions. Built for the counter and the yard.',
    status: 'live',
    size: '1440×900',
    for: 'hardware · timber · building supplies',
  },
  {
    slug: 'hospitality',
    name: 'Hospitality',
    tagline: 'Tables to kitchen. Rooms to folio.',
    body:
      'Table floor plan, kitchen display, service charge and tips, rooms and bookings, folios, and recipe costing with food-cost %. Restaurant and hotel in one module.',
    status: 'live',
    size: '1280×800',
    for: 'restaurants · bars · hotels · lodges',
  },
]

export function ModulesRowsSection() {
  return (
    <section className="section">
      <div className="container-wide">
        {/* Section header — simple eyebrow + headline + lede */}
        <div className="mb-20 max-w-[44rem]">
          <span className="eyebrow">What we make</span>
          <h2 className="headline-section mt-5 text-balance">
            One licence. <em>Four trades.</em>
          </h2>
          <p className="lede mt-6">
            Every Omnix install ships with the same Core. The trade-specific module decides
            what your screens look like the day you open it.
          </p>
        </div>

        {/* Rows */}
        <div className="space-y-32 lg:space-y-44">
          {ROWS.map((row, i) => (
            <Row key={row.slug} row={row} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Row({ row, index }: { row: ModuleRow; index: number }) {
  const reversed = index % 2 === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn(
        'grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16',
      )}
    >
      <div
        className={cn(
          'lg:col-span-7',
          reversed ? 'lg:order-2 lg:col-start-6' : 'lg:order-1 lg:col-start-1',
        )}
      >
        <ModulePlaceholder name={row.name} size={row.size} status={row.status} />
      </div>

      <div
        className={cn(
          'lg:col-span-4',
          reversed ? 'lg:order-1 lg:col-start-1 lg:pr-8' : 'lg:order-2 lg:col-start-9 lg:pl-8',
        )}
      >
        <div className="caption-mono">
          {row.for}
          {row.status === 'planned' ? (
            <>
              <span aria-hidden className="mx-2">·</span>
              <span className="text-[var(--color-accent)]">planned</span>
            </>
          ) : null}
        </div>

        <h3 className="headline-sub mt-4 text-balance">{row.name}</h3>
        <p className="font-[family-name:var(--font-display)] mt-3 text-[24px] italic font-light leading-tight text-[var(--color-fg-muted)]">
          {row.tagline}
        </p>

        <p className="mt-7 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">
          {row.body}
        </p>

        {row.status === 'live' ? (
          <Link
            href={`/${row.slug}`}
            className="font-[family-name:var(--font-ui)] mt-9 inline-flex items-center gap-2 border-b border-[var(--color-border-strong)] pb-1 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Read more
            <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        ) : (
          <span className="caption-mono mt-9 inline-block">
            On the roadmap · Q3 2026
          </span>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Honest placeholder per ai-slop-check skill.
 * Striped warm-grey panel + mono caption stating the asset name + size.
 * No hand-drawn SVG, no fake screenshot.
 */
function ModulePlaceholder({
  name,
  size,
  status,
}: {
  name: string
  size: string
  status: 'live' | 'planned'
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
      {/* Warm diagonal stripes — honest placeholder treatment */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, transparent 0px, transparent 18px, rgba(199, 123, 63, 0.08) 18px, rgba(199, 123, 63, 0.08) 19px)',
        }}
      />

      {/* Subtle accent pool top-right */}
      <div
        aria-hidden
        className="absolute -right-12 -top-16 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_70%)] blur-2xl"
      />

      {/* Hairline frame inset */}
      <div className="absolute inset-4 rounded-md border border-[var(--color-border)]" />

      {/* Mono caption — bottom-left */}
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
        <div className="caption-mono">
          {name.toLowerCase().replace(/[^a-z]+/g, '-')} · screenshot
          <br />
          <span className="text-[var(--color-fg-subtle)]">{size}</span>
        </div>

        {status === 'live' ? (
          <span className="rounded-full border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-positive)]">
            Shipping
          </span>
        ) : null}
      </div>
    </div>
  )
}
