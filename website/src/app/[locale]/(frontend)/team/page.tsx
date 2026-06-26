import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { getSiteSettings } from '@/lib/site-settings'
import { db, teamMembers } from '@/db'

export const metadata: Metadata = {
  title: 'Team — the people building Omnix',
  description: 'Meet the team building Omnix — the POS with M-Pesa for Kenyan businesses. A small team in Nairobi.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 300

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function TeamPage() {
  const settings = await getSiteSettings()
  const members = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.active, true))
    .orderBy(asc(teamMembers.sortOrder))
    .catch(() => [])

  return (
    <>
      <PageHero
        eyebrow="Team"
        title={<>The people <em>behind Omnix.</em></>}
        description="A small team in Nairobi building the POS Kenyan businesses actually want — M-Pesa, eTIMS, offline-first."
      />

      <section className="section">
        <div className="container-default">
          {members.length === 0 ? (
            <p className="text-center text-[15px] text-[var(--color-fg-muted)]">
              We&rsquo;re assembling the team page. Check back soon.
            </p>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <li key={m.id} className="flex flex-col">
                  <div className="aspect-[3/2] w-full overflow-hidden rounded-xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photoUrl}
                        alt={m.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-5xl text-[var(--color-fg-subtle)]">
                        {initials(m.name)}
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
                      {m.name}
                    </h3>
                    <p className="caption-mono mt-1">{m.role}</p>
                    {m.bio && (
                      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                        {m.bio}
                      </p>
                    )}
                    {m.linkedinUrl && (
                      <a
                        href={m.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-[13px] text-[var(--color-accent)] hover:underline"
                      >
                        LinkedIn →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ClosingCtaSection whatsappUrl={settings.whatsappUrl} />
    </>
  )
}
