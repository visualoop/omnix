'use client'

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { BRAND_NAME } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { BrandWordmark } from '@/components/brand-logo'

interface NavItem {
  /** Translation key under the 'nav' namespace, e.g. 'pricing' → t('pricing') */
  labelKey: string
  href: string
  /** When set, this entry expands to a dropdown of children. */
  children?: Array<{ label: string; href: string; description?: string }>
}

const NAV: readonly NavItem[] = [
  {
    labelKey: 'trades',
    href: '/modules',
    children: [
      { label: 'Omnix Pro', href: '/pro', description: 'All four trades — multi-trade businesses' },
      { label: 'Omnix Dawa', href: '/dawa', description: 'Pharmacy management' },
      { label: 'Omnix Retail', href: '/retail', description: 'Shops, mini-marts, dukas' },
      { label: 'Omnix Hospitality', href: '/hospitality', description: 'Restaurants, bars, lodges' },
      { label: 'Omnix Hardware', href: '/hardware', description: 'Hardware stores, contractors' },
    ],
  },
  { labelKey: 'pricing', href: '/pricing' },
  { labelKey: 'ai', href: '/ai' },
  { labelKey: 'downloads', href: '/downloads' },
  { labelKey: 'changelog', href: '/changelog' },
  { labelKey: 'docs', href: '/docs' },
] as const

/**
 * Sticky editorial header. Three columns:
 *   wordmark (left)  ·  nav centred  ·  one CTA hard right
 *
 * The Trades item is now a dropdown — five variants in one place.
 */
export function SiteHeader({ isAuthed = false }: { isAuthed?: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [tradesOpen, setTradesOpen] = React.useState(false)
  const tradesRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    setOpen(false)
    setTradesOpen(false)
  }, [pathname])

  // Close trades dropdown on outside click.
  React.useEffect(() => {
    if (!tradesOpen) return
    const onClick = (e: MouseEvent) => {
      if (tradesRef.current && !tradesRef.current.contains(e.target as Node)) {
        setTradesOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [tradesOpen])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        scrolled
          ? 'border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <div className="container-wide flex h-[72px] items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/* Wordmark */}
        <Link
          href="/"
          aria-label={`${BRAND_NAME} home`}
          className="group flex w-fit items-center"
        >
          <BrandWordmark className="text-[24px]" />
        </Link>

        {/* Nav — truly centred */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const childActive = item.children?.some(
              (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
            )

            if (item.children) {
              return (
                <div key={item.href} ref={tradesRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setTradesOpen((v) => !v)}
                    onMouseEnter={() => setTradesOpen(true)}
                    aria-expanded={tradesOpen}
                    aria-haspopup="menu"
                    className={cn(
                      'font-[family-name:var(--font-ui)] inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      active || childActive
                        ? 'text-[var(--color-fg)]'
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
                    )}
                  >
                    {t(item.labelKey)}
                    <Icon.ChevronDown
                      className={cn('size-3 transition-transform', tradesOpen ? 'rotate-180' : '')}
                      weight="bold"
                    />
                  </button>
                  {tradesOpen ? (
                    <div
                      role="menu"
                      onMouseLeave={() => setTradesOpen(false)}
                      className="absolute left-1/2 top-full z-50 mt-2 w-[340px] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-lg"
                    >
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          role="menuitem"
                          className="block rounded-md px-3 py-2.5 hover:bg-[var(--color-surface-hover)]"
                        >
                          <div className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[var(--color-fg)]">
                            {c.label}
                          </div>
                          {c.description ? (
                            <div className="text-[12px] text-[var(--color-fg-muted)] mt-0.5">
                              {c.description}
                            </div>
                          ) : null}
                        </Link>
                      ))}
                      <div className="mt-1 border-t border-[var(--color-border)] pt-1">
                        <Link
                          href="/modules"
                          role="menuitem"
                          className="block rounded-md px-3 py-2 text-[12px] text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
                        >
                          Compare all modules →
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'font-[family-name:var(--font-ui)] rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
                )}
              >
                {t(item.labelKey)}
              </Link>
            )
          })}
        </nav>

        {/* Right column */}
        <div className="flex items-center justify-end gap-5">
          <LanguageSwitcher className="hidden lg:inline-flex rounded-md border border-[var(--color-border)] bg-transparent py-1 pl-2 pr-7 font-[family-name:var(--font-ui)] text-[12px] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer" />
          {isAuthed ? (
            <>
              <Link
                href="/dashboard"
                className="font-[family-name:var(--font-ui)] hidden text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] sm:inline"
              >
                Account
              </Link>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-[family-name:var(--font-ui)] hidden text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] sm:inline"
              >
                {t('signIn')}
              </Link>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">{t('startTrial')}</Link>
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] lg:hidden"
          >
            {open ? <Icon.Close className="size-5" /> : <Icon.ListBullets className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav (flat — children expanded inline) */}
      {open ? (
        <div className="fixed inset-x-0 top-[72px] z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)] lg:hidden">
          <div className="container-wide flex flex-col gap-1 py-6">
            {NAV.map((item) => (
              <React.Fragment key={item.href}>
                {item.children ? (
                  <>
                    <div className="font-[family-name:var(--font-ui)] mt-2 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                      {t(item.labelKey)}
                    </div>
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className="font-[family-name:var(--font-ui)] rounded-md px-3 py-2.5 text-[15px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className="font-[family-name:var(--font-ui)] rounded-md px-3 py-3 text-[15px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
                  >
                    {t(item.labelKey)}
                  </Link>
                )}
              </React.Fragment>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {isAuthed ? (
                <Button asChild className="col-span-2">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline">
                    <Link href="/login">{t('signIn')}</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">{t('startTrial')}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
