import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PAGE_ROUTE_GROUPS } from '@/config/route-inventory'

/**
 * Task 24 — customer dashboard operational pages.
 *
 * These are source-contract tests (the house pattern): they read each
 * dashboard page/component and assert the behaviour and design invariants
 * the redesign must preserve — auth gates, per-user/org/reseller ownership
 * scoping, searchable + paginated growing collections, protected download
 * and rebind semantics, five-product copy with no stale Pro/trial
 * acquisition, the team/support/profile/affiliate/reseller contracts,
 * procedural empty states, and the flat Working Counter primitive system.
 */

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const D = 'src/app/(dashboard)/dashboard'

/** Map an inventoried dashboard route to its page file. */
function pageFile(route: string): string {
  const rel = route === '/dashboard' ? '' : route.slice('/dashboard'.length)
  return `${D}${rel}/page.tsx`
}

const PAGES = {
  overview: `${D}/page.tsx`,
  licenses: `${D}/licenses/page.tsx`,
  licenseDetail: `${D}/licenses/[id]/page.tsx`,
  machines: `${D}/machines/page.tsx`,
  machineDetail: `${D}/machines/[id]/page.tsx`,
  payments: `${D}/payments/page.tsx`,
  paymentDetail: `${D}/payments/[id]/page.tsx`,
  billing: `${D}/billing/page.tsx`,
  profile: `${D}/profile/page.tsx`,
  team: `${D}/team/page.tsx`,
  support: `${D}/support/page.tsx`,
  supportNew: `${D}/support/new/page.tsx`,
  supportDetail: `${D}/support/[id]/page.tsx`,
  downloads: `${D}/downloads/page.tsx`,
  downloadsVariant: `${D}/downloads/[variant]/page.tsx`,
  affiliate: `${D}/affiliate/page.tsx`,
  affiliateClient: `${D}/affiliate/affiliate-client.tsx`,
  reseller: `${D}/reseller/page.tsx`,
  resellerNew: `${D}/reseller/new/page.tsx`,
  issueForm: `${D}/reseller/new/issue-license-form.tsx`,
} as const

const COMPONENTS = {
  listControls: 'src/components/dashboard/list-controls.tsx',
  detailField: 'src/components/dashboard/detail-field.tsx',
  statusUtils: 'src/components/dashboard/status-utils.tsx',
  invitations: 'src/components/dashboard/invitations-panel.tsx',
  newTicket: 'src/components/dashboard/new-ticket-form.tsx',
  releaseSeat: 'src/components/dashboard/release-seat-button.tsx',
  releaseTrial: 'src/components/dashboard/release-trial-button.tsx',
  deactivate: 'src/components/dashboard/deactivate-machine-button.tsx',
} as const

// ── Inventory ──────────────────────────────────────────────────────

describe('Task 24 dashboard page inventory', () => {
  it('keeps the dashboard route inventory unchanged (18 customer routes)', () => {
    expect(PAGE_ROUTE_GROUPS.dashboard).toHaveLength(18)
  })

  it('has a real page file for every inventoried dashboard route', () => {
    for (const route of PAGE_ROUTE_GROUPS.dashboard) {
      const file = pageFile(route)
      expect(existsSync(join(ROOT, file)), `missing page for ${route}`).toBe(true)
    }
  })

  it('redesigns every dashboard page onto a shared header primitive', () => {
    for (const route of PAGE_ROUTE_GROUPS.dashboard) {
      const src = read(pageFile(route))
      expect(/PageHeader|EntityHero/.test(src), `${route} lacks a shared header primitive`).toBe(true)
    }
  })

  it('never falls back to the deprecated inline PageHeading on a dashboard page', () => {
    for (const route of PAGE_ROUTE_GROUPS.dashboard) {
      expect(read(pageFile(route)), `${route} still uses PageHeading`).not.toContain(
        "from '@/components/dashboard/status-utils'\nimport { PageHeading",
      )
      expect(read(pageFile(route))).not.toContain('<PageHeading')
    }
  })
})

