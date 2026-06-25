import { notFound } from 'next/navigation'
import { eq, desc, inArray } from 'drizzle-orm'
import {
  db,
  organization,
  member,
  user,
  licenses,
  machines,
  payments,
  auditLog,
  invitation,
} from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { LazyTabs } from '@/components/layout/lazy-tabs'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminOrgDetailPage({ params }: PageProps) {
  const { id } = await params
  const org = await db.query.organization.findFirst({ where: eq(organization.id, id) })
  if (!org) notFound()

  const [members, orgLicenses, orgMachines, orgPayments, openInvitations] = await Promise.all([
    db
      .select({ member: member, user: user })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, id)),
    db.select().from(licenses).where(eq(licenses.organizationId, id)).orderBy(desc(licenses.createdAt)),
    db.select().from(machines).where(eq(machines.organizationId, id)).orderBy(desc(machines.lastSeenAt)),
    db.select().from(payments).where(eq(payments.organizationId, id)).orderBy(desc(payments.createdAt)),
    db.select().from(invitation).where(eq(invitation.organizationId, id)),
  ])

  const totalSpent = orgPayments.filter((p) => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)
  const owner = members.find((m) => m.member.role === 'owner')

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Organisations', href: '/admin/orgs' }, { label: org.name }]} />
      <BackButton fallback="/admin/orgs" label="Back to orgs" />
      <EntityHero
        eyebrow="Organisation"
        title={org.name}
        subtitle={org.slug}
        badges={owner ? [{ label: `Owner: ${owner.user.name}`, variant: 'outline' }] : undefined}
        stats={[
          { label: 'Created', value: formatDate(org.createdAt) },
          { label: 'Members', value: members.length },
          { label: 'Licences', value: orgLicenses.length },
          { label: 'Machines', value: orgMachines.length },
          { label: 'Open invites', value: openInvitations.filter((i) => i.status === 'pending').length },
          { label: 'Lifetime spend', value: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(totalSpent) },
        ]}
      />

      <LazyTabs
        tabs={[
          {
            id: 'members',
            label: 'Members',
            count: members.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {members.map((m) => (
                  <li key={m.member.id}>
                    <Link href={`/admin/users/${m.user.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{m.user.name}</span>
                        <span className="text-[11px] text-muted-foreground">{m.user.email}</span>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.member.role}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: 'invitations',
            label: 'Invitations',
            count: openInvitations.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {openInvitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">{inv.email}</span>
                      <span className="text-[11px] text-muted-foreground">{inv.role ?? 'member'} · {inv.status}</span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Expires {formatDate(inv.expiresAt)}
                    </span>
                  </li>
                ))}
                {openInvitations.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No invitations.</li>}
              </ul>
            ),
          },
          {
            id: 'licenses',
            label: 'Licences',
            count: orgLicenses.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {orgLicenses.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/licenses/${l.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="font-mono text-[13px] font-medium">{l.licenseKey}</span>
                        <span className="text-[11px] text-muted-foreground">{l.variant} · {l.tier} · {l.status}</span>
                      </div>
                    </Link>
                  </li>
                ))}
                {orgLicenses.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No licences.</li>}
              </ul>
            ),
          },
          {
            id: 'machines',
            label: 'Machines',
            count: orgMachines.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {orgMachines.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/machines/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{m.hostname || m.machineId}</span>
                        <span className="text-[11px] text-muted-foreground">{m.os} · {m.currentVersion ?? '—'}</span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {m.lastSeenAt ? formatDateShort(m.lastSeenAt) : 'never'}
                      </span>
                    </Link>
                  </li>
                ))}
                {orgMachines.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No machines.</li>}
              </ul>
            ),
          },
          {
            id: 'payments',
            label: 'Payments',
            count: orgPayments.length,
            content: (
              <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
                {orgPayments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/payments/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium">{p.purpose}</span>
                        <span className="text-[11px] text-muted-foreground">{p.paystackReference}</span>
                      </div>
                      <span className="font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency }).format(p.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
                {orgPayments.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No payments.</li>}
              </ul>
            ),
          },
        ]}
      />
    </div>
  )
}
