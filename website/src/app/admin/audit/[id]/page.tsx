import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, auditLog, user } from '@/db'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { BackButton } from '@/components/layout/back-button'
import { EntityHero } from '@/components/layout/entity-hero'
import { formatDate, formatDateShort, formatDateLong } from '@/lib/format-date'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminAuditDetailPage({ params }: PageProps) {
  const { id } = await params
  const entry = await db.query.auditLog.findFirst({ where: eq(auditLog.id, id) })
  if (!entry) notFound()

  const actor = entry.actorId ? await db.query.user.findFirst({ where: eq(user.id, entry.actorId) }) : null

  // Resource is shaped "kind:id". Resolve a deep link if we recognise the kind.
  const resourceLink = (() => {
    if (!entry.resource) return null
    const [kind, rid] = entry.resource.split(':')
    if (!rid) return null
    if (kind === 'license') return `/admin/licenses/${rid}`
    if (kind === 'user') return `/admin/users/${rid}`
    if (kind === 'org' || kind === 'organization') return `/admin/orgs/${rid}`
    if (kind === 'machine') return `/admin/machines/${rid}`
    if (kind === 'payment') return `/admin/payments/${rid}`
    if (kind === 'ticket') return `/admin/tickets/${rid}`
    return null
  })()

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Audit log', href: '/admin/audit' }, { label: entry.action }]} />
      <BackButton fallback="/admin/audit" label="Back to audit log" />
      <EntityHero
        eyebrow="Audit"
        title={entry.action}
        subtitle={
          <>
            {formatDateLong(entry.createdAt)}
            {actor && (
              <>
                {' '}
                · by <Link className="underline" href={`/admin/users/${actor.id}`}>{actor.name}</Link>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Action" value={<span className="font-mono">{entry.action}</span>} />
        <Field
          label="Resource"
          value={
            entry.resource ? (
              resourceLink ? (
                <Link className="underline font-mono" href={resourceLink}>
                  {entry.resource}
                </Link>
              ) : (
                <span className="font-mono">{entry.resource}</span>
              )
            ) : null
          }
        />
        <Field label="IP" value={entry.ipAddress} />
        <Field label="User agent" value={<span className="font-mono text-[11px] break-all">{entry.userAgent}</span>} />
      </div>

      {entry.metadata != null && (
        <details open className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Metadata
          </summary>
          <pre className="mt-3 text-[11px] text-foreground/80 whitespace-pre-wrap break-all">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  )
}
