'use client'

/* Hallmark · Working Counter · customer account portal shell · capability-aware, flat, light-first */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Download,
  KeyRound,
  Lifebuoy,
  List,
  Monitor,
  Receipt,
  Share,
  SignOut,
  Stack,
  Storefront,
  UserCircle,
  Users,
} from '@/components/icons'
import type { Icon } from '@phosphor-icons/react'
import { AppPage } from '@/components/layout/layout-primitives'
import { Sheet, SheetClose } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { BRAND_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'
import {
  dashboardNavigationForCapabilities,
  isActiveNavHref,
  type DashboardCapabilities,
  type DashboardNavGroup,
  type DashboardNavIcon,
} from '@/components/dashboard/dashboard-navigation'

/** Icon-key → concrete component. Kept in the client shell so the nav model
 *  itself stays framework-free and unit-testable in Node. */
const NAV_ICONS: Record<DashboardNavIcon, Icon> = {
  overview: Stack,
  licences: KeyRound,
  devices: Monitor,
  downloads: Download,
  payments: Receipt,
  billing: CreditCard,
  team: Users,
  reseller: Storefront,
  affiliate: Share,
  support: Lifebuoy,
  profile: UserCircle,
}

/** Better Auth sign-out (matches the admin console). callbackURL returns the
 *  browser to /login once the session cookie is cleared. */
const SIGN_OUT_HREF = '/api/auth/sign-out?callbackURL=/login'

export interface DashboardShellProps {
  customerName: string
  customerEmail: string
  /** Real, server-resolved organisation context (null for a solo account). */
  organizationName: string | null
  /** Real, server-resolved capabilities driving conditional navigation. */
  capabilities: DashboardCapabilities
  whatsappUrl: string | null
  supportEmail: string
  children: React.ReactNode
}

/**
 * Customer account portal shell.
 *
 * Layout contract:
 *   - < lg (1024px): a compact top bar with a hamburger that opens an
 *     accessible Radix Dialog sheet (focus trap, Escape, outside-click, and
 *     scroll lock all handled by the primitive).
 *   - >= lg: a persistent left rail the customer can collapse to a compact,
 *     icon-only strip. Collapse is a pure UI preference held in component
 *     state — it never affects which links exist.
 *
 * Everything scrolls safely between 320px and 1440px because the content
 * column is `min-w-0` and the rail is a fixed-width flex sibling.
 */
export function DashboardShell({
  customerName,
  customerEmail,
  organizationName,
  capabilities,
  whatsappUrl,
  supportEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const navigation = React.useMemo(
    () => dashboardNavigationForCapabilities(capabilities),
    [capabilities],
  )
  const currentPage = navigation
    .flatMap((group) => group.items)
    .find((item) => isActiveNavHref(pathname, item.href))

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  return (
    <div
      data-dashboard-shell
      data-theme="working-counter"
      className="flex min-h-dvh min-w-0 bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {/* Keyboard/screen-reader users jump straight past the nav to content. */}
      <a
        href="#dashboard-main"
        className="sr-only rounded-[var(--radius-sm)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-[var(--color-surface)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-[var(--color-fg)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]"
      >
        Skip to content
      </a>

      {/* Desktop rail — persistent, collapsible. */}
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:flex',
          collapsed ? 'w-[76px]' : 'w-[268px]',
        )}
      >
        <SidebarContent
          navigation={navigation}
          pathname={pathname}
          customerName={customerName}
          customerEmail={customerEmail}
          organizationName={organizationName}
          whatsappUrl={whatsappUrl}
          supportEmail={supportEmail}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* Mobile drawer — accessible Radix sheet. */}
      <Sheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="left"
        ariaLabel="Account navigation"
        className="border-r border-[var(--color-border)] shadow-none lg:hidden"
      >
        <SidebarContent
          navigation={navigation}
          pathname={pathname}
          customerName={customerName}
          customerEmail={customerEmail}
          organizationName={organizationName}
          whatsappUrl={whatsappUrl}
          supportEmail={supportEmail}
          onLinkClick={() => setDrawerOpen(false)}
          mobile
        />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar. */}
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open account navigation"
            aria-expanded={drawerOpen}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <List className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight">
              {currentPage?.label ?? 'Account'}
            </div>
            <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {organizationName ?? BRAND_NAME + ' account'}
            </div>
          </div>
          <ThemeToggle />
        </header>

        <AppPage id="dashboard-main" width="wide" density="default" data-dashboard-content>
          {children}
        </AppPage>
      </div>
    </div>
  )
}

