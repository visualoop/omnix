import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { PageHeading } from '@/components/dashboard/status-utils'
import { KE_COUNTIES } from '@/lib/ke-counties'

export const metadata = { title: 'Profile' }

interface FullCustomer {
  id: string | number
  collection?: string
  fullName?: string
  businessName?: string
  email: string
  phone?: string
  whatsapp?: string
  kraPin?: string
  county?: string
  town?: string
  physicalAddress?: string
  businessType?: string
  employeeCount?: string
  newsletterOptIn?: boolean
}

export default async function ProfilePage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let user: FullCustomer | null = null
  try {
    const result = await payload.auth({ headers: reqHeaders })
    user = result.user as FullCustomer | null
  } catch (err) {
    console.error('[profile] auth error:', err)
    user = null
  }

  if (!user || user.collection !== 'customers' || !user.email) {
    redirect('/login?next=/dashboard/profile')
  }

  const customer = user

  return (
    <div className="space-y-8">
      <PageHeading
        title="Profile"
        subtitle="Update your account details. Email is your sign-in handle and can't be changed without contacting support."
      />

      <div className="max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
        <ProfileForm
          initial={{
            fullName: customer.fullName ?? '',
            businessName: customer.businessName ?? '',
            email: customer.email,
            phone: customer.phone ?? '',
            whatsapp: customer.whatsapp ?? '',
            kraPin: customer.kraPin ?? '',
            county: customer.county ?? '',
            town: customer.town ?? '',
            physicalAddress: customer.physicalAddress ?? '',
            businessType: customer.businessType ?? '',
            employeeCount: customer.employeeCount ?? '',
            newsletterOptIn: customer.newsletterOptIn ?? true,
          }}
          counties={KE_COUNTIES.map((c) => ({ value: c.value, label: c.label }))}
        />
      </div>
    </div>
  )
}
