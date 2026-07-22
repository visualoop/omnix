import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DASHBOARD_NAVIGATION,
  allDashboardNavHrefs,
  dashboardNavigationForCapabilities,
  isActiveNavHref,
  isInternalHref,
  type DashboardCapabilities,
} from '@/components/dashboard/dashboard-navigation'
import { PAGE_ROUTE_GROUPS } from '@/config/route-inventory'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const shell = read('src/components/dashboard/dashboard-shell.tsx')
const layout = read('src/app/(dashboard)/layout.tsx')

const BASE: DashboardCapabilities = { isReseller: false }
const RESELLER: DashboardCapabilities = { isReseller: true }

const hrefsFor = (capabilities: DashboardCapabilities) =>
  dashboardNavigationForCapabilities(capabilities).flatMap((group) =>
    group.items.map((item) => item.href),
  )

/**
 * "Section roots" are the top-level, non-dynamic dashboard pages a customer
 * navigates between. Dynamic children (`/dashboard/licenses/[id]`) and
 * deeper action pages (`/dashboard/reseller/new`) are reached from their
 * parent and are not separate nav destinations.
 */
function dashboardSectionRoots(): string[] {
  return [...PAGE_ROUTE_GROUPS.dashboard]
    .filter((route) => {
      const segments = route.split('/').filter(Boolean)
      return segments.length <= 2 && !segments.some((segment) => segment.startsWith('['))
    })
    .sort()
}

describe('Task 23 dashboard navigation model', () => {
  it('represents every top-level dashboard section route, and nothing extra', () => {
    const navHrefs = [...allDashboardNavHrefs()].sort()
    expect(navHrefs).toEqual(dashboardSectionRoots())
  })

  it('contains no duplicate or dead nav links', () => {
    const navHrefs = allDashboardNavHrefs()
    expect(new Set(navHrefs).size).toBe(navHrefs.length)
    // Every nav href is a real page route in the inventory.
    for (const href of navHrefs) {
      expect(PAGE_ROUTE_GROUPS.dashboard, `${href} is not an inventoried route`).toContain(href)
    }
  })

  it('only emits safe, root-relative internal links', () => {
    for (const href of allDashboardNavHrefs()) {
      expect(isInternalHref(href), `${href} is not a safe internal link`).toBe(true)
    }
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '']) {
      expect(isInternalHref(bad)).toBe(false)
    }
  })

  it('gives every item a descriptive label and description', () => {
    for (const group of DASHBOARD_NAVIGATION) {
      expect(group.label.length).toBeGreaterThan(0)
      for (const item of group.items) {
        expect(item.label.length).toBeGreaterThan(0)
        expect(item.description.length).toBeGreaterThan(0)
      }
    }
  })

  it('groups destinations by buyer job', () => {
    expect(DASHBOARD_NAVIGATION.map((group) => group.label)).toEqual([
      'Overview',
      'Your software',
      'Payments',
      'Organisation',
      'Partner programs',
      'Account',
    ])
  })
})

