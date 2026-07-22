import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

import { adminNavigationForRole } from '@/components/admin/admin-navigation'
import { PAGE_ROUTE_GROUPS, API_ROUTE_GROUPS } from '@/config/route-inventory'
import { isPublishableMedia } from '@/lib/media-governance'

/**
 * Task 26 — redesign + hardening of every admin management route.
 *
 * These are source-contract + pure-function tests (the same style as
 * admin-shell.int.spec.ts / route-inventory.int.spec.ts): they read the real
 * source of every /admin page, section gate, and /api/admin handler and assert
 * the security + design invariants hold, without standing up a database. The
 * signed-out browser gate is covered by tests/e2e/admin-authorization.e2e.spec.ts.
 */

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const APP = 'src/app'
const ADMIN = `${APP}/admin`
const API = `${APP}/api/admin`

const hrefsFor = (role: string) =>
  adminNavigationForRole(role).flatMap((group) => group.items.map((item) => item.href))

// ───────────────────────────────────────────────────────────────────────────
// Route inventory: nothing added or dropped, every section accounted for.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 admin route inventory', () => {
  it('keeps the full admin page inventory (23 routes) unchanged', () => {
    expect(PAGE_ROUTE_GROUPS.admin).toHaveLength(23)
    for (const route of [
      '/admin',
      '/admin/users',
      '/admin/users/[id]',
      '/admin/orgs',
      '/admin/orgs/[id]',
      '/admin/licenses',
      '/admin/licenses/[id]',
      '/admin/machines',
      '/admin/machines/[id]',
      '/admin/payments',
      '/admin/payments/[id]',
      '/admin/releases',
      '/admin/tickets',
      '/admin/tickets/[id]',
      '/admin/media',
      '/admin/module-videos',
      '/admin/team-members',
      '/admin/audit',
      '/admin/audit/[id]',
      '/admin/team',
      '/admin/team/[id]',
      '/admin/settings',
      '/admin/customers/new',
    ]) {
      expect(PAGE_ROUTE_GROUPS.admin, `${route} missing from inventory`).toContain(route)
    }
  })

  it('classifies every /api/admin handler under the platformAdmin group', () => {
    for (const route of API_ROUTE_GROUPS.platformAdmin) {
      expect(route.startsWith('/api/admin/')).toBe(true)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Independent, server-side capability gates on every page tree.
// Section gates live in per-section layout.tsx files; the trust desks gate in
// the page itself. Both are enforced server-side, independent of the shell.
// ───────────────────────────────────────────────────────────────────────────
interface Section {
  dir: string
  desk: string
  href?: string
  roles: string[]
}

const SECTION_GATES: Section[] = [
  { dir: 'licenses', desk: 'licenses', href: '/admin/licenses', roles: ['platform_admin'] },
  { dir: 'machines', desk: 'machines', href: '/admin/machines', roles: ['platform_admin'] },
  { dir: 'releases', desk: 'releases', href: '/admin/releases', roles: ['platform_admin'] },
  { dir: 'payments', desk: 'payments', href: '/admin/payments', roles: ['platform_admin', 'sales_rep'] },
  { dir: 'tickets', desk: 'tickets', href: '/admin/tickets', roles: ['platform_admin', 'support_agent'] },
  { dir: 'audit', desk: 'audit', href: '/admin/audit', roles: ['platform_admin', 'support_agent'] },
  { dir: 'team', desk: 'staff', href: '/admin/team', roles: ['platform_admin'] },
  { dir: 'users', desk: 'customers', href: '/admin/users', roles: ['platform_admin', 'support_agent', 'sales_rep'] },
  { dir: 'orgs', desk: 'organizations', href: '/admin/orgs', roles: ['platform_admin', 'support_agent', 'sales_rep'] },
]

const STAFF = ['platform_admin', 'support_agent', 'sales_rep']

describe('Task 26 independent capability gates (section layouts)', () => {
  it('the shared guard exists and maps desks to the real capability model', () => {
    const guard = read('src/lib/permissions/admin-guard.ts')
    expect(guard).toContain("import 'server-only'")
    expect(guard).toContain('auth.api.getSession')
    expect(guard).toContain("redirect(`/login?next=")
    expect(guard).toContain("redirect('/admin')")
    // platform-admin-only desks
    for (const desk of ['licenses', 'machines', 'releases', 'staff', 'settings', 'trust', 'customerCreate']) {
      expect(guard, `${desk} must be platform_admin only`).toContain(`${desk}: ['platform_admin'],`)
    }
    // shared / scoped desks
    expect(guard).toContain("payments: ['platform_admin', 'sales_rep'],")
    expect(guard).toContain("tickets: ['platform_admin', 'support_agent'],")
    expect(guard).toContain("audit: ['platform_admin', 'support_agent'],")
    expect(guard).toContain("customers: ['platform_admin', 'support_agent', 'sales_rep'],")
    expect(guard).toContain("organizations: ['platform_admin', 'support_agent', 'sales_rep'],")
  })

  it('gates each growing section in a server-side layout, not the shell', () => {
    for (const section of SECTION_GATES) {
      const layout = read(`${ADMIN}/${section.dir}/layout.tsx`)
      expect(layout, `${section.dir} missing guard import`).toContain(
        "from '@/lib/permissions/admin-guard'",
      )
      expect(layout, `${section.dir} missing gate call`).toContain(
        `requireStaffAccess(DESK_ACCESS.${section.desk}`,
      )
    }
  })

  it('gates customer creation (provisioning) to platform_admin only', () => {
    const layout = read(`${ADMIN}/customers/layout.tsx`)
    expect(layout).toContain('requireStaffAccess(DESK_ACCESS.customerCreate')
  })

  it('keeps the trust desks (settings/media/team page/module videos) platform_admin-gated in-page', () => {
    for (const page of [
      'settings/page.tsx',
      'media/page.tsx',
      'team-members/page.tsx',
      'module-videos/page.tsx',
    ]) {
      const source = read(`${ADMIN}/${page}`)
      expect(source, `${page} lost its platform_admin gate`).toContain(
        "session.user.role !== 'platform_admin'",
      )
      expect(source, `${page} lost its redirect`).toContain("redirect('/admin')")
    }
  })

  it('never lets nav visibility exceed the enforced section gate', () => {
    for (const section of SECTION_GATES) {
      if (!section.href) continue
      for (const role of STAFF) {
        const visible = hrefsFor(role).includes(section.href)
        const allowed = section.roles.includes(role)
        // A link may never appear for a role the gate would reject.
        if (visible) expect(allowed, `${section.href} shown to ${role} but gate rejects`).toBe(true)
      }
    }
  })

  it('hides and rejects platform-admin-only desks from support and sales', () => {
    for (const href of ['/admin/licenses', '/admin/machines', '/admin/releases']) {
      expect(hrefsFor('support_agent')).not.toContain(href)
      expect(hrefsFor('sales_rep')).not.toContain(href)
    }
    // payments: sales + admin, never support
    expect(hrefsFor('support_agent')).not.toContain('/admin/payments')
    expect(hrefsFor('sales_rep')).toContain('/admin/payments')
    // tickets/audit: support + admin, never sales
    expect(hrefsFor('sales_rep')).not.toContain('/admin/tickets')
    expect(hrefsFor('sales_rep')).not.toContain('/admin/audit')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Every /api/admin handler independently enforces the real role + 401/403.
// ───────────────────────────────────────────────────────────────────────────
const PLATFORM_ADMIN_APIS = [
  'customers/route.ts',
  'users/[id]/reseller/route.ts',
  'licenses/[id]/route.ts',
  'licenses/[id]/mark-paid/route.ts',
  'licenses/[id]/sweep-orphans/route.ts',
  'machines/[id]/update-policy/route.ts',
  'settings/route.ts',
  'settings/generate/route.ts',
  'settings/import-env/route.ts',
  'settings/test/route.ts',
  'team/route.ts',
  'team/[id]/route.ts',
  'team/[id]/resend/route.ts',
  'team-members/route.ts',
  'media/route.ts',
  'module-videos/route.ts',
]

describe('Task 26 API authorization', () => {
  it('gates every mutating/read admin API on the real platform_admin role', () => {
    for (const rel of PLATFORM_ADMIN_APIS) {
      const source = read(`${API}/${rel}`)
      expect(source, `${rel} missing platform_admin check`).toContain("'platform_admin'")
      expect(source, `${rel} missing 403`).toContain('403')
      expect(source, `${rel} missing session read`).toContain('getSession')
    }
  })

  it('bootstraps promotions behind a bearer token, never a session role', () => {
    const promote = read(`${API}/promote/route.ts`)
    expect(promote).toContain('hasValidBootstrapToken')
    expect(promote).toContain('401')
    expect(promote).toContain('user.role_change')
  })

  it('lets CI sync releases via bootstrap token OR platform_admin, and no lower role', () => {
    const sync = read(`${API}/releases/sync-from-github/route.ts`)
    expect(sync).toContain('hasValidBootstrapToken')
    expect(sync).toContain("session.user.role !== 'platform_admin'")
    expect(sync).toContain('401')
    expect(sync).toContain('403')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Audit coverage on every mutating action.
// ───────────────────────────────────────────────────────────────────────────
const AUDITED: Record<string, string> = {
  'customers/route.ts': 'customer.admin_create',
  'users/[id]/reseller/route.ts': 'reseller.promote',
  'licenses/[id]/route.ts': 'license.delete',
  'licenses/[id]/mark-paid/route.ts': 'payment.manual_record',
  'licenses/[id]/sweep-orphans/route.ts': 'license.sweep_orphan_activations',
  'machines/[id]/update-policy/route.ts': 'machine.update_policy',
  'settings/route.ts': 'platform_setting.update',
  'settings/generate/route.ts': 'platform_setting.generate',
  'settings/import-env/route.ts': 'platform_setting.bulk_import_from_env',
  'team/route.ts': 'team.create',
  'team/[id]/route.ts': 'team.ban',
  'team/[id]/resend/route.ts': 'team.resend_invite',
  'releases/sync-from-github/route.ts': 'releases.sync_from_github',
  'module-videos/route.ts': 'module_demo_video.',
  'media/route.ts': 'media.approve',
  'team-members/route.ts': 'team_member.create',
}

describe('Task 26 audit coverage', () => {
  it('writes an audit_log row for every mutating admin action', () => {
    for (const [rel, action] of Object.entries(AUDITED)) {
      const source = read(`${API}/${rel}`)
      expect(source, `${rel} does not write auditLog`).toContain('auditLog')
      expect(source, `${rel} missing action ${action}`).toContain(action)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Server-side search + pagination on every growing collection.
// ───────────────────────────────────────────────────────────────────────────
const PAGINATED_LISTS = ['users', 'licenses', 'machines', 'payments', 'tickets', 'orgs', 'team', 'audit', 'releases']

describe('Task 26 search + pagination', () => {
  it('makes every growing list server-side searchable and paginated with bounded page size', () => {
    for (const list of PAGINATED_LISTS) {
      const source = read(`${ADMIN}/${list}/page.tsx`)
      expect(source, `${list} missing search`).toContain('AdminSearch')
      expect(source, `${list} missing pagination`).toContain('AdminPagination')
      expect(source, `${list} missing bounded page size`).toContain('const PAGE_SIZE = 50')
      expect(source, `${list} missing LIMIT`).toContain('.limit(PAGE_SIZE)')
      expect(source, `${list} missing OFFSET`).toContain('.offset(')
      // Stable total: every list computes count() rather than trusting rows.length.
      expect(source, `${list} missing stable count()`).toContain('count()')
    }
  })

  it('no longer renders an unbounded or hard-capped select on the formerly-capped feeds', () => {
    // audit was capped at 300, releases at 50 with no pager — both now paginate.
    const audit = read(`${ADMIN}/audit/page.tsx`)
    const releases = read(`${ADMIN}/releases/page.tsx`)
    expect(audit, 'audit still hard-caps at 300').not.toContain('.limit(300)')
    expect(audit).toContain('.limit(PAGE_SIZE)')
    expect(releases).toContain('.limit(PAGE_SIZE)')
    // team is no longer an unbounded select().from(user) with no limit.
    const team = read(`${ADMIN}/team/page.tsx`)
    expect(team).toContain('.limit(PAGE_SIZE)')
    expect(team).toContain('.offset(')
  })

  it('labels the search control (stable id + AT-visible label) and enlarges pager hit targets', () => {
    const controls = read('src/components/admin/data-controls.tsx')
    expect(controls).toContain('type="search"')
    // AdminSearch: a real, associated, visually-hidden label + stable id.
    expect(controls).toContain('<label')
    expect(controls).toContain('htmlFor={inputId}')
    expect(controls).toContain('sr-only')
    expect(controls).toContain('id={inputId}')
    expect(controls).toContain('aria-label={label}')
    // Pagination hit targets are at least 44px (no more 28px size-7 buttons).
    expect(controls, 'pager buttons must be >=44px').toContain('size-11')
    expect(controls, 'legacy 28px pager buttons must be gone').not.toContain('size-7')
  })

  it('procedurally routes an empty list to the next action', () => {
    // Users empty state routes staff to create a customer.
    const users = read(`${ADMIN}/users/page.tsx`)
    expect(users).toContain('EmptyState')
    expect(users).toContain('/admin/customers/new')
  })

  it('only offers customer provisioning to platform_admin on the users desk', () => {
    // /admin/customers/new is a platform_admin-only desk; the CTA must be
    // gated on the resolved server session role, not shown to support/sales.
    const users = read(`${ADMIN}/users/page.tsx`)
    expect(users).toContain('getSession')
    expect(users).toContain("=== 'platform_admin'")
    expect(users).toContain('canCreateCustomer')
    // Uses the shared Button (WC accent tokens), never the legacy bg-primary.
    expect(users, 'must not use legacy bg-primary').not.toContain('bg-primary')
    expect(users).toContain("from '@/components/ui/button'")
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Exhaustive: every growing collection on a DETAIL page is server-side
// searched + paginated (bounded LIMIT/OFFSET + stable COUNT), each with its
// own query-param namespace so co-located controls never clobber each other.
// ───────────────────────────────────────────────────────────────────────────
const DETAIL_COLLECTIONS: Record<string, string[]> = {
  'orgs/[id]': ['memberPage', 'invPage', 'licPage', 'machPage', 'payPage'],
  'licenses/[id]': ['machPage', 'payPage'],
  'users/[id]': ['licPage', 'machPage', 'payPage', 'ticketPage', 'auditPage', 'memPage'],
  'machines/[id]': ['telePage', 'backupPage'],
  'team/[id]': ['ticketPage', 'actionPage'],
  'tickets/[id]': ['msgPage'],
}

describe('Task 26 exhaustive detail-collection search + pagination', () => {
  it('server-side searches + paginates every growing list on every detail page', () => {
    for (const [detail, namespaces] of Object.entries(DETAIL_COLLECTIONS)) {
      const source = read(`${ADMIN}/${detail}/page.tsx`)
      expect(source, `${detail} missing AdminSearch`).toContain('AdminSearch')
      expect(source, `${detail} missing AdminPagination`).toContain('AdminPagination')
      expect(source, `${detail} missing bounded LIMIT`).toContain('.limit(PAGE_SIZE)')
      expect(source, `${detail} missing OFFSET`).toContain('.offset(')
      expect(source, `${detail} missing stable count()`).toContain('count()')
      // Never load hundreds to filter in the browser.
      expect(source, `${detail} loads an unbounded feed`).not.toContain('.limit(500)')
      for (const ns of namespaces) {
        const q = ns.replace(/Page$/, 'Q')
        expect(source, `${detail} missing ${ns} page namespace`).toContain(`pageParamName="${ns}"`)
        expect(source, `${detail} missing ${q} search namespace`).toContain(`paramName="${q}"`)
      }
    }
  })

  it('paginates the ticket conversation chronologically and states the visible range', () => {
    const source = read(`${ADMIN}/tickets/[id]/page.tsx`)
    // Oldest-first order is preserved; older messages move to earlier pages,
    // never silently hidden — the visible range is always printed.
    expect(source).toContain('asc(supportMessages.createdAt)')
    expect(source).toContain('Showing messages')
    expect(source).toContain('chronological order')
    expect(source).toContain('pageParamName="msgPage"')
    expect(source).toContain('.limit(PAGE_SIZE)')
    expect(source).toContain('.offset(')
    expect(source).toContain('count()')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Trust pages (media rights register + public team page) also paginate their
// growing collections server-side while keeping their mutation UI working on
// only the current page. Fixed slot bindings stay complete.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 trust-page collection search + pagination', () => {
  it('paginates + searches the media rights register server-side (no whole-table load)', () => {
    const page = read(`${ADMIN}/media/page.tsx`)
    expect(page).toContain('const PAGE_SIZE = 12')
    expect(page).toContain('.limit(PAGE_SIZE)')
    expect(page).toContain('.offset(')
    expect(page).toContain('count()')
    expect(page, 'media page still loads 500 rows to filter client-side').not.toContain('.limit(500)')
    // Fixed slot-coverage grid resolves through the canonical publication gate.
    expect(page).toContain('getSlotMedia')
    const client = read('src/components/admin/media-library.tsx')
    expect(client).toContain('AdminSearch')
    expect(client).toContain('AdminPagination')
    expect(client, 'media library still slices/paginates in the browser').not.toContain('.slice((page - 1)')
  })

  it('paginates + searches the team roster AND the approved-photo picker with distinct namespaces', () => {
    const page = read(`${ADMIN}/team-members/page.tsx`)
    expect(page).toContain('listApprovedMediaPhotos')
    expect(page).toContain('.limit(MEMBER_PAGE_SIZE)')
    expect(page).toContain('.offset(')
    expect(page).toContain('count()')
    expect(page, 'team page still loads 500 media candidates').not.toContain('.limit(500)')
    const client = read(`${ADMIN}/team-members/team-members-client.tsx`)
    expect(client).toContain('AdminSearch')
    expect(client).toContain('AdminPagination')
    for (const ns of ['memberPage', 'memberQ', 'mediaPage', 'mediaQ']) {
      expect(client, `team page client missing ${ns} namespace`).toContain(ns)
    }
  })

  it('bounds the approved-media resolver with LIMIT/OFFSET + COUNT behind the same publication gate', () => {
    const lib = read('src/lib/media-slots.ts')
    expect(lib).toContain('export async function listApprovedMediaPhotos')
    expect(lib).toContain('.limit(limit)')
    expect(lib).toContain('.offset(offset)')
    expect(lib).toContain('count()')
    // Trust gate preserved: only approved + audited (media.approve) media.
    expect(lib).toContain("eq(auditLog.action, 'media.approve')")
    expect(lib).toContain("eq(user.role, 'platform_admin')")
  })
})

// ───────────────────────────────────────────────────────────────────────────
// The ONLY collections exempt from pagination are documented fixed
// enumerations. Nothing growing may hide behind these.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 documented pagination exemptions', () => {
  it('exempts module demo videos — exactly one per fixed product catalogue', () => {
    const videos = read(`${ADMIN}/module-videos/page.tsx`)
    expect(videos).toContain('MODULE_DEMO_PRODUCTS.map')
    // Never an unbounded DB feed rendered as a browsable list.
    expect(videos).not.toContain('.limit(500)')
  })

  it('exempts platform settings — a fixed enumeration of setting definitions', () => {
    const settings = read(`${ADMIN}/settings/page.tsx`)
    expect(settings).toContain('listSettings()')
  })

  it('exempts the overview recent-activity as a bounded preview that links to the full audit desk', () => {
    const overview = read(`${ADMIN}/page.tsx`)
    // Bounded preview (fixed window) with an explicit route to the paginated desk.
    expect(overview).toContain('.limit(8)')
    expect(overview).toContain('/admin/audit')
  })

  it('keeps media slot bindings a complete fixed enumeration (not paginated)', () => {
    const page = read(`${ADMIN}/media/page.tsx`)
    // The closed set of slots is mapped in full; only the register paginates.
    expect(page).toContain('MEDIA_SLOTS.map')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Detail routes: scoped reads that 404 without leaking existence.
// ───────────────────────────────────────────────────────────────────────────
const DETAILS = [
  'licenses/[id]',
  'machines/[id]',
  'users/[id]',
  'payments/[id]',
  'tickets/[id]',
  'audit/[id]',
  'team/[id]',
  'orgs/[id]',
]

describe('Task 26 detail no-leak + entity design', () => {
  it('returns a safe 404 for a missing resource on every detail route', () => {
    for (const detail of DETAILS) {
      const source = read(`${ADMIN}/${detail}/page.tsx`)
      expect(source, `${detail} does not 404 on missing row`).toContain('notFound()')
      expect(source, `${detail} not on the shared EntityHero`).toContain('EntityHero')
    }
  })

  it('migrates detail routes to the light-first Working Counter tokens', () => {
    for (const detail of DETAILS) {
      const source = read(`${ADMIN}/${detail}/page.tsx`)
      expect(source, `${detail} still uses legacy neutral token`).not.toContain('text-muted-foreground')
      expect(source, `${detail} still uses legacy border token`).not.toMatch(/border-foreground\//)
      expect(source, `${detail} missing Working Counter tokens`).toContain('var(--color-fg-muted)')
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Destructive / high-risk: confirmation + soft-delete of financial records.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 destructive actions', () => {
  it('requires an explicit destructive confirmation before deleting a licence', () => {
    const button = read('src/components/admin/delete-license-button.tsx')
    expect(button).toContain('confirm(')
    expect(button).toContain("variant: 'destructive'")
    expect(button).toContain('Cannot be undone')
  })

  it('never hard-deletes a licence that carries settled financial history', () => {
    const route = read(`${API}/licenses/[id]/route.ts`)
    expect(route).toContain('has_settled_payments')
    expect(route).toContain("eq(payments.status, 'success')")
    expect(route).toContain('Revoke it instead')
    expect(route).toContain('409')
    expect(route).toContain('license.delete')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Payments: Paystack authority, server-authoritative manual path, no double path.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 payment + licence transactional safety', () => {
  it('preserves Paystack HMAC authority + server-authoritative settlement in the webhook', () => {
    const webhook = read(`${APP}/api/paystack/webhook/route.ts`)
    expect(webhook).toContain("createHmac('sha512'")
    expect(webhook).toContain('x-paystack-signature')
    expect(webhook).toContain('withDbTransaction')
    expect(webhook).toContain("for('update')")
    expect(webhook).toContain('amountsMatch')
    expect(webhook).toContain('verify(reference)')
    expect(webhook).toContain('payment.success')
    // Never trusts the client-reported amount/status: it re-verifies.
    expect(webhook).toContain('amount mismatch')
  })

  it('hardens the manual mark-paid path: admin-only, transactional, server-authoritative, dedupe-safe', () => {
    const markPaid = read(`${API}/licenses/[id]/mark-paid/route.ts`)
    // Admin-only + audited + reference-tagged (unchanged contract).
    expect(markPaid).toContain("session.user.role !== 'platform_admin'")
    expect(markPaid).toContain('payment.manual_record')
    expect(markPaid).toContain('manual:')

    // Server-authoritative amount from the pricing config; a client amount is
    // only ever cross-checked, never trusted.
    expect(markPaid).toContain("from '@/config/pricing'")
    expect(markPaid).toContain('authoritativeAmount')
    expect(markPaid).toContain('does not match the authoritative price')

    // Strict allowlists for purpose + currency.
    expect(markPaid).toContain('PURPOSES')
    expect(markPaid).toContain('SUPPORTED_CURRENCIES')

    // Atomic settlement: one transaction, licence locked FOR UPDATE.
    expect(markPaid).toContain('withDbTransaction')
    expect(markPaid).toContain("for('update')")

    // Correct schema tier semantics — active + starter, matching the webhook.
    // The legacy invalid tier='paid' must be gone.
    expect(markPaid).toContain("status: 'active'")
    expect(markPaid).toContain("tier: 'starter'")
    expect(markPaid).not.toContain("tier: 'paid'")
    expect(markPaid).not.toContain("tier = 'paid'")

    // Deterministic reference → a repeat of the same external code is a 409.
    expect(markPaid).toContain('isUniqueViolation')
    expect(markPaid).toContain('409')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Settings / secrets: platform_admin only, masked, encrypted, audited-without-value.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 settings + secret handling', () => {
  it('encrypts sensitive settings and only ever surfaces a last-four mask', () => {
    const settings = read('src/lib/platform-settings.ts')
    expect(settings).toContain('aes-256-gcm')
    expect(settings).toContain('function maskValue')
    expect(settings).toContain('plain.slice(0, 4)')
    expect(settings).toContain('plain.slice(-4)')
    expect(settings).toContain('def.sensitive ? maskValue(')
  })

  it('audits a setting change by key only — never the secret value', () => {
    const route = read(`${API}/settings/route.ts`)
    expect(route).toContain('listSettings()')
    expect(route).toContain('metadata: { key: body.key, sensitive: def.sensitive }')
    expect(route).not.toContain('metadata: { key: body.key, value')
  })

  it('never pre-fills or echoes a secret value into the client editor', () => {
    const client = read(`${ADMIN}/settings/settings-client.tsx`)
    expect(client).toContain('value={draft}')
    expect(client).toContain("setDraft('')")
    expect(client).toContain("type={s.sensitive && !reveal ? 'password'")
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Trust: media / module videos / team members lifecycle invariants (Task 8/34).
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 trust invariants preserved', () => {
  it('keeps the media approval + quarantine→publish provenance lifecycle', () => {
    const media = read(`${API}/media/route.ts`)
    expect(media).toContain('validateMediaProvenance')
    expect(media).toContain('uploadMediaToQuarantine')
    expect(media).toContain('promoteQuarantinedMedia')
    expect(media).toContain("objectState: 'published'")
    expect(media).toContain('media.approve')
  })

  it('stores only a normalised YouTube ID (never raw URL/embed) and audits publish', () => {
    const videos = read(`${API}/module-videos/route.ts`)
    expect(videos).toContain('parseYouTubeUrl')
    expect(videos).toContain('videoId')
    expect(videos).toContain('module_demo_video.')
    expect(videos).not.toContain('dangerouslySetInnerHTML')
    // Public page loads privacy-preserving nocookie only after publish.
    expect(read(`${ADMIN}/module-videos/page.tsx`)).toContain('youtube-nocookie')
  })

  it('binds team-member photos to approved media IDs only and rejects raw URLs', () => {
    const team = read(`${API}/team-members/route.ts`)
    expect(team).toContain('getApprovedTeamMemberPhoto')
    expect(team).toContain('Raw photo URLs are not accepted')
    expect(team).toContain('team_member.create')
  })

  it('only publishes media that is approved, audited, published, and https (pure)', () => {
    const base = {
      approvalState: 'approved',
      approvedBy: 'staff-1',
      approvalAuditId: 'audit-1',
      approvedAt: new Date(),
      objectState: 'published',
      key: 'media/x.png',
      url: 'https://media.omnix.co.ke/x.png',
      mimeType: 'image/png',
      alt: 'A shop counter in Nairobi',
      rightsBasis: 'owned',
      rightsHolder: 'Omnix',
      rightsSource: 'internal shoot 2025',
    }
    expect(isPublishableMedia(base)).toBe(true)
    expect(isPublishableMedia({ ...base, approvalState: 'pending' })).toBe(false)
    expect(isPublishableMedia({ ...base, objectState: 'quarantine' })).toBe(false)
    expect(isPublishableMedia({ ...base, url: 'http://media.omnix.co.ke/x.png' })).toBe(false)
    expect(isPublishableMedia({ ...base, approvedBy: null })).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// No stale public trial / Pro acquisition CTAs anywhere in the operator console.
// ───────────────────────────────────────────────────────────────────────────
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}${sep}${entry.name}`
    return entry.isDirectory() ? walk(rel) : [rel]
  })
}

describe('Task 26 no public acquisition CTA in the operator console', () => {
  it('carries no marketing trial/Pro purchase CTAs on any admin page', () => {
    const pages = walk(ADMIN).filter((f) => f.endsWith('.tsx'))
    expect(pages.length).toBeGreaterThan(0)
    for (const page of pages) {
      const source = read(page)
      for (const cta of ['Start free trial', 'Buy now', 'Get started free', '/buy?type=', 'href="/pricing"']) {
        expect(source, `${page} contains a public CTA: ${cta}`).not.toContain(cta)
      }
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Shared design primitives across the console.
// ───────────────────────────────────────────────────────────────────────────
describe('Task 26 shared design primitives', () => {
  it('uses the shared PageHeader on list/index pages', () => {
    for (const page of ['users', 'licenses', 'machines', 'payments', 'tickets', 'orgs', 'releases', 'audit', 'settings']) {
      expect(read(`${ADMIN}/${page}/page.tsx`), `${page} not on PageHeader`).toContain('PageHeader')
    }
    expect(read(`${ADMIN}/customers/new/page.tsx`)).toContain('PageHeader')
  })
})
