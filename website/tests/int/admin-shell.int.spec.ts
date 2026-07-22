import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ADMIN_NAVIGATION,
  adminNavigationForRole,
  allAdminNavHrefs,
  isActiveNavHref,
  isInternalHref,
  isStaffRole,
} from '@/components/admin/admin-navigation'
import { PAGE_ROUTE_GROUPS } from '@/config/route-inventory'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const shell = read('src/components/admin/admin-shell.tsx')
const layout = read('src/app/admin/layout.tsx')
const overview = read('src/app/admin/page.tsx')

const hrefsFor = (role: string) =>
  adminNavigationForRole(role).flatMap((group) => group.items.map((item) => item.href))

/**
 * "Section roots" are the top-level, non-dynamic admin pages a staff member
 * navigates between. Dynamic detail children (`/admin/users/[id]`) and create
 * forms (`/admin/customers/new`) are reached from their section and are not
 * separate nav destinations.
 */
function adminSectionRoots(): string[] {
  return [...PAGE_ROUTE_GROUPS.admin]
    .filter((route) => {
      const segments = route.split('/').filter(Boolean)
      return segments.length <= 2 && !segments.some((segment) => segment.startsWith('['))
    })
    .sort()
}

describe('Task 25 operator console navigation model', () => {
  it('represents every top-level admin section route, and nothing extra', () => {
    expect([...allAdminNavHrefs()].sort()).toEqual(adminSectionRoots())
  })

  it('contains no duplicate or dead nav links', () => {
    const navHrefs = allAdminNavHrefs()
    expect(new Set(navHrefs).size).toBe(navHrefs.length)
    for (const href of navHrefs) {
      expect(PAGE_ROUTE_GROUPS.admin, `${href} is not an inventoried route`).toContain(href)
    }
  })

  it('only emits safe, root-relative internal links', () => {
    for (const href of allAdminNavHrefs()) {
      expect(isInternalHref(href), `${href} is not a safe internal link`).toBe(true)
    }
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '']) {
      expect(isInternalHref(bad)).toBe(false)
    }
  })

  it('gives every item a descriptive label and description', () => {
    for (const group of ADMIN_NAVIGATION) {
      expect(group.label.length).toBeGreaterThan(0)
      for (const item of group.items) {
        expect(item.label.length).toBeGreaterThan(0)
        expect(item.description.length).toBeGreaterThan(0)
      }
    }
  })

  it('groups destinations by operational job', () => {
    expect(ADMIN_NAVIGATION.map((group) => group.label)).toEqual([
      'Overview',
      'Customers',
      'Licences & devices',
      'Payments',
      'Releases',
      'Support',
      'Trust & content',
      'Audit & settings',
    ])
  })
})

