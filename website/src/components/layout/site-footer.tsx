import Link from 'next/link'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import { Icon } from '@/components/icons'
import { BRAND_NAME } from '@/lib/brand'
import { BrandWordmark } from '@/components/brand-logo'
import { getSiteSettings } from '@/lib/site-settings'

interface FooterColumn {
  title: string
  links: { label: string; href: string }[]
}

const FALLBACK_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'AI', href: '/ai' },
      { label: 'Downloads', href: '/downloads' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Modules', href: '/modules' },
    ],
  },
  {
    title: 'Trades',
    links: [
      { label: 'Omnix Pro', href: '/pro' },
      { label: 'Omnix Dawa', href: '/dawa' },
      { label: 'Omnix Retail', href: '/retail' },
      { label: 'Omnix Hospitality', href: '/hospitality' },
      { label: 'Omnix Hardware', href: '/hardware' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Help center', href: '/support' },
      { label: 'Changelog', href: '/changelog' },
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
]

interface ArrayLink {
  label?: string | null
  href?: string | null
}

function pickLinks(arr: unknown, fallback: { label: string; href: string }[]): { label: string; href: string }[] {
  if (!Array.isArray(arr) || arr.length === 0) return fallback
  return (arr as ArrayLink[])
    .map((l) => ({ label: l?.label ?? '', href: l?.href ?? '' }))
    .filter((l) => l.label && l.href)
}

async function getFooterContent(headings: {
  product: string
  trades: string
  company: string
  legal: string
}): Promise<{
  columns: FooterColumn[]
  branding: string | null
  copyrightLine: string | null
}> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const g = (await payload.findGlobal({
      slug: 'footer-content',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const columns: FooterColumn[] = [
      {
        title: (g.productHeading as string | undefined) || headings.product,
        links: pickLinks(g.productLinks, FALLBACK_COLUMNS[0].links),
      },
      {
        title: (g.tradesHeading as string | undefined) || headings.trades,
        links: pickLinks(g.tradeLinks, FALLBACK_COLUMNS[1].links),
      },
      {
        title: (g.companyHeading as string | undefined) || headings.company,
        links: pickLinks(g.companyLinks, FALLBACK_COLUMNS[3].links),
      },
      {
        title: (g.legalHeading as string | undefined) || headings.legal,
        links: pickLinks(g.legalLinks, [
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
          { label: 'Refunds', href: '/refund-policy' },
        ]),
      },
    ]

    return {
      columns,
      branding: (g.branding as string | undefined) ?? null,
      copyrightLine: (g.copyrightLine as string | undefined) ?? null,
    }
  } catch {
    return {
      columns: [
        { ...FALLBACK_COLUMNS[0], title: headings.product },
        { ...FALLBACK_COLUMNS[1], title: headings.trades },
        { ...FALLBACK_COLUMNS[2], title: headings.company },
        { ...FALLBACK_COLUMNS[3], title: headings.legal },
      ],
      branding: null,
      copyrightLine: null,
    }
  }
}

export async function SiteFooter() {
  const [settings, t, tFoot] = await Promise.all([
    getSiteSettings(),
    getTranslations('footer'),
    getTranslations('footer.headings'),
  ])
  const footer = await getFooterContent({
    product: tFoot('product'),
    trades: tFoot('trades'),
    company: tFoot('company'),
    legal: tFoot('legal'),
  })

  const year = new Date().getFullYear()
  const copyright = footer.copyrightLine ?? `© ${year} Omnix Software Ltd.`
  const branding = footer.branding ?? t('tagline')

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="container-wide">
        {/* Big brand strip */}
        <div className="flex flex-col gap-10 border-b border-[var(--color-border)] py-16 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="group flex items-center"
              aria-label={`${BRAND_NAME} home`}
            >
              <BrandWordmark className="text-[44px]" />
            </Link>
            <p className="mt-5 max-w-md font-[family-name:var(--font-display)] text-[20px] italic font-light leading-snug text-[var(--color-fg-muted)]">
              {settings.tagline}
            </p>
            <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-[var(--color-fg-subtle)]">
              {branding}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {settings.whatsappUrl ? (
              <a
                href={settings.whatsappUrl}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2.5 font-[family-name:var(--font-ui)] text-[13px] text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)]"
              >
                <Icon.WhatsApp className="size-4" weight="bold" />
                WhatsApp
              </a>
            ) : null}
            <a
              href={`mailto:${settings.supportEmail}`}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-4 py-2.5 font-[family-name:var(--font-ui)] text-[13px] text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)]"
            >
              <Icon.Email className="size-4" weight="bold" />
              {settings.supportEmail}
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 py-16 sm:grid-cols-4">
          {footer.columns.map((col) => (
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
            <span>{copyright}</span>
            {settings.kraPin ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  KRA PIN {settings.kraPin}
                </span>
              </>
            ) : null}
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--color-positive)]" />
              {t('systemsOperational')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {settings.social.twitter ? (
              <a
                href={settings.social.twitter}
                aria-label="Twitter"
                className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              >
                <Icon.Twitter className="size-4" />
              </a>
            ) : null}
            {settings.social.linkedin ? (
              <a
                href={settings.social.linkedin}
                aria-label="LinkedIn"
                className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              >
                <Icon.LinkedIn className="size-4" />
              </a>
            ) : null}
            {settings.social.github ? (
              <a
                href={settings.social.github}
                aria-label="GitHub"
                className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              >
                <Icon.Github className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
