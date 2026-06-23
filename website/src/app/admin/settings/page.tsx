import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listSettings } from '@/lib/platform-settings'
import { PageHeader } from '@/components/layout/page-header'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/admin/settings')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const settings = await listSettings()

  return (
    <>
      <PageHeader
        eyebrow="Platform settings"
        title="Integrations & secrets"
        description="Edit Paystack keys, Resend credentials, OAuth, S3 storage. Sensitive values are encrypted at rest with AES-256-GCM."
      />
      <SettingsClient initial={settings} />
    </>
  )
}
