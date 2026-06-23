import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { count, eq, sql } from 'drizzle-orm'
import {
  Gauge, Users, Buildings, Desktop, Key, CreditCard,
  ChatCircle, ArrowSquareOut, ListMagnifyingGlass, GearSix, SignOut,
  UsersFour,
} from '@phosphor-icons/react/dist/ssr'
import { auth } from '@/lib/auth'
import { db, machines } from '@/db'
import { RootShell } from '@/components/layout/root-shell'
import { SystemPulse } from '@/components/admin/system-pulse'

/**
 * Admin shell — espresso paper, mono nav, hairline rules, single copper
 * accent. NOT the cream marketing surface; this is the back-office console.
 *
 * Subject: an internal admin console for an offline-first ERP. The audience
 * is the founder + a small ops team; the page's job is "show me system
 * state at a glance, then let me act." Designed to feel like a calm
 * operator console — readable at 02:00 when something goes wrong.
 */

const NAV = [
  { href: '/admin',          label: 'Overview',  Icon: Gauge },
  { href: '/admin/users',    label: 'Users',     Icon: Users },
  { href: '/admin/orgs',     label: 'Orgs',      Icon: Buildings },
  { href: '/admin/machines', label: 'Machines',  Icon: Desktop },
  { href: '/admin/licenses', label: 'Licences',  Icon: Key },
  { href: '/admin/payments', label: 'Payments',  Icon: CreditCard },
  { href: '/admin/tickets',  label: 'Tickets',   Icon: ChatCircle },
  { href: '/admin/releases', label: 'Releases',  Icon: ArrowSquareOut },
  { href: '/admin/audit',    label: 'Audit',     Icon: ListMagnifyingGlass },
  { href: '/admin/team',     label: 'Team',      Icon: UsersFour },
  { href: '/admin/settings', label: 'Settings',  Icon: GearSix },
]

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) {
    const fullUrl = reqHeaders.get('x-omnix-url') ?? '/admin'
    redirect(`/login?next=${encodeURIComponent(fullUrl)}`)
  }

  const role = (session.user as { role?: string }).role ?? 'user'
  if (!STAFF_ROLES.includes(role)) {
    return (
      <RootShell>
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
          <div className="text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">403</span>
            <h1
              style={{ fontFamily: 'var(--font-display)' }}
              className="mt-2 text-[clamp(28px,3vw,40px)] font-medium leading-[1.05] tracking-[-0.01em] text-[var(--color-fg)]"
            >
              Not for you.
            </h1>
            <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">
              The admin area is staff-only. <Link href="/dashboard" className="underline-offset-4 hover:underline text-[var(--color-fg)]">Back to your dashboard</Link>.
            </p>
          </div>
        </div>
      </RootShell>
    )
  }

  // Live machines = seen in the last 5 minutes (constant-time sidebar query).
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const liveResult = await db
    .select({ n: count() })
    .from(machines)
    .where(sql`${machines.lastSeenAt} > ${fiveMinAgo}`)
    .catch(() => [{ n: 0 }])
  const totalResult = await db.select({ n: count() }).from(machines).catch(() => [{ n: 0 }])
  const live = liveResult[0]?.n ?? 0
  const total = totalResult[0]?.n ?? 0

  const initials = (session.user.name ?? session.user.email).slice(0, 2).toUpperCase()

  return (
    <RootShell>
      <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="w-[244px] shrink-0 border-r border-[var(--color-border)] flex flex-col">
          {/* Brand */}
          <div className="px-5 pt-6 pb-5 border-b border-[var(--color-border)]">
            <Link href="/admin" className="block">
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: 'var(--font-display)' }} className="text-[20px] font-medium leading-none tracking-[-0.01em]">
                  Omnix
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  ops
                </span>
              </div>
            </Link>
            <SystemPulse live={live} total={total} />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} Icon={n.Icon} />
            ))}
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
                <div className="text-[12px] truncate text-[var(--color-fg)]">{session.user.email}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
                  {role.replace('_', ' ')}
                </div>
              </div>
              <Link
                href="/api/auth/sign-out?callbackURL=/login"
                className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                title="Sign out"
              >
                <SignOut weight="regular" className="size-4" />
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
      </div>
    </RootShell>
  )
}

import type { Icon } from '@phosphor-icons/react'

function NavLink({ href, label, Icon }: { href: string; label: string; Icon: Icon }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
    >
      <Icon weight="regular" className="size-4 shrink-0 text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)]" />
      <span>{label}</span>
    </Link>
  )
}