interface SidebarContentProps {
  navigation: DashboardNavGroup[]
  pathname: string
  customerName: string
  customerEmail: string
  organizationName: string | null
  whatsappUrl: string | null
  supportEmail: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  onLinkClick?: () => void
  mobile?: boolean
}

function SidebarContent({
  navigation,
  pathname,
  customerName,
  customerEmail,
  organizationName,
  whatsappUrl,
  supportEmail,
  collapsed = false,
  onToggleCollapse,
  onLinkClick,
  mobile = false,
}: SidebarContentProps) {
  const initials = getInitials(customerName)

  return (
    <>
      {/* Masthead — brand + account context. */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4">
        <Link
          href="/dashboard"
          onClick={onLinkClick}
          className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          aria-label={`${BRAND_NAME} account home`}
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] font-display text-[15px] font-semibold leading-none text-[var(--color-accent-foreground)]"
          >
            O
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold leading-none tracking-[-0.02em]">
                {BRAND_NAME}
              </span>
              <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
                Account portal
              </span>
            </span>
          ) : null}
        </Link>
        {mobile ? <SheetClose /> : null}
        {!mobile && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
              collapsed && 'mx-auto',
            )}
          >
            {collapsed ? (
              <ArrowRight className="size-4" aria-hidden />
            ) : (
              <ArrowLeft className="size-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {/* Organisation / account context strip. */}
      {!collapsed ? (
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            {organizationName ? 'Organisation' : 'Account'}
          </div>
          <div className="mt-1 truncate text-[13px] font-medium text-[var(--color-fg)]">
            {organizationName ?? customerName}
          </div>
        </div>
      ) : null}

      {/* Primary navigation. */}
      <nav
        aria-label="Account"
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {navigation.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed ? (
              <div className="mb-1.5 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                {group.label}
              </div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-[var(--color-border)]" aria-hidden />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActiveNavHref(pathname, item.href)
                const NavIcon = NAV_ICONS[item.icon]
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? `${item.label} — ${item.description}` : item.description}
                    className={cn(
                      'group flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border-l-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
                      collapsed && 'justify-center gap-0 px-0',
                      active
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-fg)]'
                        : 'border-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
                    )}
                  >
                    <NavIcon
                      weight={active ? 'fill' : 'regular'}
                      className={cn(
                        'size-4 shrink-0',
                        active
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-fg-subtle)] group-hover:text-[var(--color-fg)]',
                      )}
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Help — website-account support, distinct from the installed app. */}
      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-[12px] font-medium text-[var(--color-fg)]">Need a hand?</div>
          <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-fg-muted)]">
            This portal manages your licences, payments and support. Your shop runs in the
            installed Omnix app.
          </p>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              className="mt-2 inline-flex text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
            >
              Message us on WhatsApp →
            </a>
          ) : (
            <a
              href={`mailto:${supportEmail}`}
              className="mt-2 inline-flex break-all text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
            >
              {supportEmail} →
            </a>
          )}
        </div>
      ) : null}

      {/* Account footer — identity, theme, sign-out. */}
      <div className="border-t border-[var(--color-border)] px-3 py-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] font-mono text-[11px] font-semibold text-[var(--color-accent)]"
              aria-hidden
              title={customerEmail}
            >
              {initials}
            </span>
            <ThemeToggle />
            <Link
              href={SIGN_OUT_HREF}
              aria-label="Sign out"
              title="Sign out"
              onClick={onLinkClick}
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <SignOut className="size-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] font-mono text-[11px] font-semibold text-[var(--color-accent)]"
              aria-hidden
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-[var(--color-fg)]">
                {customerName}
              </span>
              <span className="block truncate text-[11px] text-[var(--color-fg-subtle)]">
                {customerEmail}
              </span>
            </span>
            <ThemeToggle />
            <Link
              href={SIGN_OUT_HREF}
              aria-label="Sign out"
              title="Sign out"
              onClick={onLinkClick}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <SignOut className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'YOU'
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
