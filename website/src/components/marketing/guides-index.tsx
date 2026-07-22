import Link from 'next/link'

import { Icon } from '@/components/icons'
import { type BuyerGuide } from '@/config/guides'

import styles from './guides-index.module.css'

interface GuidesIndexProps {
  locale: string
  guides: BuyerGuide[]
  whatsappUrl?: string | null
}

function whatsappHref(base: string | null | undefined): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I am choosing business software and would like a demo.')
  return `${base}${separator}text=${message}`
}

export function GuidesIndex({ locale, guides, whatsappUrl = null }: GuidesIndexProps) {
  const demoHref = `/${locale}/contact?type=demo`
  const modulesHref = `/${locale}/modules`
  const whatsapp = whatsappHref(whatsappUrl)

  return (
    <div className={styles.page} data-guides-index>
      <section className={styles.hero} aria-labelledby="guides-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Buyer guides · Kenya</p>
              <h1 id="guides-heading">
                Choosing business software, <span>decision by decision.</span>
              </h1>
              <p className={styles.lede}>
                Short, honest guides for the software questions Kenyan owners actually search. Each
                one walks the workflow, marks what works offline, states the licence facts and asks
                the questions worth putting to any vendor.
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
            <aside className={styles.count} aria-label={`${guides.length} guides`}>
              <span>{String(guides.length).padStart(2, '0')}</span>
              <span>guides · updated for Kenya</span>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.list} aria-label="Buyer guides">
        <div className={styles.container}>
          <div className={styles.rows}>
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                className={styles.row}
                data-guide-row={guide.slug}
                href={`/${locale}/guides/${guide.slug}`}
              >
                <span className={styles.rowKicker}>{guide.kicker}</span>
                <span className={styles.rowTitle}>
                  {guide.title} {guide.titleAccent}
                </span>
                <span className={styles.rowSummary}>{guide.ogDescription}</span>
                <span className={styles.rowAction}>
                  Read guide <Icon.ArrowRight aria-hidden weight="bold" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.kicker}>Ready to look at the product</p>
              <h2>See the one that fits your counter.</h2>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
              <Link className={styles.secondaryAction} href={modulesHref}>
                Compare the five products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