// ── Auth gate + ownership scoping (no IDOR, no existence leak) ──────

describe('Task 24 session gates and ownership scoping', () => {
  it('gates every dashboard page behind a Better Auth session', () => {
    for (const route of PAGE_ROUTE_GROUPS.dashboard) {
      const src = read(pageFile(route))
      expect(src, `${route} does not resolve a session`).toContain('auth.api.getSession')
      expect(src, `${route} does not redirect to /login`).toContain('/login')
    }
  })

  it('scopes every growing list read by the current user / org / reseller', () => {
    expect(read(PAGES.licenses)).toContain('eq(licenses.userId, session.user.id)')
    expect(read(PAGES.machines)).toContain('eq(machines.userId, session.user.id)')
    expect(read(PAGES.payments)).toContain('eq(payments.userId, session.user.id)')
    expect(read(PAGES.support)).toContain('eq(supportTickets.userId, session.user.id)')
    expect(read(PAGES.team)).toContain('eq(member.organizationId, primary.org.id)')
    expect(read(PAGES.reseller)).toContain('eq(licenses.resellerId, reseller.id)')
    expect(read(PAGES.affiliate)).toContain('eq(affiliateCredits.affiliateId, aff.id)')
  })

  it('matches detail records by id AND owner, then notFound() — no existence leak', () => {
    expect(read(PAGES.licenseDetail)).toContain('and(eq(licenses.id, id), eq(licenses.userId, session.user.id))')
    expect(read(PAGES.licenseDetail)).toContain('notFound()')
    expect(read(PAGES.machineDetail)).toContain('and(eq(machines.id, id), eq(machines.userId, session.user.id))')
    expect(read(PAGES.machineDetail)).toContain('notFound()')
    expect(read(PAGES.paymentDetail)).toContain('and(eq(payments.id, id), eq(payments.userId, session.user.id))')
    expect(read(PAGES.paymentDetail)).toContain('notFound()')
    expect(read(PAGES.supportDetail)).toContain(
      'and(eq(supportTickets.id, id), eq(supportTickets.userId, session.user.id))',
    )
    expect(read(PAGES.supportDetail)).toContain('notFound()')
  })

  it('scopes a payment’s linked licence to the same owner (no cross-account key leak)', () => {
    expect(read(PAGES.paymentDetail)).toContain('eq(licenses.userId, session.user.id)')
  })

  it('keeps reseller pages server-gated regardless of nav visibility', () => {
    const reseller = read(PAGES.reseller)
    expect(reseller).toContain('.from(resellers)')
    expect(reseller).toContain("redirect('/dashboard?notice=not_reseller')")

    const resellerNew = read(PAGES.resellerNew)
    expect(resellerNew).toContain("redirect('/dashboard')")
    expect(resellerNew).toContain("redirect('/dashboard/reseller?notice=suspended')")
    expect(resellerNew).toContain("reseller.status !== 'active'")
  })

  it('keeps team and affiliate behind the session gate with their intended redirects', () => {
    expect(read(PAGES.team)).toContain("redirect('/login')")
    expect(read(PAGES.affiliate)).toContain("redirect('/login?next=/dashboard/affiliate')")
  })
})

// ── Searchable + paginated growing collections ─────────────────────

