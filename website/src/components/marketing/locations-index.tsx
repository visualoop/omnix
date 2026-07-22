import Link from 'next/link'

import { Icon } from '@/components/icons'
import { type KenyaLocation } from '@/config/locations'

import styles from './locations-index.module.css'

interface LocationsIndexProps {
  locale: string
  locations: KenyaLocation[]
  whatsappUrl?: string | null
}

function whatsappHref(base: string | null | undefined): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I am choosing business software and would like a demo.')
  return `${base}${separator}text=${message}`
}

export function LocationsIndex({ locale, locations, whatsappUrl = null }: LocationsIndexProps) {
  const demoHref = `/${locale}/contact?type=demo`
  const modulesHref = `/${locale}/modules`
  const guidesHref = `/${locale}/guides`
  const whatsapp = whatsappHref(whatsappUrl)
  const hasPublished = locations.length > 0

  return (
    <div className={styles.page} data-locations-index>
      <section className={styles.hero} aria-labelledby="locations-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Buying Omnix · across Kenya</p>
              <h1 id="locations-heading">
                Choosing Omnix, <span>town by town.</span>
              </h1>
              <p className={styles.lede}>
                Omnix is a Windows desktop product bought online and run on your own computer, the
                same wherever you trade. These city guides cover how owners in each town actually
                operate and which of the five products fits. None of them claims a local office.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
                </Link>
                {whatsapp ? (
                  <a
                    className={styles.textAction}
                    href={whatsapp}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
            <aside className={styles.count} aria-label={`${locations.length} city guides published`}>
              <span>{String(locations.length).padStart(2, '0')}</span>
              <span>city guides published</span>
            </aside>
          </div>
        </div>
      </section>

      {hasPublished ? (
        <section className={styles.list} aria-label="City buying guides">
          <div className={styles.container}>
            <div className={styles.rows}>
              {locations.map((location) => (
                <Link
                  key={location.slug}
                  className={styles.row}
                  data-location-row={location.slug}
                  href={`/${locale}/locations/${location.slug}`}
                >
                  <span className={styles.rowKicker}>
                    {location.county} County · {location.region}
                  </span>
                  <span className={styles.rowTitle}>{location.city}</span>
                  <span className={styles.rowSummary}>{location.ogDescription}</span>
                  <span className={styles.rowAction}>
                    Read guide <Icon.ArrowRight aria-hidden weight="bold" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.empty} aria-label="No city guides yet">
          <div className={styles.container}>
            <div className={styles.emptyPanel} data-location-empty>
              <p className={styles.kicker}>City guides in preparation</p>
              <h2>No city guide is published yet.</h2>
              <p className={styles.emptyBody}>
                We only publish a city guide once it has real, checked local detail rather than a
                template with the town name swapped in. While these are being written, the national
                buyer guides and the five product pages cover the same decisions, and a demo answers
                the rest.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
                </Link>
                <Link className={styles.secondaryAction} href={guidesHref}>
                  Read the buyer guides
                </Link>
                <Link className={styles.textAction} href={modulesHref}>
                  Compare the five products
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
