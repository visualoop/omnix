import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'

import {
  TrustClosing,
  TrustHero,
  TrustPage,
  TrustSection,
  TrustTeamGrid,
  type TrustTeamMember,
} from '@/components/marketing/trust-pages'
import { db, teamMembers } from '@/db'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'
import { getApprovedTeamMemberPhoto } from '@/lib/team-member-media'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/team`

  return {
    title: 'The team building Omnix',
    description:
      'The people behind Omnix, shown only from published records. Photos appear when an approved, rights-cleared image is on file; otherwise the person is listed with initials.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/team'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'The team building Omnix',
      description: 'Meet the people building Omnix — published from the internal team directory.',
      type: 'website',
    }),
  }
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like to talk to the team about Omnix.'

  const persistedMembers = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      role: teamMembers.role,
      bio: teamMembers.bio,
      mediaId: teamMembers.mediaId,
      linkedinUrl: teamMembers.linkedinUrl,
      sortOrder: teamMembers.sortOrder,
    })
    .from(teamMembers)
    .where(eq(teamMembers.active, true))
    .orderBy(asc(teamMembers.sortOrder))
    .catch(() => [])

  const members: TrustTeamMember[] = await Promise.all(
    persistedMembers.map(async (member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      bio: member.bio,
      // Photos resolve through the audited approved-media gate on every render.
      // Raw URLs are rejected at the admin API; only a mediaId reaches here.
      photo: await getApprovedTeamMemberPhoto(member.mediaId),
      linkedinUrl: member.linkedinUrl,
    })),
  )

  return (
    <TrustPage>
      <TrustHero
        kicker="The team"
        title="The people behind"
        accent="Omnix."
        lede="Omnix is built and supported by a small team. This page is generated from the internal team directory, so it only shows people who have been published there."
        factsTitle="How this page works"
        facts={[
          { label: 'Source', value: 'Published internal team directory' },
          { label: 'Photos', value: 'Only approved, rights-cleared images' },
          { label: 'Fallback', value: 'Initials when no approved photo is on file' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="team-directory"
        kicker="Directory"
        title="Who you will be working with."
        intro="Each person below comes from a published team record. Nothing here is placeholder or stock."
      >
        <TrustTeamGrid
          members={members}
          emptyMessage="The published team directory is currently empty. Rather than show invented people, this page stays blank until real members are published. To reach the team now, book a demo or use the configured WhatsApp line."
        />
      </TrustSection>

      <TrustClosing
        kicker="Talk to us"
        title="Prefer to meet the product first? Book a demo."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
