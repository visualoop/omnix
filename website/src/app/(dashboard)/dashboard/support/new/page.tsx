import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PageHeading } from '@/components/dashboard/status-utils'
import { NewTicketForm } from '@/components/dashboard/new-ticket-form'

export const metadata = { title: 'New ticket' }

export default async function NewTicketPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/support/new')

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeading title="New ticket" subtitle="Tell us what's happening. We reply on weekdays within 4 hours." />
      <NewTicketForm />
    </div>
  )
}
