import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, user } from '@/db'
import { auth } from '@/lib/auth'
import { OnboardingWizard } from '@/components/dashboard/onboarding-wizard'

export const metadata = { title: 'Onboarding' }
export const dynamic = 'force-dynamic'

/**
 * /onboarding — runs once on first dashboard visit when the user has
 * no business name set. Captures the minimum the licensing flow needs
 * before showing the trial wizard.
 *
 * If the user already has a business name we skip straight to dashboard.
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) redirect('/login?next=/onboarding')

  const rows = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  const me = rows[0]
  if (!me) redirect('/login')

  // If they've already onboarded, skip.
  if (me.businessName && me.phoneNumber) {
    redirect('/dashboard')
  }

  const meta = (me as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const get = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '')

  return (
    <OnboardingWizard
      initial={{
        businessName: me.businessName ?? '',
        country: me.country ?? 'KE',
        currency: me.currency ?? 'KES',
        phone: me.phoneNumber ?? '',
        kraPin: get('kraPin'),
        employeeCount: get('employeeCount'),
      }}
    />
  )
}
