/**
 * /dashboard/reseller — reseller-facing dashboard.
 *
 * Only accessible if the logged-in user has a matching `resellers` row.
 * Non-resellers get redirected to /dashboard with a note (via searchParam).
 *
 * Shows:
 *  - Status card (active/suspended, discount, currency)
 *  - Rolling totals — licences issued, revenue brought, commission earned, unpaid
 *  - Table of licences they've issued (most recent 50)
 *  - Recent commission ledger entries (most recent 20)
 *
 * The "issue a new licence" flow lives at /dashboard/reseller/new (built
 * in v0.22.x when Paystack wholesale checkout is wired).
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, resellers, licenses, resellerCommissions, user } from '@/db'
import Link from 'next/link'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reseller · Omnix' }

export default async function ResellerDashboardPage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/reseller')

  const [reseller] = await db.select().from(resellers).where(eq(resellers.userId, session.user.id)).limit(1)
  if (!reseller) {
    redirect('/dashboard?notice=not_reseller')
  }

  const [issued, commissions] = await Promise.all([
    db
      .select({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        variant: licenses.variant,
        status: licenses.status,
        createdAt: licenses.createdAt,
        paidAt: licenses.paidAt,
        maintenanceUntil: licenses.maintenanceUntil,
        userEmail: user.email,
        userName: user.name,
      })
      .from(licenses)
      .leftJoin(user, eq(licenses.userId, user.id))
      .where(eq(licenses.resellerId, reseller.id))
      .orderBy(desc(licenses.createdAt))
      .limit(50),
    db
      .select()
      .from(resellerCommissions)
      .where(eq(resellerCommissions.resellerId, reseller.id))
      .orderBy(desc(resellerCommissions.createdAt))
      .limit(20),
  ])

  const isSuspended = reseller.status === 'suspended'
  const fmtMoney = (n: number) =>
    `${reseller.commissionCurrency} ${Math.round(n).toLocaleString()}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Reseller · {reseller.companyName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wholesale channel. Your discount off retail is <strong>{reseller.discountPercent}%</strong>.
          {isSuspended ? (
            <span className="ml-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              Suspended — cannot issue new licences
            </span>
          ) : (
            <span className="ml-2 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              Active
            </span>
          )}
        </p>
      </div>

      {/* Rolling totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Licences issued" value={reseller.totalLicensesIssued.toString()} />
        <Stat label="Revenue brought" value={fmtMoney(reseller.totalRevenueBrought)} />
        <Stat label="Commission earned" value={fmtMoney(reseller.totalCommissionEarned)} accent />
        <Stat
          label="Unpaid commission"
          value={fmtMoney(reseller.unpaidCommission)}
          note={reseller.unpaidCommission > 0 ? 'Paid out on the 5th of each month' : undefined}
        />
      </div>

      {/* Issue-new CTA */}
      <div className={`rounded-lg border p-4 text-sm ${isSuspended ? 'border-dashed border-border opacity-60' : 'border-primary/40 bg-primary/5'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Issue a new licence for a customer</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {isSuspended
                ? 'Suspended — reactivate before issuing new licences.'
                : `Wholesale checkout at ${reseller.discountPercent}% off retail. Reseller pays; customer gets the licence.`}
            </div>
          </div>
          {isSuspended ? (
            <button
              disabled
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground"
            >
              Suspended
            </button>
          ) : (
            <Link
              href="/dashboard/reseller/new"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Issue licence →
            </Link>
          )}
        </div>
      </div>

      {/* Licences issued */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Licences you&rsquo;ve issued</h2>
        {issued.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            You haven&rsquo;t issued any licences yet. Once you do, they&rsquo;ll appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <Th>Customer</Th>
                  <Th>Variant</Th>
                  <Th>Status</Th>
                  <Th>Issued</Th>
                  <Th>Key</Th>
                </tr>
              </thead>
              <tbody>
                {issued.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <Td>
                      <div className="text-foreground">{l.userName || '—'}</div>
                      <div className="text-[11px] text-muted-foreground">{l.userEmail}</div>
                    </Td>
                    <Td className="capitalize">{l.variant}</Td>
                    <Td>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${
                          l.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : l.status === 'trial'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {l.status}
                      </span>
                    </Td>
                    <Td className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</Td>
                    <Td>
                      <code className="text-[11px] text-muted-foreground">{l.licenseKey}</code>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Commission ledger */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent commission</h2>
        {commissions.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No commission entries yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <Th>Date</Th>
                  <Th>Licence</Th>
                  <Th>Gross</Th>
                  <Th>Commission</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <Td className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</Td>
                    <Td>
                      <code className="text-[11px] text-muted-foreground">{c.licenseId.slice(0, 12)}…</code>
                    </Td>
                    <Td className="tabular-nums">{c.currency} {Math.round(c.grossAmount).toLocaleString()}</Td>
                    <Td className="tabular-nums font-medium">{c.currency} {Math.round(c.commissionAmount).toLocaleString()}</Td>
                    <Td>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${
                          c.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : c.status === 'reversed'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent, note }: { label: string; value: string; accent?: boolean; note?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {note ? <div className="mt-1 text-[11px] text-muted-foreground">{note}</div> : null}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>
}
