import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft } from '@/components/icons'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { NewTicketForm } from '@/components/dashboard/new-ticket-form'
import { PageHeading } from '@/components/dashboard/status-utils'

export const metadata = { title: 'New ticket' }

export default async function NewTicketPage() {
  const reqHeaders = await headers()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers: reqHeaders })
  if (!user || user.collection !== 'customers') redirect('/login')

  const licensesRes = await payload.find({
    collection: 'licenses',
    where: { customer: { equals: user.id } },
    limit: 50,
  })
  const licenses = licensesRes.docs as unknown as { id: string; licenseKey: string }[]

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/support"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All tickets
      </Link>

      <PageHeading
        title="New support ticket"
        subtitle="Tell us what's happening. We attach your licence and machine context automatically so we have what we need to investigate."
      />

      <div className="max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8">
        <NewTicketForm
          licenses={licenses.map((l) => ({ value: l.id, label: l.licenseKey }))}
        />
      </div>
    </div>
  )
}
