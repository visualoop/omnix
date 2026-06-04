import Link from 'next/link'
import { Icon } from '@/components/icons'
import { BRAND, BRAND_NAME } from '@/lib/brand'
import { BrandLogo } from '@/components/brand-logo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Downloads', href: '/downloads' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Modules', href: '/modules' },
    ],
  },
  {
    title: 'Trade',
    links: [
      { label: 'Pharmacy', href: '/modules/dawa-pharmacy' },
      { label: 'Retail', href: '/modules/soko-retail' },
      { label: 'Hardware', href: '/modules/hardware' },
      { label: 'Hospitality', href: '/modules/hospitality' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Help center', href: '/support' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="container-wide">
        {/* Big brand strip */}
        <div className="flex flex-col gap-10 border-b border-[var(--color-border)] py-16 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="group flex items-center gap-3"
              aria-label={`${BRAND_NAME} home`}
            >
              <BrandLogo className="h-10 w-10 shrink-0" />
              <span className="font-[family-name:var(--font-display)] text-[44px] font-normal leading-none text-[var(--color-fg)]">
                {BRAND_NAME}
              </span>
              <span aria-hidden className="size-2 rounded-full bg-[var(--color-accent)]" />
            </Link>
            <p className="mt-5 max-w-md font-[family-name:var(--font-display)] text-[20px] italic font-light leading-snug text-[var(--color-fg-muted)]">
              {BRAND.tagline}
            </p>
            <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-[var(--color-fg-subtle)]">
              Built in Nairobi for Kenyan businesses. Works offline. Pay once, use forever.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://wa.me/254700000000"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2.5 font-[family-name:var(--font-ui)] text-[13px] text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)]"
            >
              <Icon.WhatsApp className="size-4" weight="bold" />
              WhatsApp
            </a>
            <a
              href={`mailto:hello@${BRAND.domain}`}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2.5 font-[family-name:var(--font-ui)] text-[13px] text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)]"
            >
              <Icon.Email className="size-4" weight="bold" />
              hello@{BRAND.domain}
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 py-16 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start gap-4 border-t border-[var(--color-border)] py-8 text-[12px] text-[var(--color-fg-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 font-[family-name:var(--font-ui)] sm:flex-row sm:items-center sm:gap-4">
            <span>{BRAND.copyright}</span>
            <span className="hidden sm:inline">·</span>
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              KRA PIN P051234567A
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--color-positive)]" />
              All systems operational
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://twitter.com/omnix"
              aria-label="Twitter"
              className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
            >
              <Icon.Twitter className="size-4" />
            </a>
            <a
              href="https://linkedin.com/company/omnix"
              aria-label="LinkedIn"
              className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
            >
              <Icon.LinkedIn className="size-4" />
            </a>
            <a
              href="https://github.com/omnix"
              aria-label="GitHub"
              className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
            >
              <Icon.Github className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
