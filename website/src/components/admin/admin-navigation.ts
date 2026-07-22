/**
 * Operator console navigation model — typed, pure, and framework-free.
 *
 * This module holds NO React and NO server imports so it can be unit-tested
 * in plain Node and imported from both server (layout role wiring) and client
 * (shell rendering) code.
 *
 * Two hard rules this file encodes:
 *
 *  1. Navigation visibility is a *usability* boundary, never a security one.
 *     It mirrors the platform capability model so staff aren't shown desks
 *     they can't work — but hiding a link never protects a route. Every
 *     sensitive page and API keeps its own server-side authorization gate
 *     (see /admin/settings, /admin/media, /admin/team-members, the
 *     /api/admin/* handlers, and the admin layout's staff gate).
 *
 *  2. Visibility is derived only from the real, server-resolved staff role
 *     passed in as an explicit value — never from query strings, cookies, or
 *     localStorage.
 *
 * The operator console (this admin area) is deliberately distinct from the
 * customer account dashboard and from the installed Omnix desktop app that a
 * shop actually runs on. It is the platform-operations surface for Omnix
 * staff.
 */

export type StaffRole = 'platform_admin' | 'support_agent' | 'sales_rep'

/** Icon keys resolved to concrete components inside the (client) shell. */
export type AdminNavIcon =
  | 'overview'
  | 'users'
  | 'organizations'
  | 'machines'
  | 'licenses'
  | 'payments'
  | 'tickets'
  | 'releases'
  | 'media'
  | 'moduleVideos'
  | 'teamPage'
  | 'audit'
  | 'staff'
  | 'settings'

export interface AdminNavItem {
  href: string
  label: string
  description: string
  icon: AdminNavIcon
  /**
   * Staff roles that may see this destination. Membership mirrors the
   * platform capability statements in src/lib/permissions/platform.ts. It is
   * a visibility hint only — the destination still enforces its own gate.
   */
  roles: readonly StaffRole[]
}

export interface AdminNavGroup {
  label: string
  items: readonly AdminNavItem[]
}

const ALL_STAFF: readonly StaffRole[] = ['platform_admin', 'support_agent', 'sales_rep']
/** Reserved for the desks only a platform administrator may operate. */
const ADMIN_ONLY: readonly StaffRole[] = ['platform_admin']
/** Customer records — every staff role has a customer/user read grant. */
const CUSTOMER_STAFF: readonly StaffRole[] = ['platform_admin', 'support_agent', 'sales_rep']
/** Ticket + audit desks — admins and the support team. */
const SUPPORT_STAFF: readonly StaffRole[] = ['platform_admin', 'support_agent']
/** Payment records — admins and the sales team. */
const SALES_STAFF: readonly StaffRole[] = ['platform_admin', 'sales_rep']

/**
 * The complete navigation model, grouped by the operational job a staff
 * member comes here to do rather than by internal table names:
 *
 *   Overview · Customers · Licences & devices · Payments · Releases ·
 *   Support · Trust & content · Audit & settings
 *
 * Every legitimate top-level admin page is represented exactly once. Dynamic
 * detail routes (`/admin/users/[id]`) and create forms (`/admin/customers/new`)
 * are reached from their section and are intentionally not separate nav
 * destinations; the active-link matcher keeps the parent highlighted while a
 * detail child is open.
 */
