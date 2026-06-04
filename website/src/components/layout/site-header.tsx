'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { BRAND_NAME } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'

const NAV = [
  { label: 'Modules', href: '/modules' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Docs', href: '/docs' },
] as const

/**
 * Sticky editorial header. Three columns:
 *   wordmark (left)  ·  nav centred  ·  one CTA hard right
 *
 * Composition rule: the CTA is the SINGLE primary action in the chrome.
 * Sign-in is a quiet text link that doesn't compete.
 *
 * Style: transparent until 60px scroll, then warm-blur with a 1px hairline.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

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
        {/* Wordmark — logo + Fraunces 24px + amber dot */}
        <Link
          href="/"
          aria-label={`${BRAND_NAME} home`}
          className="group flex w-fit items-center gap-2"
        >
          <BrandLogo className="h-7 w-7 shrink-0" />
          <span className="font-[family-name:var(--font-display)] text-[24px] font-medium leading-none tracking-[-0.02em] text-[var(--color-fg)]">
            {BRAND_NAME}
          </span>
          <span
            aria-hidden
            className="size-1.5 -translate-y-0.5 rounded-full bg-[var(--color-accent)] transition-transform group-hover:translate-y-0"
          />
        </Link>

        {/* Nav — truly centred */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
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
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right column — sign-in is a quiet text link, CTA is the hard right anchor */}
        <div className="flex items-center justify-end gap-5">
          <Link
            href="/login"
            className="font-[family-name:var(--font-ui)] hidden text-[13px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] sm:inline"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/signup">Start free trial</Link>
          </Button>

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

      {open ? (
        <div className="fixed inset-x-0 top-[72px] z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)] lg:hidden">
          <div className="container-wide flex flex-col gap-1 py-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-[family-name:var(--font-ui)] rounded-md px-3 py-3 text-[15px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Start free trial</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
