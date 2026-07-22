import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { PageHeader } from '@/components/layout/page-header'
import { NewTicketForm } from '@/components/dashboard/new-ticket-form'

export const metadata = { title: 'New ticket' }

export default async function NewTicketPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/dashboard/support/new')

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <Breadcrumbs items={[{ label: 'Support', href: '/dashboard/support' }, { label: 'New ticket' }]} />
      <PageHeader
        eyebrow="Account"
        title="New ticket"
        description="Tell us what's happening. We reply on weekdays within 4 hours."
      />
      <NewTicketForm />
    </div>
  )
}
