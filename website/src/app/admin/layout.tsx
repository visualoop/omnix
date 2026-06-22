import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { RootShell } from '@/components/layout/root-shell'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/orgs', label: 'Orgs' },
  { href: '/admin/machines', label: 'Machines' },
  { href: '/admin/licenses', label: 'Licences' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/tickets', label: 'Tickets' },
  { href: '/admin/releases', label: 'Releases' },
  { href: '/admin/audit', label: 'Audit' },
]

const STAFF_ROLES = ['platform_admin', 'support_agent', 'sales_rep']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/admin')

  const role = (session.user as { role?: string }).role ?? 'user'
  if (!STAFF_ROLES.includes(role)) {
    return (
      <RootShell>
        <div className="min-h-screen flex items-center justify-center bg-[#FBFAF6] px-6">
          <div className="text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">403</span>
            <h1 className="mt-2 font-display text-[clamp(28px,3vw,40px)] font-medium leading-[1.05] tracking-[-0.01em]">
              Not for you.
            </h1>
            <p className="mt-2 text-[14px] text-[var(--color-fg-muted)]">
              The admin area is staff-only. <Link href="/dashboard" className="underline-offset-4 hover:underline">Back to your dashboard</Link>.
            </p>
          </div>
        </div>
      </RootShell>
    )
  }

  return (
    <RootShell>
      <div className="flex min-h-screen bg-[#FBFAF6]">
        <aside className="w-[220px] shrink-0 border-r border-[var(--color-border)] py-6 px-3">
          <Link href="/admin" className="block px-3 mb-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] block">
              Omnix
            </span>
            <span style={{ fontFamily: 'var(--font-display, serif)' }} className="text-[20px] font-medium leading-tight tracking-[-0.01em]">
              Admin
            </span>
          </Link>
          <nav className="space-y-0.5">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block px-3 py-2 text-[13px] rounded-md hover:bg-foreground/[0.04] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-6 left-3 right-3 px-3 text-[11px] text-[var(--color-fg-subtle)]">
            <div className="font-mono">{session.user.email}</div>
            <div className="font-mono uppercase tracking-wider mt-0.5">{role}</div>
          </div>
        </aside>
        <section className="flex-1 min-w-0 px-8 py-8">{children}</section>
      </div>
    </RootShell>
  )
}
