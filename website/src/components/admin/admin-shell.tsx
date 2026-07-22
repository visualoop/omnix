'use client'

/* Hallmark · Working Counter · admin operations rail · capability-aware, flat, light-first */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowSquareOut,
  Buildings,
  ChatCircle,
  CreditCard,
  Desktop,
  Gauge,
  GearSix,
  Image as ImageIcon,
  Key,
  List,
  ListMagnifyingGlass,
  MonitorPlay,
  SignOut,
  Storefront,
  UserCircle,
  Users,
  UsersFour,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

import {
  adminNavigationForRole,
  isActiveNavHref,
  type AdminNavIcon,
} from '@/components/admin/admin-navigation'
import { AppPage } from '@/components/layout/layout-primitives'
import { Sheet, SheetClose } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/cn'

/** Icon-key → concrete component. Kept in the client shell so the nav model
 *  itself stays framework-free and unit-testable in Node. */
const NAV_ICONS: Record<AdminNavIcon, Icon> = {
  overview: Gauge,
  users: Users,
  organizations: Buildings,
  machines: Desktop,
  licenses: Key,
  payments: CreditCard,
  tickets: ChatCircle,
  releases: ArrowSquareOut,
  media: ImageIcon,
  moduleVideos: MonitorPlay,
  teamPage: UsersFour,
  audit: ListMagnifyingGlass,
  staff: UsersFour,
  settings: GearSix,
}

/** Better Auth sign-out (matches the customer dashboard). callbackURL returns
 *  the browser to /login once the session cookie is cleared. */
const SIGN_OUT_HREF = '/api/auth/sign-out?callbackURL=/login'

interface AdminShellProps {
  live: number
  total: number
  email: string
  role: string
  initials: string
  isImpersonating?: boolean
  children: React.ReactNode
}

/**
 * Operator console shell.
 *
 * Layout contract:
 *   - < lg (1024px): a compact top bar with a hamburger that opens an
 *     accessible Radix Dialog sheet (focus trap, Escape, outside-click, and
 *     scroll lock are all handled by the primitive).
 *   - >= lg: a persistent left rail.
 *
 * The rail mirrors the staff role's capabilities, but it is a usability
 * boundary only — every page and API keeps its own server-side gate.
 */
export function AdminShell({
  live,
  total,
  email,
  role,
  initials,
  isImpersonating = false,
  children,
}: AdminShellProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const navigation = React.useMemo(() => adminNavigationForRole(role), [role])
  const currentPage = navigation
    .flatMap((group) => group.items)
    .find((item) => isActiveNavHref(pathname, item.href))

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  return (
    <div
      data-admin-shell
      data-theme="working-counter"
      className="flex min-h-dvh min-w-0 bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {/* Keyboard/screen-reader users jump straight past the nav to content. */}
      <a
        href="#admin-main"
        className="sr-only rounded-[var(--radius-sm)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-[var(--color-surface)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-[var(--color-fg)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]"
      >
        Skip to content
      </a>

      {/* Desktop rail — persistent at the lg breakpoint. */}
      <aside className="sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:flex">
        <SidebarContent
          live={live}
          total={total}
          email={email}
          role={role}
          initials={initials}
          navigation={navigation}
          pathname={pathname}
        />
      </aside>

      {/* Mobile drawer — accessible Radix sheet. */}
      <Sheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="left"
        ariaLabel="Operator console navigation"
        className="border-r border-[var(--color-border)] shadow-none lg:hidden"
      >
        <SidebarContent
          live={live}
          total={total}
          email={email}
          role={role}
          initials={initials}
          navigation={navigation}
          pathname={pathname}
          onLinkClick={() => setDrawerOpen(false)}
          mobile
        />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {isImpersonating ? <ImpersonationBanner email={email} /> : null}

        {/* Mobile top bar. */}
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open operator navigation"
            aria-expanded={drawerOpen}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <List className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight">
              {currentPage?.label ?? 'Operator console'}
            </div>
            <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {live} of {total} machines live
            </div>
          </div>
          <span className="shrink-0 rounded-[var(--radius-xs)] border border-[var(--color-border)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
            {roleLabel(role)}
          </span>
          <ThemeToggle />
        </header>

        <AppPage id="admin-main" width="bleed" density="compact" data-admin-content>
          {children}
        </AppPage>
      </div>
    </div>
  )
}

