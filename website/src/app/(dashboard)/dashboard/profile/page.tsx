import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, user } from '@/db'
import { auth } from '@/lib/auth'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { PageHeading } from '@/components/dashboard/status-utils'
import { KE_COUNTIES } from '@/lib/ke-counties'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/profile')

  const rows = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  const customer = rows[0]
  if (!customer) redirect('/login?next=/dashboard/profile')

  // Extra customer fields are stored on the user row via additionalFields,
  // plus a few we left in metadata until we promote them to columns.
  const extra = (customer as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const get = (k: string) => (typeof extra[k] === 'string' ? (extra[k] as string) : '')

  return (
    <div className="space-y-8">
      <PageHeading
        title="Profile"
        subtitle="Update your account details. Email is your sign-in handle and can't be changed without contacting support."
      />

      <div className="max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
        <ProfileForm
          initial={{
            fullName: customer.name ?? '',
            businessName: customer.businessName ?? '',
            email: customer.email,
            phone: customer.phoneNumber ?? '',
            whatsapp: get('whatsapp'),
            kraPin: get('kraPin'),
            county: get('county'),
            town: get('town'),
            physicalAddress: get('physicalAddress'),
            businessType: get('businessType'),
            employeeCount: get('employeeCount'),
            newsletterOptIn: extra.newsletterOptIn !== false,
          }}
          counties={KE_COUNTIES.map((c) => ({ value: c.value, label: c.label }))}
        />
      </div>
    </div>
  )
}
