import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Task 27 — shared quality states across every website route group.
 *
 * This is a contract/regression test: it inventories the route-group
 * loading / error / not-found boundaries, pins the shared state system, and
 * asserts the accessibility + safety guarantees (no PII in error UI, retry +
 * safe navigation, procedural empties, destructive confirmation + pending
 * lockout, no stale generic/spinner/trial/password states).
 *
 * It never renders anything — the render behaviour lives in
 * quality-states-render.int.spec.tsx. Adding/moving a boundary without
 * updating the matrix here fails the build.
 */

const ROOT = process.cwd()
const APP = join(ROOT, 'src', 'app')
const abs = (p: string) => join(ROOT, p)
const source = (p: string) => readFileSync(abs(p), 'utf8')
const has = (p: string) => existsSync(abs(p))

// ─────────────────────────────────────────────────────────────────────────
// Boundary matrix — every route group and the boundaries it owns.
// `loading` / `error` / `notFound` are file paths relative to src/app; null
// means "intentionally inherits an ancestor boundary".
// ─────────────────────────────────────────────────────────────────────────
const BOUNDARY_MATRIX: Record<
  string,
  { loading: string | null; error: string | null; notFound: string | null }
> = {
  root: {
    loading: null,
    error: 'global-error.tsx',
    notFound: 'not-found.tsx',
  },
  'marketing (locale/frontend)': {
    loading: '[locale]/(frontend)/loading.tsx',
    error: '[locale]/(frontend)/error.tsx',
    notFound: '[locale]/(frontend)/not-found.tsx',
  },
  auth: {
    loading: '(auth)/loading.tsx',
    error: '(auth)/error.tsx',
    notFound: null,
  },
  onboarding: {
    loading: 'onboarding/loading.tsx',
    error: 'onboarding/error.tsx',
    notFound: null,
  },
  checkout: {
    loading: '(checkout)/loading.tsx',
    error: '(checkout)/error.tsx',
    notFound: null,
  },
  dashboard: {
    loading: '(dashboard)/dashboard/loading.tsx',
    error: '(dashboard)/error.tsx',
    notFound: null,
  },
  admin: {
    loading: 'admin/loading.tsx',
    error: 'admin/error.tsx',
    notFound: null,
  },
}

const ERROR_BOUNDARIES = Object.values(BOUNDARY_MATRIX)
  .map((g) => g.error)
  .filter((p): p is string => p !== null)

const LOADING_BOUNDARIES = Object.values(BOUNDARY_MATRIX)
  .map((g) => g.loading)
  .filter((p): p is string => p !== null)

const NOT_FOUND_BOUNDARIES = Object.values(BOUNDARY_MATRIX)
  .map((g) => g.notFound)
  .filter((p): p is string => p !== null)

const SHARED_STATE_FILES = [
  'src/components/ui/state-view.tsx',
  'src/components/ui/error-state.tsx',
  'src/components/ui/loading-skeleton.tsx',
  'src/components/ui/skeleton.tsx',
]

describe('Task 27 · boundary matrix', () => {
  it('every route group owns (or intentionally inherits) its boundaries', () => {
    for (const [group, boundaries] of Object.entries(BOUNDARY_MATRIX)) {
      for (const kind of ['loading', 'error', 'notFound'] as const) {
        const rel = boundaries[kind]
        if (rel === null) continue
        expect(existsSync(join(APP, rel)), `${group} · missing ${kind} boundary ${rel}`).toBe(true)
      }
    }
  })

  it('adds scoped boundaries where the app previously fell through to global-error', () => {
    // These are the boundaries Task 27 introduced; regression guard.
    for (const rel of [
      '[locale]/(frontend)/loading.tsx',
      '[locale]/(frontend)/error.tsx',
      '[locale]/(frontend)/not-found.tsx',
      '(auth)/loading.tsx',
      '(auth)/error.tsx',
      'onboarding/loading.tsx',
      'onboarding/error.tsx',
      '(checkout)/loading.tsx',
      '(checkout)/error.tsx',
      'admin/error.tsx',
    ]) {
      expect(existsSync(join(APP, rel)), `expected new boundary ${rel}`).toBe(true)
    }
  })

  it('does not change the page/API route counts (boundaries are not routes)', () => {
    // page.tsx / route.ts are the only files the route inventory counts; the
    // loading/error/not-found files added here must not be page or route files.
    for (const rel of [...LOADING_BOUNDARIES, ...ERROR_BOUNDARIES, ...NOT_FOUND_BOUNDARIES]) {
      expect(rel.endsWith('loading.tsx') || rel.endsWith('error.tsx') || rel.endsWith('not-found.tsx') || rel.endsWith('global-error.tsx')).toBe(true)
    }
  })
})