describe('Task 23 capability-derived visibility', () => {
  it('hides the reseller channel from customers without a reseller account', () => {
    const hrefs = hrefsFor(BASE)
    expect(hrefs).not.toContain('/dashboard/reseller')
    // Team and the open affiliate programme remain available to any customer.
    expect(hrefs).toContain('/dashboard/team')
    expect(hrefs).toContain('/dashboard/affiliate')
  })

  it('surfaces the reseller channel only when the server confirms the capability', () => {
    expect(hrefsFor(RESELLER)).toContain('/dashboard/reseller')
  })

  it('never leaves an empty navigation group', () => {
    for (const capabilities of [BASE, RESELLER]) {
      for (const group of dashboardNavigationForCapabilities(capabilities)) {
        expect(group.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('derives visibility from explicit capabilities, never from the URL or storage', () => {
    expect(shell).toContain('dashboardNavigationForCapabilities(capabilities)')
    expect(shell).not.toContain('useSearchParams')
    expect(shell).not.toContain('localStorage')
    expect(layout).not.toContain('searchParams')
    expect(layout).not.toContain('localStorage')
  })
})

describe('Task 23 active-link matching', () => {
  it('matches the overview root exactly, not on child sections', () => {
    expect(isActiveNavHref('/dashboard', '/dashboard')).toBe(true)
    expect(isActiveNavHref('/dashboard/licenses', '/dashboard')).toBe(false)
  })

  it('matches a section on its exact path and any nested child', () => {
    expect(isActiveNavHref('/dashboard/licenses', '/dashboard/licenses')).toBe(true)
    expect(isActiveNavHref('/dashboard/licenses/abc123', '/dashboard/licenses')).toBe(true)
    expect(isActiveNavHref('/dashboard/reseller/new', '/dashboard/reseller')).toBe(true)
  })

  it('ignores query strings and fragments on both sides', () => {
    expect(isActiveNavHref('/dashboard/licenses?tab=cover', '/dashboard/licenses')).toBe(true)
    expect(isActiveNavHref('/dashboard#top', '/dashboard')).toBe(true)
  })

  it('does not treat sibling prefixes as active', () => {
    expect(isActiveNavHref('/dashboard/licenses-archive', '/dashboard/licenses')).toBe(false)
    expect(isActiveNavHref('/dashboard/machines', '/dashboard/licenses')).toBe(false)
  })
})

describe('Task 23 preserved gates and noindex', () => {
  it('keeps the dashboard auth gate and preserves the intended path', () => {
    expect(layout).toContain('auth.api.getSession')
    expect(layout).toContain('/login?next=')
    expect(layout).toContain('x-omnix-url')
  })

  it('marks the customer account area noindex', () => {
    expect(layout).toContain('index: false')
    expect(layout).toContain('follow: false')
    // robots.ts also disallows the app route group.
    expect(read('src/app/robots.ts')).toContain("'/dashboard'")
  })

  it('resolves capabilities from real server-side records', () => {
    expect(layout).toContain('resolveIsReseller')
    expect(layout).toContain('.from(resellers)')
    expect(layout).toContain('.from(member)')
  })

  it('keeps the reseller pages server-gated regardless of nav visibility', () => {
    const resellerPage = read('src/app/(dashboard)/dashboard/reseller/page.tsx')
    const resellerNew = read('src/app/(dashboard)/dashboard/reseller/new/page.tsx')
    expect(resellerPage).toContain('.from(resellers)')
    expect(resellerPage).toContain("redirect('/dashboard?notice=not_reseller')")
    expect(resellerNew).toContain("redirect('/dashboard')")
  })

  it('keeps the always-available account pages behind the session gate', () => {
    expect(read('src/app/(dashboard)/dashboard/team/page.tsx')).toContain("redirect('/login')")
    expect(read('src/app/(dashboard)/dashboard/affiliate/page.tsx')).toContain(
      "redirect('/login?next=/dashboard/affiliate')",
    )
  })
})

describe('Task 23 shell accessibility semantics', () => {
  it('provides a skip link that targets the main landmark', () => {
    expect(shell).toContain('Skip to content')
    expect(shell).toContain('href="#dashboard-main"')
    expect(shell).toContain('id="dashboard-main"')
  })

  it('routes content through the shared AppPage main landmark', () => {
    expect(shell).toContain('<AppPage')
    expect(shell).toContain('min-h-dvh')
    expect(shell).toContain('data-theme="working-counter"')
  })

  it('marks the current page and labels the navigation landmark', () => {
    expect(shell).toContain("aria-current={active ? 'page' : undefined}")
    expect(shell).toContain('aria-label="Account"')
  })

  it('uses the accessible sheet primitive for mobile with an explicit trigger', () => {
    expect(shell).toContain('<Sheet')
    expect(shell).toContain('side="left"')
    expect(shell).toContain('aria-expanded={drawerOpen}')
    expect(shell).toContain('onClick={() => setDrawerOpen(true)}')
  })

  it('offers sign-out and account context, and drops the dead logout link', () => {
    expect(shell).toContain('/api/auth/sign-out?callbackURL=/login')
    expect(shell).toContain('Sign out')
    expect(shell).toContain('organizationName')
    expect(shell).not.toContain('/api/customers/logout')
  })

  it('preserves the theme toggle', () => {
    expect(shell).toContain('ThemeToggle')
  })

  it('does not hide navigation behind hover-only affordances', () => {
    expect(shell).not.toContain('hidden group-hover')
    expect(shell).not.toContain('opacity-0 group-hover')
  })
})

describe('Task 23 responsive source contract', () => {
  it('keeps a persistent desktop rail and a mobile sheet at the lg breakpoint', () => {
    expect(shell).toContain('lg:flex')
    expect(shell).toContain('lg:hidden')
  })

  it('makes the desktop rail collapsible without touching link membership', () => {
    expect(shell).toContain('data-collapsed')
    expect(shell).toContain("collapsed ? 'Expand navigation' : 'Collapse navigation'")
    expect(shell).toContain('setCollapsed')
  })

  it('meets 44px touch targets and avoids transition-all', () => {
    expect(shell).toContain('min-h-11')
    expect(shell).toContain('size-11')
    expect(shell).not.toContain('transition-all')
  })
})