describe('Task 24 growing collections are searchable and paginated', () => {
  const GROWING: Array<{ name: string; file: string; scope: string }> = [
    { name: 'licences', file: PAGES.licenses, scope: 'eq(licenses.userId' },
    { name: 'devices', file: PAGES.machines, scope: 'eq(machines.userId' },
    { name: 'payments', file: PAGES.payments, scope: 'eq(payments.userId' },
    { name: 'support tickets', file: PAGES.support, scope: 'eq(supportTickets.userId' },
    { name: 'team members', file: PAGES.team, scope: 'member.organizationId' },
    { name: 'reseller issued licences', file: PAGES.reseller, scope: 'licenses.resellerId' },
  ]

  it('renders a labelled search and a pagination strip for each', () => {
    for (const { name, file } of GROWING) {
      const src = read(file)
      expect(src, `${name} missing ListSearch`).toContain('ListSearch')
      expect(src, `${name} missing ListPagination`).toContain('ListPagination')
    }
  })

  it('pages on the server with bounded limit/offset + a total count', () => {
    for (const { name, file } of GROWING) {
      const src = read(file)
      expect(src, `${name} missing offset paging`).toContain('.offset(')
      expect(src, `${name} missing limit`).toContain('.limit(')
      expect(src, `${name} missing count()`).toContain('count()')
    }
  })

  it('resets to page one when a query changes and updates the URL server-side', () => {
    const controls = read(COMPONENTS.listControls)
    expect(controls).toContain('router.replace')
    expect(controls).toContain('next.delete(pageParam)')
  })

  it('gives the search control a real label — never a bare placeholder', () => {
    const controls = read(COMPONENTS.listControls)
    expect(controls).toContain('htmlFor={inputId}')
    expect(controls).toContain('type="search"')
    // pagination is a labelled navigation landmark with a live range
    expect(controls).toContain('aria-label={label}')
    expect(controls).toContain('aria-live="polite"')
    expect(controls).toContain('aria-label="Previous page"')
    expect(controls).toContain('aria-label="Next page"')
  })

  it('only uses a plain <select> for a small fixed enum (payment status)', () => {
    expect(read(PAGES.payments)).toContain('ListSelectFilter')
    expect(read(COMPONENTS.listControls)).toContain('export function ListSelectFilter')
  })

  it('routes list tables through the shared, horizontally-scrollable Table primitive', () => {
    for (const file of [PAGES.licenses, PAGES.machines, PAGES.payments, PAGES.support, PAGES.team, PAGES.reseller]) {
      expect(read(file)).toContain("from '@/components/ui/table'")
    }
    expect(read('src/components/ui/table.tsx')).toContain('overflow-x-auto')
  })
})

// ── Protected download + rebind semantics ──────────────────────────

describe('Task 24 protected download and device-rebind semantics', () => {
  it('session-gates the downloads pages before resolving any installer URL', () => {
    const downloads = read(PAGES.downloads)
    const gateAt = downloads.indexOf("redirect('/login?next=/dashboard/downloads')")
    const urlAt = downloads.indexOf('githubAssetUrl')
    expect(gateAt).toBeGreaterThan(-1)
    expect(urlAt).toBeGreaterThan(-1)
    expect(gateAt, 'installer URL resolved before the session gate').toBeLessThan(urlAt)
  })

  it('validates the variant param and 404s unknown products on the gated route', () => {
    const variant = read(PAGES.downloadsVariant)
    expect(variant).toContain('notFound()')
    expect(variant).toContain('auth.api.getSession')
    expect(variant).toContain('/login?next=/dashboard/downloads/')
  })

  it('confirms destructive seat release then calls the owner-scoped DELETE endpoint', () => {
    const seat = read(COMPONENTS.releaseSeat)
    expect(seat).toContain('confirm(')
    expect(seat).toContain("variant: 'destructive'")
    expect(seat).toContain('/api/dashboard/machines/')
    expect(seat).toContain("method: 'DELETE'")
  })

  it('confirms destructive trial release then calls the licence DELETE endpoint', () => {
    const trial = read(COMPONENTS.releaseTrial)
    expect(trial).toContain('confirm(')
    expect(trial).toContain("variant: 'destructive'")
    expect(trial).toContain('/api/dashboard/licenses/')
    expect(trial).toContain("method: 'DELETE'")
  })

  it('routes self-service rebind through the server-enforced rebind endpoint', () => {
    const deactivate = read(COMPONENTS.deactivate)
    expect(deactivate).toContain('confirm(')
    expect(deactivate).toContain('/api/licensing/rebind')
  })
})