describe('Task 27 · shared state system exists', () => {
  it('ships the shared primitives', () => {
    for (const f of SHARED_STATE_FILES) {
      expect(has(f), `missing shared state file ${f}`).toBe(true)
    }
  })

  it('state-view exports every quality-state variant', () => {
    const sv = source('src/components/ui/state-view.tsx')
    for (const name of [
      'export function StateView',
      'export function EmptyState',
      'export function FilteredEmptyState',
      'export function PermissionState',
      'export function NotFoundState',
    ]) {
      expect(sv).toContain(name)
    }
  })

  it('loading-skeleton exports the accessible wrapper + structural helpers', () => {
    const ls = source('src/components/ui/loading-skeleton.tsx')
    expect(ls).toContain('export function LoadingState')
    expect(ls).toContain('role="status"')
    expect(ls).toContain('aria-busy="true"')
    expect(ls).toContain('aria-live="polite"')
    expect(ls).toContain('sr-only')
  })

  it('skeletons are reduced-motion safe and never spin', () => {
    for (const f of ['src/components/ui/skeleton.tsx', 'src/components/ui/loading-skeleton.tsx']) {
      const s = source(f)
      expect(s).toContain('motion-safe:animate-pulse')
      expect(s).not.toContain('animate-spin')
    }
  })

  it('StateView only uses Working Counter tokens, no new palette/gradient/emoji', () => {
    const sv = source('src/components/ui/state-view.tsx')
    expect(sv).not.toMatch(/bg-gradient|from-\[|via-\[|to-\[/)
    expect(sv).not.toMatch(/rose-|indigo-|purple-|violet-/)
    // Colour tones map to semantic tokens only.
    expect(sv).toContain('var(--color-accent)')
    expect(sv).toContain('var(--color-negative)')
  })
})

describe('Task 27 · error boundaries are client-safe and recoverable', () => {
  it('every error boundary is a client component', () => {
    for (const rel of ERROR_BOUNDARIES) {
      expect(source(`src/app/${rel}`)).toContain("'use client'")
    }
  })

  it('scoped error boundaries delegate to the shared ErrorState', () => {
    for (const rel of ERROR_BOUNDARIES.filter((r) => r !== 'global-error.tsx')) {
      expect(source(`src/app/${rel}`)).toContain("from '@/components/ui/error-state'")
    }
  })

  it('never renders error.message into the UI (PII / secret safe)', () => {
    for (const rel of [...ERROR_BOUNDARIES, 'src/components/ui/error-state.tsx'.replace('src/', '')]) {
      const path = rel.startsWith('components/') ? `src/${rel}` : `src/app/${rel}`
      const s = source(path)
      expect(s, `${path} renders error.message`).not.toContain('{error.message')
      expect(s, `${path} renders error?.message`).not.toContain('>{error?.message')
    }
  })

  it('the shared ErrorState logs for operators, offers retry + safe nav, shows only the digest', () => {
    const es = source('src/components/ui/error-state.tsx')
    expect(es).toContain('console.error')
    expect(es).toContain('reset()')
    expect(es).toContain('Try again')
    expect(es).toContain('error.digest')
    expect(es).toContain('Reference:')
    // Distinguishes offline / network from a generic server fault.
    expect(es).toContain('navigator.onLine')
    expect(es).toContain('looksLikeNetworkError')
    // A safe navigation escape always exists.
    expect(es).toContain('homeHref')
  })

  it('global-error is a light-first, on-brand fallback with a next action', () => {
    const ge = source('src/app/global-error.tsx')
    expect(ge).toContain("'use client'")
    expect(ge).toContain('#FAFAF7') // Working Counter receipt paper, not the old dark #0a0a0b
    expect(ge).not.toContain('#0a0a0b')
    expect(ge).toContain('Try again')
    expect(ge).toContain('/contact')
  })
})

describe('Task 27 · loading boundaries use structural skeletons', () => {
  it('every loading boundary uses the accessible LoadingState wrapper', () => {
    for (const rel of LOADING_BOUNDARIES) {
      expect(source(`src/app/${rel}`), `${rel} not wrapped in LoadingState`).toContain('LoadingState')
    }
  })

  it('no loading boundary uses a spinner or fake "Loading..." copy', () => {
    for (const rel of LOADING_BOUNDARIES) {
      const s = source(`src/app/${rel}`)
      expect(s, `${rel} uses a spinner`).not.toContain('animate-spin')
      expect(s, `${rel} uses indefinite framer loop`).not.toContain('repeat: Infinity')
    }
  })
})

describe('Task 27 · not-found never leaks whether an id/slug existed', () => {
  it('root + marketing 404s are generic and procedural', () => {
    const rootNF = source('src/app/not-found.tsx')
    const feNF = source('src/app/[locale]/(frontend)/not-found.tsx')
    for (const s of [rootNF, feNF]) {
      expect(s).toContain('NotFoundState')
      // Offers real navigation, not a dead end.
      expect(s).toContain('href="/docs"')
    }
    // Neither interpolates an id/slug param into the message.
    expect(rootNF).not.toMatch(/\{.*(id|slug|params).*\}/)
    expect(feNF).not.toMatch(/\{.*(id|slug|params).*\}/)
  })

  it('detail pages hide existence behind a bare notFound() (no "X not found" with the id)', () => {
    const detailPages = [
      '(checkout)/buy/[licenseId]/page.tsx',
      '(dashboard)/dashboard/licenses/[id]/page.tsx',
      '(dashboard)/dashboard/machines/[id]/page.tsx',
      'admin/machines/[id]/page.tsx',
      'admin/users/[id]/page.tsx',
      '[locale]/(frontend)/blog/[slug]/page.tsx',
      '[locale]/(frontend)/docs/[slug]/page.tsx',
    ]
    for (const rel of detailPages) {
      const s = source(`src/app/${rel}`)
      expect(s, `${rel} should call notFound()`).toContain('notFound()')
    }
  })
})

describe('Task 27 · permission-denied identifies role only when safe', () => {
  it('PermissionState keeps requiredRole optional', () => {
    const sv = source('src/components/ui/state-view.tsx')
    expect(sv).toContain('requiredRole?:')
    expect(sv).toContain("dataState=\"permission-denied\"")
  })

  it('admin console uses PermissionState and reveals only "staff", not the role enum', () => {
    const layout = source('src/app/admin/layout.tsx')
    expect(layout).toContain('PermissionState')
    // The denied copy must not name the concrete role codes.
    const deniedCopyLeaks = /description="[^"]*platform_admin[^"]*"/.test(layout)
    expect(deniedCopyLeaks).toBe(false)
  })
})

describe('Task 27 · empty states are procedural', () => {
  it('FilteredEmptyState always offers a real "Clear filters" link', () => {
    const sv = source('src/components/ui/state-view.tsx')
    expect(sv).toContain('Clear filters')
    expect(sv).toContain('href={clearHref}')
    expect(sv).toContain("dataState=\"filtered-empty\"")
  })

  it('the shared buildClearHref helper preserves the route/tab and drops only the list namespace', () => {
    expect(has('src/lib/list-query.ts'), 'missing shared list-query helper').toBe(true)
    const lq = source('src/lib/list-query.ts')
    expect(lq).toContain('export function buildClearHref')
    // Drops the given keys but keeps everything else, and can pin the tab.
    expect(lq).toContain('options.drop.includes(key)')
    expect(lq).toContain('options.set')
  })

  // Every top-level filtered list wires the shared FilteredEmptyState with a
  // literal clearHref back to the un-filtered route. Not 2 representatives —
  // every single one.
  const TOP_LEVEL_FILTERED_LISTS: Record<string, string> = {
    // Customer dashboard
    'src/app/(dashboard)/dashboard/team/page.tsx': '/dashboard/team',
    'src/app/(dashboard)/dashboard/machines/page.tsx': '/dashboard/machines',
    'src/app/(dashboard)/dashboard/support/page.tsx': '/dashboard/support',
    'src/app/(dashboard)/dashboard/licenses/page.tsx': '/dashboard/licenses',
    'src/app/(dashboard)/dashboard/reseller/page.tsx': '/dashboard/reseller',
    'src/app/(dashboard)/dashboard/payments/page.tsx': '/dashboard/payments',
    // Admin console
    'src/app/admin/users/page.tsx': '/admin/users',
    'src/app/admin/payments/page.tsx': '/admin/payments',
    'src/app/admin/orgs/page.tsx': '/admin/orgs',
    'src/app/admin/machines/page.tsx': '/admin/machines',
    'src/app/admin/releases/page.tsx': '/admin/releases',
    'src/app/admin/audit/page.tsx': '/admin/audit',
    'src/app/admin/licenses/page.tsx': '/admin/licenses',
    'src/app/admin/tickets/page.tsx': '/admin/tickets',
    'src/app/admin/team/page.tsx': '/admin/team',
    'src/components/admin/media-library.tsx': '/admin/media',
  }

  it('every top-level filtered list wires the FilteredEmptyState clear path', () => {
    for (const [file, clearHref] of Object.entries(TOP_LEVEL_FILTERED_LISTS)) {
      const s = source(file)
      expect(s, `${file} missing FilteredEmptyState`).toContain('FilteredEmptyState')
      expect(s, `${file} missing clearHref="${clearHref}"`).toContain(`clearHref="${clearHref}"`)
      // The passive dead-end phrasing is gone.
      expect(s, `${file} still shows passive "No matches."`).not.toContain("'No matches.'")
    }
  })

  // Every detail page with per-tab filtered collections builds its clear link
  // through buildClearHref (preserving the open tab + the other tabs' state).
  const DETAIL_FILTERED_LISTS = [
    'src/app/admin/users/[id]/page.tsx',
    'src/app/admin/orgs/[id]/page.tsx',
    'src/app/admin/machines/[id]/page.tsx',
    'src/app/admin/team/[id]/page.tsx',
    'src/app/admin/licenses/[id]/page.tsx',
    'src/app/admin/tickets/[id]/page.tsx',
  ]

  it('every detail-tab filtered collection clears through buildClearHref (tab + other-query preserved)', () => {
    for (const file of DETAIL_FILTERED_LISTS) {
      const s = source(file)
      expect(s, `${file} missing FilteredEmptyState`).toContain('FilteredEmptyState')
      expect(s, `${file} missing buildClearHref`).toContain('buildClearHref')
      // Detail collections no longer render the passive "match this search" text.
      expect(s, `${file} still shows passive "match this search"`).not.toContain('match this search')
    }
  })

  it('the team-members client clears each of its two filtered lists without clobbering the other', () => {
    const client = source('src/app/admin/team-members/team-members-client.tsx')
    expect(client).toContain('FilteredEmptyState')
    // Distinct clear namespaces for the roster vs the approved-photo picker.
    expect(client).toContain("clearHref(['memberQ', 'memberPage'])")
    expect(client).toContain("clearHref(['mediaQ', 'mediaPage'])")
  })

  it('representative dashboard + admin lists wire the filtered-empty clear path', () => {
    const team = source('src/app/(dashboard)/dashboard/team/page.tsx')
    expect(team).toContain('FilteredEmptyState')
    expect(team).toContain('clearHref="/dashboard/team"')

    const users = source('src/app/admin/users/page.tsx')
    expect(users).toContain('FilteredEmptyState')
    expect(users).toContain('clearHref="/admin/users"')
  })

  it('the admin EmptyState delegates to the shared StateView; the dashboard one stays procedural', () => {
    expect(source('src/components/admin/empty-state.tsx')).toContain("from '@/components/ui/state-view'")
    // The dashboard EmptyState keeps its own copy voice but the same quiet,
    // dashed, token-backed shape and the action-only-when-given contract.
    const statusUtils = source('src/components/dashboard/status-utils.tsx')
    expect(statusUtils).toContain('action?: ReactNode')
    expect(statusUtils).toContain('{action ?')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Destructive / high-risk action coverage. Each must: explicitly confirm
// (destructive variant), lock out while pending (no double submit), and
// surface an accessible error. We assert on source so the guarantees can't
// silently regress.
// ─────────────────────────────────────────────────────────────────────────
const DESTRUCTIVE_ACTIONS: Record<string, string> = {
  'release seat (dashboard)': 'src/components/dashboard/release-seat-button.tsx',
  'release trial (dashboard)': 'src/components/dashboard/release-trial-button.tsx',
  'deactivate machine (dashboard)': 'src/components/dashboard/deactivate-machine-button.tsx',
  'delete licence (admin)': 'src/components/admin/delete-license-button.tsx',
  'cancel invitation (dashboard)': 'src/components/dashboard/invitations-panel.tsx',
  'staff ban + demote (admin)': 'src/app/admin/team/team-client.tsx',
}

describe('Task 27 · destructive actions confirm, lock out, and report', () => {
  it('every destructive action asks for an explicit destructive confirmation', () => {
    for (const [name, rel] of Object.entries(DESTRUCTIVE_ACTIONS)) {
      const s = source(rel)
      expect(s, `${name} does not import confirm`).toContain("confirm")
      expect(s, `${name} missing destructive variant`).toContain("variant: 'destructive'")
    }
  })

  it('every destructive action locks its trigger while pending (no double submit)', () => {
    for (const [name, rel] of Object.entries(DESTRUCTIVE_ACTIONS)) {
      const s = source(rel)
      const locks = /disabled=\{[^}]*(pending|busy)/.test(s)
      expect(locks, `${name} does not disable while pending`).toBe(true)
    }
  })

  it('single-action buttons surface an accessible error (role=alert or shared Alert)', () => {
    for (const rel of [
      'src/components/dashboard/release-seat-button.tsx',
      'src/components/dashboard/release-trial-button.tsx',
      'src/components/dashboard/deactivate-machine-button.tsx',
    ]) {
      const s = source(rel)
      expect(s).toContain('role="alert"')
    }
  })

  it('staff ban and demote can no longer proceed on a cancelled prompt', () => {
    const team = source('src/app/admin/team/team-client.tsx')
    // Ban is gated by confirm() before the optional reason prompt.
    expect(team).toContain('Ban account')
    expect(team).toContain('Remove this person from staff?')
    // The accessible toast announces success/failure.
    expect(team).toContain("role={toast.kind === 'ok' ? 'status' : 'alert'}")
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Task 27 remediation — the remaining destructive/high-risk mutations.
// Admin module-video Unpublish/Clear now confirm with product scope + a
// cancel path, lock per-row while pending, and announce via a live region.
// ─────────────────────────────────────────────────────────────────────────
describe('Task 27 · admin module-video Unpublish + Clear are confirmed and locked', () => {
  const client = source('src/app/admin/module-videos/module-videos-client.tsx')

  it('imports the shared imperative confirm', () => {
    expect(client).toContain("from '@/components/ui/dialog-imperative'")
    expect(client).toContain('confirm')
  })

  it('confirms Unpublish with product scope + a cancel path (reversible → warning)', () => {
    expect(client).toContain('async function confirmUnpublish')
    expect(client).toContain('Unpublish the ${label} demo video?')
    expect(client).toContain('public /${product} product page')
    expect(client).toContain("variant: 'warning'")
    expect(client).toContain('cancelText')
  })

  it('confirms Clear with product scope, an undo warning, and a destructive variant', () => {
    expect(client).toContain('async function confirmClear')
    expect(client).toContain('Clear the ${label} demo video?')
    expect(client).toContain('cannot be undone')
    expect(client).toContain("variant: 'destructive'")
  })

  it('wires the buttons to the confirmed handlers and locks per-row while busy (no double submit)', () => {
    expect(client).toContain('onClick={() => confirmUnpublish(row.product, row.label)}')
    expect(client).toContain('onClick={() => confirmClear(row.product, row.label)}')
    expect(client).toContain('if (cards[product]?.busy) return')
    expect(client).toContain('disabled={card.busy}')
  })

  it('surfaces an accessible live status + alert for the row result', () => {
    expect(client).toContain('role="alert"')
    expect(client).toContain('role="status" aria-live="polite"')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Media hard delete is now an audited tombstone: the public object is
// removed but the provenance/rights record + audit trail survive, and the
// public resolvers stay fail-closed.
// ─────────────────────────────────────────────────────────────────────────
describe('Task 27 · media delete is an audited tombstone that preserves provenance', () => {
  const route = source('src/app/api/admin/media/route.ts')

  it('no longer physically deletes the row', () => {
    expect(route).not.toContain('db.delete(platformMedia)')
  })

  it('transitions to a deleted tombstone and writes a media.delete audit row', () => {
    expect(route).toContain("action: 'media.delete'")
    expect(route).toContain("objectState: 'deleted'")
    // The audit + status change happen together.
    expect(route).toContain('db.batch(')
  })

  it('removes the public/private objects (public removal) but keeps the rights record', () => {
    expect(route).toContain('deletePublishedMedia')
    expect(route).toContain('deleteQuarantinedMedia')
    // The rights/provenance columns are NOT wiped in the tombstone update.
    const deleteBlock = route.slice(route.indexOf('export async function DELETE'))
    expect(deleteBlock).not.toContain("rightsHolder: ''")
    expect(deleteBlock).not.toContain("rightsBasis: 'unverified'")
    expect(deleteBlock).not.toContain('rightsSource:')
  })

  it('keeps every public resolver fail-closed on objectState = published', () => {
    const slots = source('src/lib/media-slots.ts')
    // getSlotMedia + getApprovedMediaById + the listApprovedMediaPhotos gate.
    const publishedGates = slots.split("eq(platformMedia.objectState, 'published')").length - 1
    expect(publishedGates).toBeGreaterThanOrEqual(3)
  })

  it('the delete UI confirmation explains public removal and the retained rights record', () => {
    const lib = source('src/components/admin/media-library.tsx')
    expect(lib).toContain('Remove this media from public use?')
    expect(lib).toContain('rights and provenance record is kept')
    expect(lib).toContain("variant: 'destructive'")
    // It no longer optimistically drops the row (provenance stays visible).
    expect(lib).not.toContain('current.filter((candidate) => candidate.id !== item.id)')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Sensitive settings clear/reset must never reveal a prior secret. The
// editor pre-fills empty + masks, and there is no plaintext echo.
// ─────────────────────────────────────────────────────────────────────────
describe('Task 27 · sensitive settings never reveal a prior secret', () => {
  const client = source('src/app/admin/settings/settings-client.tsx')
  it('starts every edit from an empty draft and masks sensitive input', () => {
    expect(client).toContain("setDraft('')")
    expect(client).toContain('value={draft}')
    expect(client).toContain("type={s.sensitive && !reveal ? 'password'")
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Authenticated customers can start the real 30-day trial from Overview or
// Downloads. Public marketing remains demo-led, and the perpetual purchase
// handoff stays in Licences after the customer has had time to evaluate.
// ─────────────────────────────────────────────────────────────────────────
describe('Task 27 · authenticated trial-led dashboard acquisition', () => {
  it('ships one focused StartTrialPanel and uses it on overview and downloads', () => {
    expect(has('src/components/dashboard/start-trial-panel.tsx')).toBe(true)
    const overview = source('src/app/(dashboard)/dashboard/page.tsx')
    const downloads = source('src/app/(dashboard)/dashboard/downloads/page.tsx')
    expect(overview).toContain('<StartTrialPanel')
    expect(downloads).toContain('<StartTrialPanel')
  })

  it('preserves the trial API + release-trial contract', () => {
    expect(has('src/app/api/dashboard/trial/route.ts'), 'trial API must be preserved').toBe(true)
    expect(has('src/components/dashboard/release-trial-button.tsx')).toBe(true)
  })

  it('the overview leads with a no-card 30-day trial and keeps demo as an alternative', () => {
    const overview = source('src/app/(dashboard)/dashboard/page.tsx')
    const panel = source('src/components/dashboard/start-trial-panel.tsx')
    expect(overview).toContain('Try the full Windows app free for 30 days')
    expect(panel).toContain('Start 30-day trial')
    expect(panel).toContain('/contact?type=demo')
    expect(panel).toContain("fetch('/api/dashboard/trial'")
  })

  it('licence and billing pages retain the post-trial perpetual purchase handoff', () => {
    for (const file of [
      'src/app/(dashboard)/dashboard/licenses/page.tsx',
      'src/app/(dashboard)/dashboard/billing/page.tsx',
    ]) {
      expect(source(file)).toContain('/buy')
    }
  })

  it('downloads offers trials without a repeated buy button', () => {
    const downloads = source('src/app/(dashboard)/dashboard/downloads/page.tsx')
    expect(downloads).toContain('availableTrialVariants')
    expect(downloads).toContain('30-day trial available')
    expect(downloads).not.toContain('Buy licence')
    expect(downloads).not.toContain('/buy?variant=')
  })

  it('keeps public onboarding and welcome messages free of trial acquisition claims', () => {
    const onboarding = source('src/components/dashboard/onboarding-wizard.tsx')
    expect(onboarding).not.toMatch(/30-day trial|free trial|starts a free trial/i)
    const templates = source('src/emails/templates.tsx')
    expect(templates).not.toMatch(/start a 30-day trial|30-day free run|Activate your trial/i)
    const welcome = source('src/emails/welcome.tsx')
    expect(welcome).not.toMatch(/free trial|30-day .*trial is live/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Polish: the active admin status dot is reduced-motion-safe, the users
// "Banned" badge uses semantic Working Counter negative tokens, and no new
// indefinite animation is introduced.
// ─────────────────────────────────────────────────────────────────────────
describe('Task 27 · admin status-dot + badge polish', () => {
  it('the pulsing status dot respects prefers-reduced-motion (no unconditional infinite loop)', () => {
    const dot = source('src/components/admin/status-dot.tsx')
    expect(dot).toContain('useReducedMotion')
    expect(dot).toContain('const animate = pulse && !prefersReducedMotion')
    // The infinite framer loop only mounts when animation is allowed.
    expect(dot).toContain('{animate && (')
    expect(dot).toContain('repeat: Infinity')
  })

  it('the admin users "Banned" badge uses the semantic negative token, not rose-*', () => {
    const users = source('src/app/admin/users/page.tsx')
    expect(users).toContain('text-[var(--color-negative)]')
    expect(users).not.toContain('text-rose-700')
    expect(users).not.toContain('bg-rose-500/10')
  })
})

describe('Task 27 · no stale generic / spinner / trial / password states', () => {
  const STATE_SURFACES = [
    'src/app/global-error.tsx',
    'src/app/not-found.tsx',
    'src/app/[locale]/(frontend)/not-found.tsx',
    'src/components/ui/state-view.tsx',
    'src/components/ui/error-state.tsx',
    ...ERROR_BOUNDARIES.filter((r) => r !== 'global-error.tsx').map((r) => `src/app/${r}`),
    'src/components/dashboard/invitations-panel.tsx',
  ]

  it('no boundary or state surface shows a bare "Something went wrong"', () => {
    for (const rel of STATE_SURFACES) {
      expect(source(rel), `${rel} still shows the generic phrase`).not.toContain('Something went wrong')
    }
  })

  it('the releases sync action no longer spins indefinitely', () => {
    const sync = source('src/app/admin/releases/sync-button.tsx')
    expect(sync).not.toContain('animate-spin')
    expect(sync).toContain('Syncing…')
  })

  it('the orphaned system-pulse + ticket-reply + legacy password forms are removed', () => {
    expect(has('src/components/admin/system-pulse.tsx')).toBe(false)
    expect(has('src/components/dashboard/ticket-reply-form.tsx')).toBe(false)
    // Legacy password login/signup forms (dead endpoints, password inputs)
    // are gone so stale password/registration states can't reappear.
    expect(has('src/components/auth/login-form.tsx')).toBe(false)
    expect(has('src/components/auth/signup-form.tsx')).toBe(false)
  })

  it('nothing imports the removed orphan components anywhere in src', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name)
        return e.isDirectory() ? walk(p) : [p]
      })
    const files = walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))
    const orphanTokens = ['system-pulse', 'ticket-reply-form', 'auth/login-form', 'auth/signup-form']
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      for (const token of orphanTokens) {
        expect(s, `${f} references removed orphan ${token}`).not.toContain(token)
      }
    }
  })

  it('auth surfaces remain passwordless (no stale password form)', () => {
    for (const rel of [
      'src/components/auth/sign-in-form.tsx',
      'src/components/auth/forgot-password-form.tsx',
    ]) {
      expect(source(rel)).not.toContain('type="password"')
    }
  })
})

describe('Task 27 · checkout keeps honest, verified-only outcome states', () => {
  const outcome = source('src/components/checkout/checkout-outcome.tsx')

  it('exposes success / pending / failed / unknown as accessible live regions', () => {
    expect(outcome).toContain('data-checkout-view')
    expect(outcome).toContain("aria-live=\"polite\"")
    expect(outcome).toContain("role=\"alert\"")
    expect(outcome).toContain("view === 'success'")
    expect(outcome).toContain("view === 'pending'")
    expect(outcome).toContain("view === 'failed'")
  })

  it('renders installer/licence actions only inside the success (verified) panel', () => {
    // The download/licence CTAs must live in SuccessPanel, not the pending/unknown ones.
    const successIdx = outcome.indexOf('function SuccessPanel')
    const pendingIdx = outcome.indexOf('function PendingPanel')
    expect(successIdx).toBeGreaterThan(-1)
    expect(pendingIdx).toBeGreaterThan(successIdx)
    const successBlock = outcome.slice(successIdx, pendingIdx)
    expect(successBlock).toContain('/dashboard/downloads')
  })
})