describe('Task 25 capability-derived visibility', () => {
  it('shows a platform admin every operational desk', () => {
    expect(hrefsFor('platform_admin')).toEqual([
      '/admin',
      '/admin/users',
      '/admin/orgs',
      '/admin/licenses',
      '/admin/machines',
      '/admin/payments',
      '/admin/releases',
      '/admin/tickets',
      '/admin/media',
      '/admin/module-videos',
      '/admin/team-members',
      '/admin/audit',
      '/admin/team',
      '/admin/settings',
    ])
  })

  it('limits support staff to customers, the support queue, and the audit trail', () => {
    expect(hrefsFor('support_agent')).toEqual([
      '/admin',
      '/admin/users',
      '/admin/orgs',
      '/admin/tickets',
      '/admin/audit',
    ])
  })

  it('limits sales staff to customers and payment records', () => {
    expect(hrefsFor('sales_rep')).toEqual([
      '/admin',
      '/admin/users',
      '/admin/orgs',
      '/admin/payments',
    ])
  })

  it('shows non-staff nothing at all', () => {
    expect(hrefsFor('user')).toEqual([])
    expect(hrefsFor('')).toEqual([])
    expect(isStaffRole('user')).toBe(false)
    expect(isStaffRole('platform_admin')).toBe(true)
  })

  it('keeps platform-admin-only desks hidden from support and sales staff', () => {
    const adminOnly = [
      '/admin/licenses',
      '/admin/machines',
      '/admin/releases',
      '/admin/media',
      '/admin/module-videos',
      '/admin/team-members',
      '/admin/team',
      '/admin/settings',
    ]
    for (const href of adminOnly) {
      expect(hrefsFor('support_agent'), `${href} leaked to support`).not.toContain(href)
      expect(hrefsFor('sales_rep'), `${href} leaked to sales`).not.toContain(href)
    }
  })

  it('scopes payments to sales, and tickets/audit to support', () => {
    expect(hrefsFor('sales_rep')).toContain('/admin/payments')
    expect(hrefsFor('support_agent')).not.toContain('/admin/payments')
    expect(hrefsFor('support_agent')).toContain('/admin/tickets')
    expect(hrefsFor('support_agent')).toContain('/admin/audit')
    expect(hrefsFor('sales_rep')).not.toContain('/admin/tickets')
    expect(hrefsFor('sales_rep')).not.toContain('/admin/audit')
  })

  it('never leaves an empty navigation group', () => {
    for (const role of ['platform_admin', 'support_agent', 'sales_rep']) {
      for (const group of adminNavigationForRole(role)) {
        expect(group.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('derives visibility from the explicit role, never from the URL or storage', () => {
    expect(shell).toContain('adminNavigationForRole(role)')
    expect(shell).not.toContain('useSearchParams')
    expect(shell).not.toContain('localStorage')
    expect(layout).not.toContain('searchParams')
    expect(layout).not.toContain('localStorage')
  })
})

describe('Task 25 active-link matching', () => {
  it('matches the overview root exactly, not on child sections', () => {
    expect(isActiveNavHref('/admin', '/admin')).toBe(true)
    expect(isActiveNavHref('/admin/users', '/admin')).toBe(false)
  })

  it('marks a section active on its exact path and any nested detail child', () => {
    expect(isActiveNavHref('/admin/users', '/admin/users')).toBe(true)
    expect(isActiveNavHref('/admin/users/abc123', '/admin/users')).toBe(true)
    expect(isActiveNavHref('/admin/tickets/t-1', '/admin/tickets')).toBe(true)
    expect(isActiveNavHref('/admin/audit/e-9', '/admin/audit')).toBe(true)
  })

  it('ignores query strings and fragments on both sides', () => {
    expect(isActiveNavHref('/admin/payments?status=pending', '/admin/payments')).toBe(true)
    expect(isActiveNavHref('/admin#top', '/admin')).toBe(true)
  })

  it('does not treat sibling prefixes as active', () => {
    expect(isActiveNavHref('/admin/licenses-archive', '/admin/licenses')).toBe(false)
    expect(isActiveNavHref('/admin/machines', '/admin/licenses')).toBe(false)
  })

  it('wires the shared matcher into the shell', () => {
    expect(shell).toContain('isActiveNavHref')
  })
})

describe('Task 25 preserved auth + role gates', () => {
  it('keeps the server-side session and staff-role gate in the layout', () => {
    expect(layout).toContain('auth.api.getSession')
    expect(layout).toContain("const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep']")
    expect(layout).toContain('if (!STAFF_ROLES.includes(role))')
    expect(layout).toContain('/login?next=')
    expect(layout).toContain('x-omnix-url')
    expect(layout).toContain('403')
    expect(layout).toContain('staff-only')
  })

  it('preserves the platform-admin-only page gates (settings/secrets, media, team, module videos)', () => {
    for (const page of [
      'src/app/admin/settings/page.tsx',
      'src/app/admin/media/page.tsx',
      'src/app/admin/team-members/page.tsx',
      'src/app/admin/module-videos/page.tsx',
    ]) {
      const source = read(page)
      expect(source, `${page} lost its platform_admin gate`).toContain(
        "session.user.role !== 'platform_admin'",
      )
      expect(source, `${page} lost its redirect`).toContain("redirect('/admin')")
    }
  })

  it('defaults the overview to the least-privileged role and never broadens it', () => {
    expect(overview).toContain("?? 'sales_rep'")
    expect(overview).toContain("const canAudit = role === 'platform_admin' || role === 'support_agent'")
  })
})

describe('Task 25 noindex', () => {
  it('marks the operator console noindex at the layout', () => {
    expect(layout).toContain('robots')
    expect(layout).toContain('index: false')
    expect(layout).toContain('follow: false')
  })

  it('also disallows /admin in robots.ts (defence in depth)', () => {
    expect(read('src/app/robots.ts')).toContain("'/admin'")
  })
})

describe('Task 25 shell accessibility and responsiveness', () => {
  it('provides a skip link that targets the main landmark', () => {
    expect(shell).toContain('Skip to content')
    expect(shell).toContain('href="#admin-main"')
    expect(shell).toContain('id="admin-main"')
  })

  it('carries the Working Counter theme and a theme toggle', () => {
    expect(shell).toContain('data-theme="working-counter"')
    expect(shell).toContain('ThemeToggle')
    expect(shell).toContain('min-h-dvh')
  })

  it('marks the current page and labels the navigation landmark', () => {
    expect(shell).toContain("aria-current={active ? 'page' : undefined}")
    expect(shell).toContain('aria-label="Operator console"')
  })

  it('uses the accessible sheet primitive on mobile with an explicit trigger', () => {
    expect(shell).toContain('<Sheet')
    expect(shell).toContain('side="left"')
    expect(shell).toContain('aria-expanded={drawerOpen}')
    expect(shell).toContain('onClick={() => setDrawerOpen(true)}')
    expect(shell).not.toContain("document.body.style.overflow = 'hidden'")
  })

  it('keeps a persistent desktop rail at the lg breakpoint', () => {
    expect(shell).toContain('lg:flex')
    expect(shell).toContain('lg:hidden')
  })

  it('meets 44px touch targets, avoids transition-all, and has no hover-only nav', () => {
    expect(shell).toContain('min-h-11')
    expect(shell).toContain('size-11')
    expect(shell).not.toContain('transition-all')
    expect(shell).not.toContain('hidden group-hover')
    expect(shell).not.toContain('opacity-0 group-hover')
  })

  it('uses restrained transitions — no looping decorative motion', () => {
    expect(shell).not.toContain('repeat: Infinity')
    expect(shell).not.toContain("from 'motion/react'")
    expect(shell).not.toContain('SystemPulse')
  })
})

describe('Task 25 sign-out, impersonation, and context links', () => {
  it('offers the Better Auth sign-out', () => {
    expect(shell).toContain('/api/auth/sign-out?callbackURL=/login')
    expect(shell).toContain('Sign out')
  })

  it('keeps impersonation visible and provides the Better Auth stop action', () => {
    expect(layout).toContain('session.session as { impersonatedBy?: string | null }')
    expect(layout).toContain('isImpersonating={Boolean(impersonatedBy)}')
    expect(shell).toContain('Impersonation active')
    expect(shell).toContain('authClient.admin.stopImpersonating()')
    expect(shell).toContain('End impersonation')
  })

  it('offers safe return links and distinguishes platform ops from the customer/desktop surfaces', () => {
    expect(shell).toContain('href="/dashboard"')
    expect(shell).toContain('Customer dashboard')
    expect(shell).toContain('href="/"')
    expect(shell).toContain('Platform operations')
    expect(shell).toContain('installed desktop app')
    for (const bad of ['href="//', 'href="https://', 'href="javascript:']) {
      expect(shell, `${bad} should never appear in the shell`).not.toContain(bad)
    }
  })
})

describe('Task 25 operational overview: bounded queries, honest labels, no leakage', () => {
  it('leads with honest, record-backed framing', () => {
    expect(overview).toContain('Work that needs a person.')
    expect(overview).toContain('Counts come from current platform records')
  })

  it('shows record-backed work queues, not invented metrics or revenue', () => {
    expect(overview).toContain('Open tickets')
    expect(overview).toContain('Pending payments')
    expect(overview).toContain('Non-active licences')
    expect(overview).toContain('Silent machines')
    expect(overview).not.toContain('Lifetime revenue')
    expect(overview).not.toContain('pctDelta')
    expect(overview).not.toMatch(/sum\(/)
  })

  it('reads only bounded queries and never loads unbounded activity', () => {
    expect(overview).toContain('.limit(8)')
    // Every panel count is an aggregate, and activity is capped + audit-gated.
    expect(overview).toContain('count()')
    expect(overview).toContain('if (canAudit)')
  })

  it('degrades safely on a query failure without leaking a stack or secret', () => {
    expect(overview).toContain('Promise.allSettled')
    expect(overview).toContain('countsDegraded')
    expect(overview).toContain('activityDegraded')
    expect(overview).toContain('temporarily unavailable')
    // No raw error/stack surfaced to the page.
    expect(overview).not.toContain('error.stack')
    expect(overview).not.toContain('String(error)')
  })

  it('does not query, link, or hint the audit feed for sales staff', () => {
    expect(overview).toContain("const canAudit = role === 'platform_admin' || role === 'support_agent'")
    expect(overview).toContain('Audit events are limited to staff with audit capability')
    expect(hrefsFor('sales_rep')).not.toContain('/admin/audit')
  })

  it('scopes the capability map to the role and never touches secret settings', () => {
    expect(overview).toContain('adminNavigationForRole(role)')
    for (const secretSignal of ['getSetting', 'platform-settings', 'client_secret', 'apiKey', 'clientSecret']) {
      expect(overview, `${secretSignal} must not appear in the overview`).not.toContain(secretSignal)
      expect(shell, `${secretSignal} must not appear in the shell`).not.toContain(secretSignal)
    }
  })
})
