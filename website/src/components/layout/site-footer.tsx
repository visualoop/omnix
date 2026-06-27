/**
 * Site footer — uses static site-settings config.
 */
import Link from 'next/link'
import { getSiteSettings } from '@/lib/site-settings'
import { BrandWordmark } from '@/components/brand-logo'
import { LanguageSwitcher } from '@/components/layout/language-switcher'

const COLUMNS = [
  {
    title: 'Product',
    items: [
      { label: 'Modules', href: '/modules' },
      { label: 'Omnix AI', href: '/ai' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Downloads', href: '/downloads' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Migration', href: '/migration' },
      { label: 'Security & reliability', href: '/security' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About', href: '/about' },
      { label: 'Team', href: '/team' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Refund policy', href: '/refund-policy' },
    ],
  },
]

export async function SiteFooter() {
  const settings = await getSiteSettings()

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8 py-12">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-6">
          <div className="col-span-2 lg:col-span-2">
            <BrandWordmark className="text-[24px]" />
            <p className="mt-3 max-w-[280px] text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
              {settings.tagline}
            </p>
            <div className="mt-4 flex gap-3 text-[12px] text-[var(--color-fg-muted)]">
              {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="hover:text-[var(--color-fg)]">{settings.supportEmail}</a> : null}
              {settings.whatsappUrl ? <a href={settings.whatsappUrl} className="hover:text-[var(--color-fg)]">WhatsApp</a> : null}
            </div>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)] mb-3">
                {c.title}
              </div>
              <ul className="space-y-2">
                {c.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[var(--color-fg-subtle)]">
            © {new Date().getFullYear()} {settings.brandName}. Built in Nairobi.
          </p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  )
}