// ── Five products, no public Pro/trial acquisition ─────────────────

describe('Task 24 five-product copy and no stale Pro/trial CTAs', () => {
  it('offers exactly the five trade products in the reseller issue form (no Pro)', () => {
    const form = read(PAGES.issueForm)
    for (const id of ['dawa', 'retail', 'hospitality', 'hardware', 'salon']) {
      expect(form, `issue form missing ${id}`).toContain(`id: '${id}'`)
    }
    expect(form).not.toContain("id: 'pro'")
    expect(form).toContain("type Variant = 'dawa' | 'retail' | 'hospitality' | 'hardware' | 'salon'")
  })

  it('shows the five trades to non-Pro owners on downloads, and hides Pro from non-owners', () => {
    const downloads = read(PAGES.downloads)
    expect(downloads).toContain("['dawa', 'retail', 'hospitality', 'hardware', 'salon']")
    expect(downloads).toContain('ownsPro')
    expect(downloads).toContain("(['pro'] as const)")
  })

  it('suppresses the Pro upgrade CTA on the overview and licence detail pages', () => {
    expect(read(PAGES.overview)).toContain("l.variant !== 'pro'")
    expect(read(PAGES.overview)).toContain('ownsProActive')
    expect(read(PAGES.licenseDetail)).toContain("l.variant !== 'pro'")
    expect(read(PAGES.machineDetail)).toContain("license.variant !== 'pro'")
  })

  it('never emits a hard-coded public /buy?variant=pro purchase link', () => {
    for (const route of PAGE_ROUTE_GROUPS.dashboard) {
      const src = read(pageFile(route))
      // Guarded, encoded trade purchases are fine; a literal pro buy CTA is not.
      expect(src, `${route} emits a pro buy link`).not.toMatch(/href=\{?["'`][^"'`]*\/buy\?variant=pro/)
    }
  })
})

// ── Payment / compliance semantics ─────────────────────────────────

describe('Task 24 payment and compliance semantics preserved', () => {
  it('keeps reference, status, amount and currency on the payments list + receipt', () => {
    const list = read(PAGES.payments)
    expect(list).toContain('payments.paystackReference')
    expect(list).toContain('StatusPill kind="payment"')
    expect(list).toContain('p.currency')
    const detail = read(PAGES.paymentDetail)
    expect(detail).toContain('paystackReference')
    expect(detail).toContain('Payment receipt')
  })

  it('keeps compliance renewals and add-on purchase routes on billing', () => {
    const billing = read(PAGES.billing)
    expect(billing).toContain('?type=maintenance')
    expect(billing).toContain('type=cloud_backup')
    expect(billing).toContain('type=extra_branch')
    expect(billing).toContain('type=extra_machine')
    expect(billing).toContain('pricingFor')
  })
})

// ── Team / support / profile / affiliate / reseller contracts ──────

describe('Task 24 team, support, profile, affiliate and reseller contracts', () => {
  it('preserves the Better Auth invitation lifecycle endpoints and destructive cancel', () => {
    const panel = read(COMPONENTS.invitations)
    expect(panel).toContain("'/api/dashboard/team/invitations'")
    expect(panel).toContain('/api/dashboard/team/invitations/${id}/resend')
    expect(panel).toContain('/api/dashboard/team/invitations/${id}')
    expect(panel).toContain("method: 'DELETE'")
    expect(panel).toContain('confirm(')
    expect(panel).toContain('canManage')
  })

  it('opens support tickets through the tickets API and keeps the thread read-only', () => {
    expect(read(COMPONENTS.newTicket)).toContain("'/api/support/tickets'")
    // The detail page renders replies but invents no reply route/operation.
    const detail = read(PAGES.supportDetail)
    expect(detail).not.toContain('fetch(')
    expect(detail).not.toContain('/reply')
  })

  it('keeps profile validation flowing through the customers API', () => {
    expect(read(PAGES.profile)).toContain('ProfileForm')
    expect(read('src/components/dashboard/profile-form.tsx')).toContain('/api/customers/me')
  })

  it('keeps affiliate sign-up, referral copy, and anti-fraud states', () => {
    const client = read(PAGES.affiliateClient)
    expect(client).toContain("'/api/affiliate'")
    expect(client).toContain('referralUrl')
    expect(client).toContain('navigator.clipboard.writeText')
    expect(client).toContain('StatusPill kind="commission"')
    expect(client).toContain('aff.blocked')
  })

  it('keeps reseller wholesale issue + commission ledger with Paystack handoff', () => {
    expect(read(PAGES.reseller)).toContain('resellerCommissions')
    expect(read(PAGES.reseller)).toContain('StatusPill kind="commission"')
    const form = read(PAGES.issueForm)
    expect(form).toContain("'/api/reseller/issue-license'")
    expect(form).toContain('authorizationUrl')
  })
})

// ── Procedural empty states ────────────────────────────────────────

describe('Task 24 empty states are procedural', () => {
  it('renders EmptyState with a real next action where one exists', () => {
    for (const file of [PAGES.licenses, PAGES.machines, PAGES.support]) {
      const src = read(file)
      expect(src).toContain('EmptyState')
      expect(src).toContain('action=')
    }
    expect(read(PAGES.affiliateClient)).toContain('EmptyState')
    expect(read(PAGES.reseller)).toContain('EmptyState')
  })

  it('the shared EmptyState only renders its action slot when given one', () => {
    const src = read(COMPONENTS.statusUtils)
    expect(src).toContain('action?: ReactNode')
    expect(src).toContain('{action ?')
  })
})

// ── Working Counter design system ──────────────────────────────────

describe('Task 24 flat Working Counter design system', () => {
  const REDESIGNED = [
    ...Object.values(PAGES),
    ...Object.values(COMPONENTS),
  ]

  it('uses token-backed status pills with text labels, never off-brand palette colour', () => {
    const status = read(COMPONENTS.statusUtils)
    expect(status).toContain('var(--color-positive)')
    expect(status).toContain('var(--color-caution)')
    expect(status).toContain('var(--color-negative)')
    expect(status).not.toContain('emerald')
    expect(status).not.toContain('rose-')
    // status kinds cover every dashboard surface incl. commission + reseller + open ticket
    for (const kind of ['license', 'payment', 'machine', 'ticket', 'commission', 'reseller']) {
      expect(status).toContain(`${kind}:`)
    }
    expect(status).toContain('open:')
  })

  it('bans off-brand tailwind palette + legacy shadcn tokens across redesigned files', () => {
    const OFFENDERS = /emerald-|rose-|\bblue-[0-9]|text-muted-foreground|bg-primary\b|border-input|bg-background\b/
    for (const file of REDESIGNED) {
      expect(OFFENDERS.test(read(file)), `${file} uses an off-brand/legacy token`).toBe(false)
    }
  })

  it('renders money and codes in the mono/tabular face', () => {
    expect(read(PAGES.payments)).toContain('font-mono tabular-nums')
    expect(read(PAGES.licenses)).toContain('font-mono')
    expect(read(COMPONENTS.detailField)).toContain('font-mono tabular-nums')
  })

  it('avoids transition-all in the redesigned interactive controls', () => {
    for (const file of [COMPONENTS.listControls, COMPONENTS.invitations, COMPONENTS.releaseSeat]) {
      expect(read(file)).not.toContain('transition-all')
    }
  })

  it('shares a single flat detail-field primitive across detail pages', () => {
    const detail = read(COMPONENTS.detailField)
    expect(detail).toContain('export function DetailField')
    expect(detail).toContain('export function DetailGrid')
    for (const file of [PAGES.licenseDetail, PAGES.machineDetail, PAGES.paymentDetail]) {
      expect(read(file)).toContain('DetailField')
    }
  })
})
