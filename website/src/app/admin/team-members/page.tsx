import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { asc, count, ilike, or } from 'drizzle-orm'
import { PageHeader } from '@/components/layout/page-header'
import { db, teamMembers } from '@/db'
import { auth } from '@/lib/auth'
import { getApprovedTeamMemberPhoto } from '@/lib/team-member-media'
import { listApprovedMediaPhotos } from '@/lib/media-slots'
import { TeamMembersClient } from './team-members-client'

export const metadata = { title: 'Admin · Team page' }
export const dynamic = 'force-dynamic'

// Two independent growing collections share this page, so each gets its own
// bounded page + query namespace (memberPage/memberQ, mediaPage/mediaQ).
const MEMBER_PAGE_SIZE = 8
const MEDIA_PAGE_SIZE = 6

export default async function AdminTeamMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ memberPage?: string; memberQ?: string; mediaPage?: string; mediaQ?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?next=/admin/team-members')
  if (session.user.role !== 'platform_admin') redirect('/admin')

  const sp = await searchParams
  const memberPage = Math.max(1, parseInt(sp.memberPage ?? '1', 10) || 1)
  const memberQ = sp.memberQ?.trim() ?? ''
  const mediaPage = Math.max(1, parseInt(sp.mediaPage ?? '1', 10) || 1)
  const mediaQ = sp.mediaQ?.trim() ?? ''

  const memberWhere = memberQ
    ? or(
        ilike(teamMembers.name, `%${memberQ}%`),
        ilike(teamMembers.role, `%${memberQ}%`),
        ilike(teamMembers.bio, `%${memberQ}%`),
      )
    : undefined

  const [rows, memberTotalRow, mediaCandidates] = await Promise.all([
    db
      .select()
      .from(teamMembers)
      .where(memberWhere)
      .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name))
      .limit(MEMBER_PAGE_SIZE)
      .offset((memberPage - 1) * MEMBER_PAGE_SIZE),
    db.select({ n: count() }).from(teamMembers).where(memberWhere),
    listApprovedMediaPhotos({ q: mediaQ, limit: MEDIA_PAGE_SIZE, offset: (mediaPage - 1) * MEDIA_PAGE_SIZE }),
  ])

  const memberTotal = memberTotalRow[0]?.n ?? 0

  // Resolve each visible member's bound photo through the approval gate so
  // the roster preview matches exactly what the public /team page renders.
  const memberPhotos = await Promise.all(rows.map((member) => getApprovedTeamMemberPhoto(member.mediaId)))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Marketing"
        title="Team page"
        description="The people shown on the public /team page. Photos come only from the approved licensed-media register; rejected or withdrawn assets disappear automatically."
      />
      <TeamMembersClient
        approvedMedia={mediaCandidates.rows.map((media) => ({
          id: media.id,
          url: media.url,
          alt: media.alt,
          filename: media.filename,
        }))}
        mediaTotal={mediaCandidates.total}
        mediaPage={mediaPage}
        mediaPageSize={MEDIA_PAGE_SIZE}
        mediaQuery={mediaQ}
        memberTotal={memberTotal}
        memberPage={memberPage}
        memberPageSize={MEMBER_PAGE_SIZE}
        memberQuery={memberQ}
        initial={rows.map((member, i) => {
          const photo = memberPhotos[i]
          return {
            id: member.id,
            name: member.name,
            role: member.role,
            bio: member.bio,
            mediaId: photo?.id ?? null,
            photoUrl: photo?.url ?? null,
            photoAlt: photo?.alt ?? null,
            linkedinUrl: member.linkedinUrl,
            sortOrder: member.sortOrder,
            active: member.active,
          }
        })}
      />
    </div>
  )
}
