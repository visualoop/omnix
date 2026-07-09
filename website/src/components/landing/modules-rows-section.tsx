'use client'

import { motion } from 'motion/react'
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
  pageHref: string
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
    pageHref: '/dawa',
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
    pageHref: '/retail',
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
    pageHref: '/hardware',
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
    pageHref: '/hospitality',
    name: 'Hospitality',
    tagline: 'Tables to kitchen. Rooms to folio.',
    body:
      'Table floor plan, kitchen display, service charge and tips, rooms and bookings, folios, and recipe costing with food-cost %. Restaurant and hotel in one module.',
    status: 'live',
    size: '1280×800',
    for: 'restaurants · bars · hotels · lodges',
  },
  {
    slug: 'salon',
    pageHref: '/salon',
    name: 'Salon & Spa',
    tagline: 'Appointments to commissions.',
    body:
      'An appointment diary that never double-books, staff skills and commissions, prepaid packages and memberships, back-bar stock, and full client history with formulas. Book, serve, checkout — one calm flow.',
    status: 'live',
    size: '1440×900',
    for: 'salons · barbershops · nail bars · spas',
  },
]

export function ModulesRowsSection({ images = {} }: { images?: Record<string, string> }) {
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
            <Row key={row.slug} row={row} index={i} imageUrl={images[row.slug]} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Row({ row, index, imageUrl }: { row: ModuleRow; index: number; imageUrl?: string }) {
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
        <ModulePlaceholder name={row.name} slug={row.slug} size={row.size} status={row.status} imageUrl={imageUrl} />
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
            href={row.pageHref}
            aria-label={`Read more about ${row.name}`}
            className="font-[family-name:var(--font-ui)] mt-9 inline-flex items-center gap-2 border-b border-[var(--color-border-strong)] pb-1 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Read more about {row.name}
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
  slug,
  size,
  status,
  imageUrl,
}: {
  name: string
  slug: string
  size: string
  status: 'live' | 'planned'
  imageUrl?: string
}) {
  // Admin-managed slot image (from /admin/media) wins; fall back to the
  // seeded R2 default so it's never blank. Nothing here is hardcoded —
  // every slug maps to an editable media slot (module-row.<slug>).
  const src = imageUrl || `https://media.omnix.co.ke/marketing/module-row-${slug}.jpg`
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
      {/* Warm diagonal stripes — fallback treatment behind the image */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, transparent 0px, transparent 18px, rgba(199, 123, 63, 0.08) 18px, rgba(199, 123, 63, 0.08) 19px)',
        }}
      />

      {/* Real trade photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} — Omnix`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Subtle bottom gradient so the mono caption stays legible */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

      {/* Subtle accent pool top-right */}
      <div
        aria-hidden
        className="absolute -right-12 -top-16 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_70%)] blur-2xl"
      />

      {/* Hairline frame inset */}
      {/* Shipping badge — top-right over the photo */}
      {status === 'live' ? (
        <div className="absolute right-4 top-4">
          <span className="rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            Shipping
          </span>
        </div>
      ) : (
        <div className="absolute right-4 top-4">
          <span className="rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            Planned
          </span>
        </div>
      )}
    </div>
  )
}
