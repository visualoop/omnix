import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { PageHeading } from '@/components/dashboard/status-utils'
import { KE_COUNTIES } from '@/lib/ke-counties'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') return null

  const customer = user as unknown as {
    id: string
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

      <section className="max-w-3xl rounded-2xl border border-[var(--color-negative)]/30 bg-[var(--color-surface)] p-6 lg:p-8">
        <h2 className="font-display text-[18px] font-medium text-[var(--color-negative)]">
          Danger zone
        </h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-muted)]">
          Deleting your account doesn't revoke paid licences — they belong to you forever — but
          it removes your access to this dashboard. You'll have to contact support to reactivate
          access.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md border border-[var(--color-negative)]/40 px-4 py-2 text-[13px] font-medium text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10"
        >
          Delete account
        </button>
      </section>
    </div>
  )
}
