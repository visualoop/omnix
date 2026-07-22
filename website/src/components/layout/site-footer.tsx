/** Global marketing footer: five-product navigation and demo-led conversion. */
import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-logo'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { PageContainer } from '@/components/layout/layout-primitives'
import { Button } from '@/components/ui/button'
import { AnalyticsPreferences } from '@/components/analytics/analytics-preferences'
import { resolveGaId } from '@/lib/analytics/ga'
import type { SiteSettings } from '@/lib/site-settings'

const COLUMNS = [
  {
    title: 'Products',
    items: [
      { label: 'Pharmacy', href: '/pharmacy' },
      { label: 'Retail', href: '/retail' },
      { label: 'Hospitality', href: '/hospitality' },
      { label: 'Hardware & Equipment', href: '/hardware' },
      { label: 'Salon & Spa', href: '/salon' },
    ],
  },
  {
    title: 'Buying Omnix',
    items: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'M-Pesa', href: '/mpesa' },
      { label: 'KRA eTIMS', href: '/etims' },
      { label: 'Migration', href: '/migration' },
      { label: 'Downloads', href: '/downloads' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Buyer guides', href: '/guides' },
      { label: 'Security', href: '/security' },
      { label: 'Support', href: '/support' },
      { label: 'Blog', href: '/blog' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About', href: '/about' },
      { label: 'Partners', href: '/partners' },
      { label: 'Contact', href: '/contact' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Refund policy', href: '/refund-policy' },
    ],
  },
] as const

export function SiteFooter({ locale, settings }: { locale: string; settings: SiteSettings }) {
  const localePath = (href: string) => `/${locale}${href === '/' ? '' : href}`
  const analyticsEnabled = resolveGaId(process.env.NEXT_PUBLIC_GA_ID) !== null

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <PageContainer width="wide" className="py-10 sm:py-14">
        <section className="grid gap-6 border-b border-[var(--color-border)] pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              See Omnix at work
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-[clamp(1.75rem,4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--color-fg)]">
              Choose software around how your business actually runs.
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {settings.whatsappUrl ? (
              <Button asChild variant="outline" size="lg">
                <a href={settings.whatsappUrl}>WhatsApp</a>
              </Button>
            ) : null}
            <Button asChild size="lg">
              <Link href={localePath('/contact?type=demo')}>Book a demo</Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
          <div>
            <Link href={localePath('/')} aria-label={`${settings.brandName} home`}>
              <BrandWordmark className="text-[24px]" />
            </Link>
            <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
              {settings.tagline}
            </p>
            <div className="mt-5 flex flex-col items-start gap-2 text-[13px] text-[var(--color-fg-muted)]">
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-[var(--color-fg)]">
                {settings.supportEmail}
              </a>
              {settings.whatsappUrl ? (
                <a href={settings.whatsappUrl} className="hover:text-[var(--color-fg)]">
                  WhatsApp {settings.whatsappDisplay ?? 'Omnix'}
                </a>
              ) : null}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={`${column.title} footer navigation`}>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                {column.title}
              </p>
              <ul className="space-y-2">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={localePath(item.href)}
                      className="text-[13px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[var(--color-fg-subtle)]">
            © {new Date().getFullYear()} {settings.brandName}. Built in Kenya.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {analyticsEnabled ? <AnalyticsPreferences /> : null}
            <LanguageSwitcher locale={locale} className="w-full sm:w-44" />
          </div>
        </div>
      </PageContainer>
    </footer>
  )
}
