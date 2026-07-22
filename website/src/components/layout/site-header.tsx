'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { BRAND_NAME } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { BrandWordmark } from '@/components/brand-logo'
import { Sheet, SheetClose } from '@/components/ui/sheet'

interface NavItem {
  label: string
  href: string
  children?: Array<{ label: string; href: string; description?: string }>
}

const DEMO = { label: 'Book a demo', href: '/contact?type=demo' } as const

const NAV: readonly NavItem[] = [
  {
    label: 'Products',
    href: '/modules',
    children: [
      { label: 'Pharmacy', href: '/pharmacy', description: 'Dispensing, expiry, stock and patient records' },
      { label: 'Retail', href: '/retail', description: 'POS and inventory for shops and mini-marts' },
      { label: 'Hospitality', href: '/hospitality', description: 'Restaurant POS, kitchen orders and rooms' },
      { label: 'Hardware & Equipment', href: '/hardware', description: 'Quotations, contractor accounts, serialized equipment and stock' },
      { label: 'Salon & Spa', href: '/salon', description: 'Appointments, services, staff commissions and checkout' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  {
    label: 'Resources',
    href: '/docs',
    children: [
      { label: 'M-Pesa', href: '/mpesa', description: 'Understand payment and reconciliation options' },
      { label: 'KRA eTIMS', href: '/etims', description: 'See how sales move into tax records' },
      { label: 'Migration', href: '/migration', description: 'Plan your move from books or another system' },
      { label: 'Downloads', href: '/downloads', description: 'Get the Windows installer' },
      { label: 'Documentation', href: '/docs', description: 'Setup and operating guides' },
      { label: 'Support', href: '/support', description: 'Get help with Omnix' },
    ],
  },
  { label: 'About', href: '/about' },
] as const

/**
 * Sticky editorial header. Three columns:
 *   wordmark (left)  ·  nav centred  ·  one CTA hard right
 *
 * The Trades item is now a dropdown — five variants in one place.
 */
export function SiteHeader({
  locale,
  isAuthed = false,
  signInLabel = 'Sign in',
}: {
  locale: string
  isAuthed?: boolean
  signInLabel?: string
}) {
  const pathname = usePathname()
  const localePath = React.useCallback(
    (href: string) => `/${locale}${href === '/' ? '' : href}`,
    [locale],
  )
  const routePath = pathname === `/${locale}` ? '/' : pathname.slice(locale.length + 1) || '/'
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const navRef = React.useRef<HTMLElement | null>(null)
  // Disclosure triggers keyed by href, so Escape can restore focus to the
  // button that opened the panel (WAI-ARIA disclosure-navigation pattern).
  const triggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    setOpen(false)
    setOpenMenu(null)
  }, [pathname])

  // Lock body scroll while the mobile menu is open so the menu itself
  // scrolls (not the page behind it), and so iOS doesn't bounce.
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close any open dropdown on outside click.
  React.useEffect(() => {
    if (!openMenu) return
    const onClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Restore focus to the trigger that opened the panel before closing,
        // so keyboard users are not dropped at the top of the document.
        const trigger = triggerRefs.current[openMenu]
        setOpenMenu(null)
        trigger?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu])

  return (
    <>
    <a
      href="#main-content"
      className="sr-only fixed left-4 top-4 z-[100] rounded-[var(--radius-pill)] bg-[var(--color-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--color-bg)] focus:not-sr-only"
    >
      Skip to main content
    </a>
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-[background-color,border-color,backdrop-filter] duration-[var(--duration-ui)]',
        scrolled
          ? 'border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <div className="container-wide flex h-[72px] items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/* Wordmark */}
        <Link
          href={localePath('/')}
          aria-label={`${BRAND_NAME} home`}
          className="group flex w-fit items-center"
        >
          <BrandWordmark className="text-[24px]" />
        </Link>

        {/* Nav — truly centred */}
        <nav ref={navRef} className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = routePath === item.href || routePath.startsWith(`${item.href}/`)
            const childActive = item.children?.some(
              (child) => routePath === child.href || routePath.startsWith(`${child.href}/`),
            )
            const isOpen = openMenu === item.href
            const menuId = `site-nav-${item.href.replace(/[^a-zA-Z0-9]/g, '')}`

            if (item.children) {
              return (
                <div key={item.href} className="relative">
                  <button
                    type="button"
                    ref={(node) => {
                      triggerRefs.current[item.href] = node
                    }}
                    onClick={() => setOpenMenu((v) => (v === item.href ? null : item.href))}
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    className={cn(
                      'font-[family-name:var(--font-ui)] inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      active || childActive
                        ? 'text-[var(--color-fg)]'
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
                    )}
                  >
                    {item.label}
                    <Icon.ChevronDown
                      className={cn('size-3 transition-transform', isOpen ? 'rotate-180' : '')}
                      weight="bold"
                    />
                  </button>
                  {isOpen ? (
                    <ul
                      id={menuId}
                      onMouseLeave={() => setOpenMenu(null)}
                      className="absolute left-1/2 top-full z-50 mt-2 w-[340px] -translate-x-1/2 list-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-lg"
                    >
                      {item.children.map((c) => {
                        const childIsActive =
                          routePath === c.href || routePath.startsWith(`${c.href}/`)
                        return (
                          <li key={c.href}>
                            <Link
                              href={localePath(c.href)}
                              aria-current={childIsActive ? 'page' : undefined}
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
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={localePath(item.href)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'font-[family-name:var(--font-ui)] rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right column — each child gets shrink-0 so buttons/toggles keep
            their intrinsic size and the theme circle stays circular even at
            tight tablet widths. gap-3 tightens spacing so the row doesn't
            wrap into two lines. */}
        <div className="flex items-center justify-end gap-3 shrink-0">
          <div className="hidden w-[72px] shrink-0 lg:block">
            <LanguageSwitcher locale={locale} className="w-full rounded-md border border-[var(--color-border)] bg-transparent py-1 pl-2 pr-7 font-[family-name:var(--font-ui)] text-[12px] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer" />
          </div>
          <ThemeToggle className="hidden shrink-0 lg:inline-flex" />
          {isAuthed ? (
            <>
              <Link
                href="/dashboard"
                className="font-[family-name:var(--font-ui)] hidden shrink-0 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] lg:inline"
              >
                Account
              </Link>
              <Button asChild size="sm" className="hidden shrink-0 lg:inline-flex">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden shrink-0 text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] lg:inline"
              >
                {signInLabel}
              </Link>
              <Button asChild size="sm" className="hidden shrink-0 lg:inline-flex">
                <Link href={localePath(DEMO.href)}>{DEMO.label}</Link>
              </Button>
            </>
          )}

          {/* Hamburger — real 3-line List icon (was ListBullets which
              looked bulleted). shrink-0 keeps it 36×36 no matter how tight
              the header gets. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] lg:hidden"
          >
            <Icon.List className="size-5" weight="regular" />
          </button>
        </div>
      </div>
    </header>

    {/* Mobile sheet — Radix Dialog slides in from the right, portaled
        to <body> so it can't get trapped behind the sticky header.
        Editorial pattern lifted from zebra-trails-safari. */}
    <Sheet open={open} onOpenChange={setOpen} ariaLabel="Site navigation">
      <div className="flex h-full flex-col">
        {/* Masthead — wordmark + close */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
          <BrandWordmark className="text-[20px]" />
          <SheetClose />
        </div>

        {/* Nav — display-font links, generous vertical rhythm */}
        <nav className="flex-1 overflow-y-auto px-6 py-8">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <React.Fragment key={item.href}>
                {item.children ? (
                  <div className="mt-3 first:mt-0">
                    <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] px-1 mb-1">
                      {item.label}
                    </div>
                    <div className="flex flex-col">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={localePath(c.href)}
                          onClick={() => setOpen(false)}
                          className="font-[family-name:var(--font-display)] text-[22px] font-light tracking-[-0.01em] py-2 text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    href={localePath(item.href)}
                    onClick={() => setOpen(false)}
                    className="font-[family-name:var(--font-display)] text-[22px] font-light tracking-[-0.01em] py-2 text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </div>
        </nav>

        {/* Foot — primary CTA + language + theme */}
        <div className="border-t border-[var(--color-border)] px-6 py-6 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isAuthed ? (
            <Button asChild size="lg" className="w-full">
              <Link href="/dashboard" onClick={() => setOpen(false)}>Open dashboard</Link>
            </Button>
          ) : (
            <div className="grid gap-2">
              <Button asChild size="lg" className="w-full">
                <Link href={localePath(DEMO.href)} onClick={() => setOpen(false)}>
                  {DEMO.label}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full">
                <Link href="/login" onClick={() => setOpen(false)}>{signInLabel}</Link>
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
              Appearance & language
            </span>
            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={locale} className="inline-flex rounded-md border border-[var(--color-border)] bg-transparent py-1 pl-2 pr-7 font-[family-name:var(--font-ui)] text-[12px] text-[var(--color-fg-muted)] cursor-pointer" />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </Sheet>
    </>
  )
}