export const ADMIN_NAVIGATION: readonly AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        href: '/admin',
        label: 'Overview',
        description: 'Work queues and current platform state',
        icon: 'overview',
        roles: ALL_STAFF,
      },
    ],
  },
  {
    label: 'Customers',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        description: 'Customer and staff accounts',
        icon: 'users',
        roles: CUSTOMER_STAFF,
      },
      {
        href: '/admin/orgs',
        label: 'Organisations',
        description: 'Multi-user customer businesses',
        icon: 'organizations',
        roles: CUSTOMER_STAFF,
      },
    ],
  },
  {
    label: 'Licences & devices',
    items: [
      {
        href: '/admin/licenses',
        label: 'Licences',
        description: 'Issued, trial, and lapsed licences',
        icon: 'licenses',
        roles: ADMIN_ONLY,
      },
      {
        href: '/admin/machines',
        label: 'Machines',
        description: 'Install health and update policy',
        icon: 'machines',
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    label: 'Payments',
    items: [
      {
        href: '/admin/payments',
        label: 'Payments',
        description: 'Paystack transaction records',
        icon: 'payments',
        roles: SALES_STAFF,
      },
    ],
  },
  {
    label: 'Releases',
    items: [
      {
        href: '/admin/releases',
        label: 'Releases',
        description: 'Desktop update manifests',
        icon: 'releases',
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    label: 'Support',
    items: [
      {
        href: '/admin/tickets',
        label: 'Tickets',
        description: 'Customer support queue',
        icon: 'tickets',
        roles: SUPPORT_STAFF,
      },
    ],
  },
  {
    label: 'Trust & content',
    items: [
      {
        href: '/admin/media',
        label: 'Media',
        description: 'Approval and usage-rights controls',
        icon: 'media',
        roles: ADMIN_ONLY,
      },
      {
        href: '/admin/module-videos',
        label: 'Module videos',
        description: 'Product-page YouTube demos',
        icon: 'moduleVideos',
        roles: ADMIN_ONLY,
      },
      {
        href: '/admin/team-members',
        label: 'Team page',
        description: 'Public team profiles',
        icon: 'teamPage',
        roles: ADMIN_ONLY,
      },
    ],
  },
  {
    label: 'Audit & settings',
    items: [
      {
        href: '/admin/audit',
        label: 'Audit',
        description: 'System-affecting event history',
        icon: 'audit',
        roles: SUPPORT_STAFF,
      },
      {
        href: '/admin/team',
        label: 'Staff access',
        description: 'Roles, invitations, and bans',
        icon: 'staff',
        roles: ADMIN_ONLY,
      },
      {
        href: '/admin/settings',
        label: 'Settings',
        description: 'Encrypted platform integrations',
        icon: 'settings',
        roles: ADMIN_ONLY,
      },
    ],
  },
]

/** Narrow an arbitrary role string to a known staff role. */
export function isStaffRole(role: string): role is StaffRole {
  return ALL_STAFF.includes(role as StaffRole)
}

/**
 * True when `href` is a safe, root-relative internal link.
 *
 * Nav links are authored as literals in this file, but this guard is applied
 * at resolve time as defence in depth so a future edit can never emit a
 * protocol-relative (`//host`), backslash-authority (`/\host`), absolute
 * (`https://…`), or scheme (`javascript:`) link into the shell.
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
 *  - The overview root (`/admin`) matches only its exact path, so it does not
 *    stay highlighted on every child section.
 *  - Every other section matches its exact path *and* any nested child, so
 *    `/admin/users` is active on `/admin/users/abc123`.
 *  - Query strings and fragments are ignored on both sides.
 *  - Sibling prefixes never collide (`/admin/licenses` is not active on
 *    `/admin/licenses-archive`).
 */
export function isActiveNavHref(pathname: string, href: string): boolean {
  const path = pathOnly(pathname)
  const target = pathOnly(href)
  if (target === '/admin') return path === '/admin'
  return path === target || path.startsWith(`${target}/`)
}

/**
 * Resolve the navigation a given staff role should see. Non-staff roles get
 * an empty model; groups with no visible items are dropped so the shell never
 * renders an empty section header. Unsafe hrefs are filtered defensively.
 */
export function adminNavigationForRole(role: string): AdminNavGroup[] {
  if (!isStaffRole(role)) return []

  return ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => isInternalHref(item.href) && item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0)
}

/** Flat list of every href the model can ever expose (platform_admin sees all). */
export function allAdminNavHrefs(): string[] {
  return ADMIN_NAVIGATION.flatMap((group) => group.items.map((item) => item.href))
}
