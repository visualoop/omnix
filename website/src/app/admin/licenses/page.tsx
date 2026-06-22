import { desc } from 'drizzle-orm'
import { db, licenses } from '@/db'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Licences' }

export default async function AdminLicensesPage() {
  const rows = await db.select().from(licenses).orderBy(desc(licenses.createdAt)).limit(200)
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Licences" description="Every issued licence — trials, paid, lapsed." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-12 text-center text-[13px] text-[var(--color-fg-muted)]">
          None yet.
        </div>
      ) : (
        <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {rows.map((l) => (
            <li key={l.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-baseline gap-3 px-4 py-3 text-[13px]">
              <code className="font-mono text-[12px]">{l.licenseKey}</code>
              <span className="text-[var(--color-fg-muted)]">{l.variant} · {l.tier}</span>
              <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{l.maintenanceUntil?.toISOString().slice(0, 10) ?? 'trial'}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{l.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