interface SidebarContentProps extends Omit<AdminShellProps, 'children' | 'isImpersonating'> {
  navigation: ReturnType<typeof adminNavigationForRole>
  pathname: string
  onLinkClick?: () => void
  mobile?: boolean
}

function SidebarContent({
  live,
  total,
  email,
  role,
  initials,
  navigation,
  pathname,
  onLinkClick,
  mobile = false,
}: SidebarContentProps) {
  return (
    <>
      {/* Masthead — brand + honest live-install count. */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-5">
        <Link
          href="/admin"
          className="min-w-0 rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          onClick={onLinkClick}
          aria-label="Operator console home"
        >
          <span className="block text-[18px] font-semibold leading-none tracking-[-0.035em]">Omnix</span>
          <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
            Operator console
          </span>
        </Link>
        {mobile ? <SheetClose /> : null}
      </div>

      {/* Live install ledger — a single static, honest counter (no looping motion). */}
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-5 py-3">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: live > 0 ? 'var(--color-accent)' : 'var(--color-fg-subtle)' }}
        />
        <span className="font-mono text-[12px] font-semibold tabular-nums leading-none text-[var(--color-fg)]">
          {live}/{total}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          machines live
        </span>
        <span className="sr-only">
          {live} of {total} registered machines were seen in the last five minutes.
        </span>
      </div>

      {/* Primary navigation. */}
      <nav aria-label="Operator console" className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <div className="mb-1.5 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              {group.label}
            </div>
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
                    title={item.description}
                    className={cn(
                      'group flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border-l-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
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
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Context — this console is not the customer account or the installed app. */}
      <div className="mx-3 mb-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          Platform operations
        </div>
        <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-fg-muted)]">
          Staff console for Omnix operations — separate from your customer account and the
          installed desktop app.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          <Link
            href="/dashboard"
            onClick={onLinkClick}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <UserCircle className="size-3.5 shrink-0" aria-hidden />
            Customer dashboard
          </Link>
          <Link
            href="/"
            onClick={onLinkClick}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <Storefront className="size-3.5 shrink-0" aria-hidden />
            View public site
          </Link>
        </div>
      </div>

      {/* Staff identity + role context + sign-out. */}
      <div className="border-t border-[var(--color-border)] px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] font-mono text-[11px] font-semibold tabular-nums text-[var(--color-accent)]"
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-[var(--color-fg)]">{email}</span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              {roleLabel(role)}
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
            <SignOut weight="regular" className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  )
}

function ImpersonationBanner({ email }: { email: string }) {
  const [stopping, setStopping] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function stopImpersonating() {
    setStopping(true)
    setError(null)
    const result = await authClient.admin.stopImpersonating()
    if (result.error) {
      setError('Could not end impersonation. Try again.')
      setStopping(false)
      return
    }
    window.location.assign('/admin')
  }

  return (
    <div
      role="status"
      className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-caution)] bg-[color-mix(in_srgb,var(--color-caution)_10%,var(--color-bg))] px-4 py-2 text-[12px]"
    >
      <p className="m-0 min-w-0 font-medium">
        Impersonation active <span className="text-[var(--color-fg-muted)]">— acting as {email}</span>
      </p>
      <div className="flex items-center gap-3">
        {error ? <span className="text-[var(--color-negative)]">{error}</span> : null}
        <button
          type="button"
          onClick={stopImpersonating}
          disabled={stopping}
          className="rounded-[var(--radius-xs)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--color-fg-muted)] disabled:cursor-wait disabled:opacity-60"
        >
          {stopping ? 'Ending…' : 'End impersonation'}
        </button>
      </div>
    </div>
  )
}

function roleLabel(role: string): string {
  return role.replaceAll('_', ' ')
}
