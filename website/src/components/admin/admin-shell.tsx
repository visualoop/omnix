'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  List, X, SignOut,
  Gauge, Users, Buildings, Desktop, Key, CreditCard,
  ChatCircle, ArrowSquareOut, ListMagnifyingGlass, GearSix,
  UsersFour, Image as ImageIcon,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { SystemPulse } from '@/components/admin/system-pulse'

interface NavItem {
  href: string
  label: string
  Icon: Icon
}

// Single source of truth for the admin sidebar.
const NAV: NavItem[] = [
  { href: '/admin',          label: 'Overview',  Icon: Gauge },
  { href: '/admin/users',    label: 'Users',     Icon: Users },
  { href: '/admin/orgs',     label: 'Orgs',      Icon: Buildings },
  { href: '/admin/machines', label: 'Machines',  Icon: Desktop },
  { href: '/admin/licenses', label: 'Licences',  Icon: Key },
  { href: '/admin/payments', label: 'Payments',  Icon: CreditCard },
  { href: '/admin/tickets',  label: 'Tickets',   Icon: ChatCircle },
  { href: '/admin/releases', label: 'Releases',  Icon: ArrowSquareOut },
  { href: '/admin/media',    label: 'Media',     Icon: ImageIcon },
  { href: '/admin/audit',    label: 'Audit',     Icon: ListMagnifyingGlass },
  { href: '/admin/team',     label: 'Team',      Icon: UsersFour },
  { href: '/admin/settings', label: 'Settings',  Icon: GearSix },
]

/**
 * Admin chrome.
 *
 *   - Desktop (lg+): persistent 244px sidebar pinned to the left.
 *   - Mobile / tablet: hamburger top bar + slide-in drawer with the
 *     same nav. Drawer auto-dismisses on route change so users don't
 *     have to tap-close after navigating.
 *
 * The shell is a client component so it owns the drawer state; the
 * server layout (admin/layout.tsx) feeds it the precomputed nav, the
 * session data, and the SystemPulse stats.
 */
export function AdminShell({
  live,
  total,
  email,
  role,
  initials,
  children,
}: {
  live: number
  total: number
  email: string
  role: string
  initials: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // Close the drawer whenever the route changes so navigation feels right.
  React.useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open on mobile.
  React.useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  const currentPage = NAV.find(
    (n) => n.href === pathname || (n.href !== '/admin' && pathname.startsWith(`${n.href}/`)),
  )

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* ── Persistent sidebar (lg+) ───────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[244px] lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--color-border)] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <SidebarContent
          live={live}
          total={total}
          email={email}
          role={role}
          initials={initials}
        />
      </aside>

      {/* ── Mobile drawer (< lg) ───────────────────────────────── */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
            <SidebarContent
              live={live}
              total={total}
              email={email}
              role={role}
              initials={initials}
              onLinkClick={() => setDrawerOpen(false)}
              showCloseButton
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* ── Main column (header on mobile, then children) ──────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
          >
            <List className="size-5" />
          </button>
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-[18px] font-medium leading-none tracking-[-0.01em]"
            >
              Omnix
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] truncate">
              {currentPage?.label ?? 'ops'}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  live,
  total,
  email,
  role,
  initials,
  onLinkClick,
  showCloseButton,
  onClose,
}: {
  live: number
  total: number
  email: string
  role: string
  initials: string
  onLinkClick?: () => void
  showCloseButton?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  return (
    <>
      {/* Brand */}
      <div className="border-b border-[var(--color-border)] px-5 pt-6 pb-5 flex items-start justify-between gap-3">
        <Link href="/admin" className="block min-w-0" onClick={onLinkClick}>
          <div className="flex items-baseline gap-2">
            <span
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-[20px] font-medium leading-none tracking-[-0.01em]"
            >
              Omnix
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
              ops
            </span>
          </div>
          <SystemPulse live={live} total={total} />
        </Link>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mt-1 inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV.map((n) => {
          const active =
            n.href === '/admin'
              ? pathname === '/admin'
              : pathname === n.href || pathname.startsWith(`${n.href}/`)
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onLinkClick}
              className={`group mx-1 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
                active
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
              }`}
            >
              <n.Icon
                weight="regular"
                className={`size-4 shrink-0 ${
                  active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)]'
                }`}
              />
              <span>{n.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Account footer */}
      <div className="border-t border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-full grid place-items-center font-mono text-[11px] font-medium tabular-nums"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent-line)',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-[var(--color-fg)]">{email}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
              {role.replace('_', ' ')}
            </div>
          </div>
          <Link
            href="/api/auth/sign-out?callbackURL=/login"
            className="text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
            title="Sign out"
          >
            <SignOut weight="regular" className="size-4" />
          </Link>
        </div>
      </div>
    </>
  )
}
