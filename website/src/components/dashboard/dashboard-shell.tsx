'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  CreditCard,
  Download,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Receipt,
  Settings,
  X,
} from '@/components/icons'
import { BRAND_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Licences', href: '/dashboard/licenses', icon: KeyRound },
  { label: 'Downloads', href: '/dashboard/downloads', icon: Download },
  { label: 'Machines', href: '/dashboard/machines', icon: Monitor },
  { label: 'Payments', href: '/dashboard/payments', icon: Receipt },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Support', href: '/dashboard/support', icon: HelpCircle },
  { label: 'Profile', href: '/dashboard/profile', icon: Settings },
] as const

export function DashboardShell({
  customerName,
  customerEmail,
  whatsappUrl,
  supportEmail,
  children,
}: {
  customerName: string
  customerEmail: string
  whatsappUrl: string | null
  supportEmail: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [accountOpen, setAccountOpen] = React.useState(false)

  React.useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] lg:hidden"
          >
            {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-[18px] font-semibold leading-none text-[var(--color-fg)]">
              {BRAND_NAME}
            </span>
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-accent)]" />
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Notifications"
              className="relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--color-accent)]" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-[11px] font-semibold text-[var(--color-accent-hover)]">
                  {customerName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="hidden sm:inline">{customerName.split(' ')[0]}</span>
                <ChevronDown className="size-3.5" />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-2xl">
                  <div className="border-b border-[var(--color-border)] px-4 py-3">
                    <div className="text-[13px] font-medium text-[var(--color-fg)]">
                      {customerName}
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-subtle)]">
                      {customerEmail}
                    </div>
                  </div>
                  <ul className="py-1.5">
                    <li>
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
                      >
                        <Settings className="size-3.5" />
                        Profile settings
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/api/customers/logout"
                        className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
                      >
                        <LogOut className="size-3.5" />
                        Sign out
                      </Link>
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden border-r border-[var(--color-border)] lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:flex-shrink-0">
          <SidebarNav pathname={pathname} whatsappUrl={whatsappUrl} supportEmail={supportEmail} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 left-0 w-64 border-r border-[var(--color-border)] bg-[var(--color-bg)] pt-16">
              <SidebarNav pathname={pathname} whatsappUrl={whatsappUrl} supportEmail={supportEmail} />
            </aside>
          </div>
        ) : null}

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SidebarNav({
  pathname,
  whatsappUrl,
  supportEmail,
}: {
  pathname: string
  whatsappUrl: string | null
  supportEmail: string
}) {
  return (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        Dashboard
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
              active
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]',
            )}
          >
            <item.icon
              className={cn(
                'size-4',
                active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-subtle)]',
              )}
            />
            <span className="flex-1">{item.label}</span>
          </Link>
        )
      })}

      <div className="mt-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-[12px] font-medium text-[var(--color-fg)]">
          Need help?
        </h3>
        {whatsappUrl ? (
          <>
            <p className="mt-1 text-[11px] leading-[1.4] text-[var(--color-fg-muted)]">
              WhatsApp the owner for fast answers.
            </p>
            <a
              href={whatsappUrl}
              className="mt-2 inline-flex text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              Open WhatsApp →
            </a>
          </>
        ) : (
          <>
            <p className="mt-1 text-[11px] leading-[1.4] text-[var(--color-fg-muted)]">
              Email us — replies within 24h.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-2 inline-flex text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              {supportEmail} →
            </a>
          </>
        )}
      </div>
    </nav>
  )
}
