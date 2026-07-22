/* Hallmark · buyer brief primitives · demo-led acquisition · explicit responsibility boundaries */
import type { ReactNode } from 'react'
import Link from 'next/link'

import { Icon } from '@/components/icons'

import styles from './trust-pages.module.css'

export interface TrustFact {
  label: string
  value: ReactNode
}

export interface BoundaryItem {
  owner: string
  title: string
  body: string
}

export function buildWhatsAppHref(base: string | null, message: string): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent(message)}`
}

export function TrustActions({
  locale,
  whatsappUrl,
  whatsappMessage,
  demoLabel = 'Book a demo',
}: {
  locale: string
  whatsappUrl: string | null
  whatsappMessage: string
  demoLabel?: string
}) {
  const whatsappHref = buildWhatsAppHref(whatsappUrl, whatsappMessage)

  return (
    <div className={styles.actions} data-trust-actions>
      <Link className={styles.primaryAction} href={`/${locale}/contact?type=demo`}>
        {demoLabel}
        <Icon.ArrowRight aria-hidden className={styles.actionIcon} weight="bold" />
      </Link>
      {whatsappHref ? (
        <a
          className={styles.secondaryAction}
          href={whatsappHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          Ask on WhatsApp
        </a>
      ) : null}
    </div>
  )
}

export function TrustHero({
  kicker,
  title,
  accent,
  lede,
  factsTitle,
  facts,
  locale,
  whatsappUrl,
  whatsappMessage,
  demoLabel,
}: {
  kicker: string
  title: string
  accent: string
  lede: string
  factsTitle: string
  facts: readonly TrustFact[]
  locale: string
  whatsappUrl: string | null
  whatsappMessage: string
  demoLabel?: string
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{kicker}</p>
            <h1>{title} <span>{accent}</span></h1>
            <p className={styles.lede}>{lede}</p>
            <TrustActions
              demoLabel={demoLabel}
              locale={locale}
              whatsappMessage={whatsappMessage}
              whatsappUrl={whatsappUrl}
            />
          </div>

          <aside className={styles.factDocket} aria-labelledby="trust-facts-title">
            <p className={styles.docketLabel}>Buyer check</p>
            <h2 id="trust-facts-title">{factsTitle}</h2>
            <dl>
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  )
}

export function TrustSectionHeading({
  kicker,
  title,
  body,
  id,
}: {
  kicker: string
  title: string
  body: string
  id: string
}) {
  return (
    <header className={styles.sectionHeading}>
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{body}</p>
    </header>
  )
}

export function BoundaryLedger({
  title,
  intro,
  items,
}: {
  title: string
  intro: string
  items: readonly BoundaryItem[]
}) {
  return (
    <section className={styles.boundaries} aria-labelledby="boundary-ledger-title">
      <div className={styles.container}>
        <div className={styles.boundaryGrid}>
          <header>
            <p className={styles.kicker}>Responsibility ledger</p>
            <h2 id="boundary-ledger-title">{title}</h2>
            <p>{intro}</p>
          </header>
          <div className={styles.boundaryRows}>
            {items.map((item) => (
              <article key={item.owner}>
                <p>{item.owner}</p>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function TrustClosing({
  kicker,
  title,
  locale,
  whatsappUrl,
  whatsappMessage,
  demoLabel,
}: {
  kicker: string
  title: string
  locale: string
  whatsappUrl: string | null
  whatsappMessage: string
  demoLabel?: string
}) {
  return (
    <section className={styles.closing}>
      <div className={styles.container}>
        <div className={styles.closingPanel}>
          <div>
            <p className={styles.kicker}>{kicker}</p>
            <h2>{title}</h2>
          </div>
          <TrustActions
            demoLabel={demoLabel}
            locale={locale}
            whatsappMessage={whatsappMessage}
            whatsappUrl={whatsappUrl}
          />
        </div>
      </div>
    </section>
  )
}

export function TrustPage({ children }: { children: ReactNode }) {
  // The (frontend) layout already owns the <main> landmark, so this is a
  // plain shell that carries the light-first Working Counter surface tokens.
  return (
    <div className={styles.page} data-trust-page>
      {children}
    </div>
  )
}

export function TrustSection({
  id,
  kicker,
  title,
  intro,
  alt = false,
  children,
}: {
  id?: string
  kicker?: string
  title?: string
  intro?: string
  alt?: boolean
  children: ReactNode
}) {
  return (
    <section className={alt ? styles.contentSectionAlt : styles.contentSection}>
      <div className={styles.container}>
        {title ? (
          <header className={styles.sectionHeading}>
            <div>
              {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
              <h2 id={id}>{title}</h2>
            </div>
            {intro ? <p>{intro}</p> : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  )
}

export function TrustProse({ paragraphs }: { paragraphs: readonly ReactNode[] }) {
  return (
    <div className={styles.bodyCopy}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

export interface TrustListItem {
  term: string
  detail: ReactNode
}

export function TrustList({ items }: { items: readonly TrustListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.term}>
          <h3>{item.term}</h3>
          <p>{item.detail}</p>
        </li>
      ))}
    </ul>
  )
}

export interface TrustChannel {
  title: string
  body: string
  href: string | null
  linkLabel: string
  external?: boolean
}

export function TrustChannelGrid({ channels }: { channels: readonly TrustChannel[] }) {
  return (
    <ul className={styles.routeList}>
      {channels.map((channel) => (
        <li key={channel.title}>
          <h3>{channel.title}</h3>
          <p>{channel.body}</p>
          {channel.href ? (
            channel.external ? (
              <a
                className={styles.routeLink}
                href={channel.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {channel.linkLabel}
                <Icon.ArrowRight aria-hidden weight="bold" />
              </a>
            ) : (
              <Link className={styles.routeLink} href={channel.href}>
                {channel.linkLabel}
                <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
            )
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export interface TrustTeamMember {
  id: string
  name: string
  role: string
  bio?: string | null
  photo?: { url: string; alt: string } | null
  linkedinUrl?: string | null
}

function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function TrustTeamGrid({
  members,
  emptyMessage,
}: {
  members: readonly TrustTeamMember[]
  emptyMessage: string
}) {
  if (members.length === 0) {
    return <p className={styles.emptyState}>{emptyMessage}</p>
  }

  return (
    <div className={styles.teamGrid}>
      {members.map((member) => (
        <article key={member.id} className={styles.teamCard}>
          <div className={styles.teamMedia} aria-hidden={member.photo ? undefined : true}>
            {member.photo ? (
              // The URL is produced only by the audited approved-media resolver.
              // Explicit 4:3 dimensions match the .teamMedia aspect-ratio box so
              // the card reserves space before the photo loads (no CLS);
              // object-fit: cover in CSS fills the box.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photo.url} alt={member.photo.alt} width={800} height={600} loading="lazy" />
            ) : (
              teamInitials(member.name)
            )}
          </div>
          <div className={styles.teamCopy}>
            <h3>{member.name}</h3>
            <p className={styles.teamRole}>{member.role}</p>
            {member.bio ? <p>{member.bio}</p> : null}
            {member.linkedinUrl ? (
              <a
                className={styles.teamLink}
                href={member.linkedinUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn
                <Icon.ArrowRight aria-hidden weight="bold" />
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export function TrustFormLayout({
  intro,
  children,
}: {
  intro: readonly ReactNode[]
  children: ReactNode
}) {
  return (
    <div className={styles.formGrid}>
      <TrustProse paragraphs={intro} />
      <div className={styles.formPanel}>{children}</div>
    </div>
  )
}

export { styles as trustPageStyles }
