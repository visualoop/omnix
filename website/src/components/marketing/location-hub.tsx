import Link from 'next/link'

import { Icon } from '@/components/icons'
import { type KenyaLocation, locationPricingFacts } from '@/config/locations'

import styles from './location-hub.module.css'

interface LocationHubProps {
  location: KenyaLocation
  locale: string
  whatsappUrl?: string | null
}

const CONTENTS = [
  { id: 'context', label: 'The local picture' },
  { id: 'operating', label: 'How owners run here' },
  { id: 'products', label: 'The five products' },
  { id: 'boundary', label: 'Local and connected' },
  { id: 'facts', label: 'Platform facts' },
  { id: 'evaluation', label: 'Before you decide' },
  { id: 'sources', label: 'Where the facts come from' },
] as const

function whatsappHubHref(whatsappUrl: string | null | undefined, city: string): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent(`Hi Omnix, I run a business in ${city} and would like a demo.`)
  return `${whatsappUrl}${separator}text=${message}`
}

export function LocationHub({ location, locale, whatsappUrl = null }: LocationHubProps) {
  const demoHref = `/${locale}/contact?type=demo`
  const locationsHref = `/${locale}/locations`
  const guidesHref = `/${locale}/guides`
  const whatsappHref = whatsappHubHref(whatsappUrl, location.city)
  const facts = locationPricingFacts()

  return (
    <article className={styles.page} data-location-hub={location.slug}>
      <section className={styles.hero} aria-labelledby="location-heading">
        <div className={styles.container}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <Link href={locationsHref}>Locations</Link>
            <span aria-hidden>/</span>
            <span>{location.city}</span>
          </nav>

          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>{location.kicker}</p>
              <h1 id="location-heading">
                {location.title} <span>{location.titleAccent}</span>
              </h1>
              <p className={styles.lede}>{location.intro}</p>
              <div className={styles.actions} data-location-actions>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
                </Link>
                {whatsappHref ? (
                  <a
                    className={styles.secondaryAction}
                    href={whatsappHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon.WhatsApp aria-hidden weight="bold" /> Ask on WhatsApp
                  </a>
                ) : null}
              </div>
            </div>

            <aside className={styles.disclaimer} data-location-disclaimer aria-label="What this page is">
              <p className={styles.disclaimerTag}>Buying guide · not a local office</p>
              <p className={styles.disclaimerBody}>
                This is a buying guide for businesses in {location.city}. Omnix is a Windows desktop
                product you buy online and run on your own computer. We do not operate a local
                office, branch or sales team in {location.city}; support and setup are handled
                remotely.
              </p>
              <ul className={styles.factRow}>
                <li>
                  <span>County</span>
                  {location.county}
                </li>
                <li>
                  <span>Region</span>
                  {location.region}
                </li>
              </ul>
            </aside>
          </div>

          <nav aria-label="On this page" className={styles.contents}>
            <ol>
              {CONTENTS.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <section className={styles.context} id="context" aria-labelledby="context-title">
        <div className={styles.container}>
          <div className={styles.splitGrid}>
            <header>
              <p className={styles.kicker}>The local picture</p>
              <h2 id="context-title">
                {location.city}, {location.county} County.
              </h2>
              <p>{location.contextIntro}</p>
            </header>
            <ul className={styles.pointList}>
              {location.contextPoints.map((point) => (
                <li key={point}>
                  <Icon.MapPin aria-hidden weight="bold" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.operating} id="operating" aria-labelledby="operating-title">
        <div className={styles.container}>
          <div className={styles.splitGrid}>
            <header>
              <p className={styles.kicker}>How owners run here</p>
              <h2 id="operating-title">The way {location.city} counters actually trade.</h2>
              <p>{location.operatingIntro}</p>
            </header>
            <ul className={styles.pointList}>
              {location.operatingPatterns.map((pattern) => (
                <li key={pattern}>
                  <Icon.Storefront aria-hidden weight="bold" />
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.products} id="products" aria-labelledby="products-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>The five products</p>
              <h2 id="products-title">Which one fits your {location.city} counter.</h2>
            </div>
            <p>{location.productIntro}</p>
          </header>
          <ul className={styles.productList}>
            {location.products.map((product) => (
              <li key={product.id} className={styles.productItem} data-location-product={product.id}>
                <div className={styles.productCopy}>
                  <h3>{product.label}</h3>
                  <p>{product.localWorkflow}</p>
                </div>
                <div className={styles.productLinks}>
                  <Link
                    className={styles.productLink}
                    href={`/${locale}${product.path}`}
                    data-location-product-link
                  >
                    View {product.label} <Icon.ArrowRight aria-hidden weight="bold" />
                  </Link>
                  <Link
                    className={styles.productDemo}
                    href={`/${locale}/contact?type=demo&product=${product.demoProduct}`}
                  >
                    Book a demo
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.boundary} id="boundary" aria-labelledby="boundary-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Local and connected</p>
              <h2 id="boundary-title">What runs on the device, what needs the line.</h2>
            </div>
            <p>{location.boundaryIntro}</p>
          </header>
          <div className={styles.boundaryGrid}>
            <div className={styles.boundaryColumn}>
              <h3 className={styles.columnLabel}>
                <Icon.Desktop aria-hidden weight="bold" /> Works on the device
              </h3>
              <ul>
                {location.local.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.boundaryColumn} data-column="connected">
              <h3 className={styles.columnLabel}>
                <Icon.Globe aria-hidden weight="bold" /> Needs a connection
              </h3>
              <ul>
                {location.connected.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.facts} id="facts" aria-labelledby="facts-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Platform facts</p>
              <h2 id="facts-title">The same platform facts, wherever you are.</h2>
            </div>
            <p>
              These hold for every Omnix product in {location.city} and everywhere else. The licence
              is a one-time purchase; the update plan is a separate, optional choice.
            </p>
          </header>
          <dl className={styles.factList}>
            <div>
              <dt>Platform</dt>
              <dd>Windows desktop (Windows 10 or 11, 64-bit)</dd>
            </div>
            <div>
              <dt>How you get it</dt>
              <dd>Bought online, downloaded from the customer dashboard, activated per device</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>{facts.oneTime} one-time, per device, perpetual</dd>
            </div>
            <div>
              <dt>Compliance updates</dt>
              <dd>
                Optional {facts.maintenanceYearly} per year, not required to keep the licence working
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.evaluation} id="evaluation" aria-labelledby="evaluation-title">
        <div className={styles.container}>
          <div className={styles.splitGrid}>
            <header>
              <p className={styles.kicker}>Before you decide</p>
              <h2 id="evaluation-title">Questions worth asking from {location.city}.</h2>
              <p>{location.evaluationIntro}</p>
            </header>
            <ul className={styles.questionList}>
              {location.evaluationPoints.map((point) => (
                <li key={point}>
                  <Icon.Question aria-hidden weight="bold" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.sources} id="sources" aria-labelledby="sources-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Where the facts come from</p>
              <h2 id="sources-title">Local claims, and their basis.</h2>
            </div>
            <p>
              Every factual claim about {location.city} on this page is listed here with its source,
              so you can check it rather than take our word for it.
            </p>
          </header>
          <ul className={styles.sourceList}>
            {location.sources.map((source) => (
              <li key={source.claim}>
                <p className={styles.sourceClaim}>{source.claim}</p>
                <p className={styles.sourceNote}>{source.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.kicker}>Ready to look at the software</p>
              <h2>See it running before you buy.</h2>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
              <Link className={styles.textAction} href={guidesHref}>
                Read the buyer guides
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  )
}
