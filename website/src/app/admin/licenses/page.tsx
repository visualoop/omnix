import { desc, eq } from 'drizzle-orm'
import { Key } from '@phosphor-icons/react/dist/ssr'
import { db, licenses, user } from '@/db'
import { LicenseCard } from '@/components/admin/license-card'
import { EmptyState } from '@/components/admin/empty-state'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Admin · Licences' }
export const dynamic = 'force-dynamic'

export default async function AdminLicensesPage() {
  const rows = await db
    .select({
      id: licenses.id,
      licenseKey: licenses.licenseKey,
      variant: licenses.variant,
      tier: licenses.tier,
      status: licenses.status,
      trialEndsAt: licenses.trialEndsAt,
      maintenanceUntil: licenses.maintenanceUntil,
      maxMachines: licenses.maxMachines,
      maxBranches: licenses.maxBranches,
      createdAt: licenses.createdAt,
      customerEmail: user.email,
    })
    .from(licenses)
    .leftJoin(user, eq(licenses.userId, user.id))
    .orderBy(desc(licenses.createdAt))
    .limit(120)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Licences"
        description="Every issued licence — drawn as a paper certificate. The copper strip on the left signals one issued by Omnix; status seal on the right tells you whether it's active, on trial, or expired."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Key weight="regular" className="size-8" />}
          title="No licences yet."
          description="The first one will show up here as soon as a customer completes a license_fee payment."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((l) => (
            <LicenseCard key={l.id} l={l} />
          ))}
        </div>
      )}
    </div>
  )
}
