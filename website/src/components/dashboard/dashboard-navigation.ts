/**
 * Customer dashboard navigation model — typed, pure, and framework-free.
 *
 * This module holds NO React and NO server imports so it can be unit-tested
 * in plain Node and imported from both server (layout capability wiring) and
 * client (shell rendering) code.
 *
 * Two hard rules this file encodes:
 *
 *  1. Navigation visibility is a *usability* boundary, never a security one.
 *     Every sensitive page keeps its own server-side authorization gate
 *     (see /dashboard/reseller/*). Hiding a link does not protect a route.
 *
 *  2. Visibility is derived only from real, server-resolved capabilities
 *     passed in as an explicit object — never from query strings, cookies,
 *     or localStorage.
 *
 * The website account (this dashboard) is deliberately distinct from the
 * installed Omnix desktop app that a shop actually runs on. Labels and
 * descriptions here speak the buyer's language: licences, devices,
 * payments, and support — not point-of-sale operations.
 */

/** Icon keys resolved to concrete components inside the (client) shell. */
export type DashboardNavIcon =
  | 'overview'
  | 'licences'
  | 'devices'
  | 'downloads'
  | 'payments'
  | 'billing'
  | 'team'
  | 'reseller'
  | 'affiliate'
  | 'support'
  | 'profile'

/**
 * Real, server-resolved capabilities that shape what a signed-in customer
 * can see. Each field must originate from a database/session fact resolved
 * on the server — not from anything the client can forge.
 */
export interface DashboardCapabilities {
  /** True when the user has an approved/suspended `resellers` row. */
  isReseller: boolean
}

export interface DashboardNavItem {
  href: string
  label: string
  description: string
  icon: DashboardNavIcon
  /**
   * Predicate over real capabilities. Omitted → visible to every
   * authenticated customer (an open, self-service surface).
   */
  requires?: (capabilities: DashboardCapabilities) => boolean
}

export interface DashboardNavGroup {
  label: string
  items: readonly DashboardNavItem[]
}

/**
 * The complete, grouped-by-buyer-job navigation model.
 *
 * Grouping mirrors the jobs a customer comes here to do:
 *   Overview · Your software · Payments · Organisation · Partner programs · Account
 *
 * Affiliate is intentionally open to every authenticated customer: the
 * referral programme is self-service and the page renders a sign-up call to
 * action for people who have not joined yet. Reseller, by contrast, is a
 * restricted wholesale channel — it only appears when the server confirms a
 * `resellers` row, and the page itself still redirects non-resellers.
 */
export const DASHBOARD_NAVIGATION: readonly DashboardNavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        href: '/dashboard',
        label: 'Overview',
        description: 'Your licences, devices and account at a glance',
        icon: 'overview',
      },
    ],
  },
  {
    label: 'Your software',
    items: [
      {
        href: '/dashboard/licenses',
        label: 'Licences',
        description: 'Keys you own and their compliance cover',
        icon: 'licences',
      },
      {
        href: '/dashboard/machines',
        label: 'Devices',
        description: 'Computers and tills activated on your licences',
        icon: 'devices',
      },
      {
        href: '/dashboard/downloads',
        label: 'Downloads',
        description: 'Installers for the Omnix desktop app',
        icon: 'downloads',
      },
    ],
  },
  {
    label: 'Payments',
    items: [
      {
        href: '/dashboard/payments',
        label: 'Payments',
        description: 'Receipts and payment history',
        icon: 'payments',
      },
      {
        href: '/dashboard/billing',
        label: 'Billing',
        description: 'Renew compliance and add branches or seats',
        icon: 'billing',
      },
    ],
  },
  {
    label: 'Organisation',
    items: [
      {
        href: '/dashboard/team',
        label: 'Team',
        description: 'Teammates and organisation invitations',
        icon: 'team',
      },
    ],
  },
  {
    label: 'Partner programs',
    items: [
      {
        href: '/dashboard/reseller',
        label: 'Reseller',
        description: 'Your wholesale channel and commission',
        icon: 'reseller',
        requires: (capabilities) => capabilities.isReseller,
      },
      {
        href: '/dashboard/affiliate',
        label: 'Affiliate',
        description: 'Refer a business and earn commission',
        icon: 'affiliate',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        href: '/dashboard/support',
        label: 'Support',
        description: 'Open a ticket or read our replies',
        icon: 'support',
      },
      {
        href: '/dashboard/profile',
        label: 'Profile',
        description: 'Your account details and preferences',
        icon: 'profile',
      },
    ],
  },
]

/**
 * True when `href` is a safe, root-relative internal link.
 *
 * Nav links are authored as literals in this file, but this guard is applied
 * at render time as defence in depth so a future edit can never emit a
 * protocol-relative (`//host`), backslash-authority (`/\host`), or absolute
 * (`https://…`) link into the shell.
 */
export function isInternalHref(href: string): boolean {
  if (typeof href !== 'string' || href.length === 0) return false
  if (!href.startsWith('/')) return false
  if (href.startsWith('//') || href.startsWith('/\\')) return false
  return true
}

/** Strip query string and fragment so matching only ever compares paths. */
function pathOnly(value: string): string {
  const queryAt = value.indexOf('?')
  const hashAt = value.indexOf('#')
  const cut = [queryAt, hashAt].filter((i) => i >= 0).sort((a, b) => a - b)[0]
  return cut === undefined ? value : value.slice(0, cut)
}

/**
 * Pure active-link matcher.
 *
 *  - The overview root (`/dashboard`) matches only its exact path, so it does
 *    not stay highlighted on every child section.
 *  - Every other section matches its exact path *and* any nested child
 *    (`/dashboard/licenses` is active on `/dashboard/licenses/abc`).
 *  - Query strings and fragments are ignored on both sides.
 */
export function isActiveNavHref(pathname: string, href: string): boolean {
  const path = pathOnly(pathname)
  const target = pathOnly(href)
  if (target === '/dashboard') return path === '/dashboard'
  return path === target || path.startsWith(`${target}/`)
}

/**
 * Resolve the navigation a specific customer should see from their real,
 * server-resolved capabilities. Groups with no visible items are dropped so
 * the shell never renders an empty section header.
 */
export function dashboardNavigationForCapabilities(
  capabilities: DashboardCapabilities,
): DashboardNavGroup[] {
  return DASHBOARD_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!isInternalHref(item.href)) return false
      return item.requires ? item.requires(capabilities) : true
    }),
  })).filter((group) => group.items.length > 0)
}

/** Flat list of every href the model can ever expose (all capabilities on). */
export function allDashboardNavHrefs(): string[] {
  return DASHBOARD_NAVIGATION.flatMap((group) => group.items.map((item) => item.href))
}
