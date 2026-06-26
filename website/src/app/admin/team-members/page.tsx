import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { asc } from 'drizzle-orm'
import { db, teamMembers } from '@/db'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/page-header'
import { TeamMembersClient } from './team-members-client'

export const metadata = { title: 'Admin · Team page' }
export const dynamic = 'force-dynamic'

export default async function AdminTeamMembersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin/team-members')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Marketing"
        title="Team page"
        description="The people shown on the public /team page. Add members, upload photos, reorder, and toggle visibility. Separate from platform staff accounts."
      />
      <TeamMembersClient
        initial={rows.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          bio: m.bio,
          photoUrl: m.photoUrl,
          linkedinUrl: m.linkedinUrl,
          sortOrder: m.sortOrder,
          active: m.active,
        }))}
      />
    </div>
  )
}
