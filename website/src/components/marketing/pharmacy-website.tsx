import Link from 'next/link'

import { ModuleDemoVideo, type ModuleDemoVideoContent } from './module-demo-video'
import { DecorativeVideo } from './decorative-video'
import styles from './pharmacy-website.module.css'

export interface PharmacyMedia {
  url: string
  alt: string
}

export interface PharmacyVideo extends PharmacyMedia {
  mimeType: string
  posterUrl: string
}

interface PharmacyWebsiteProps {
  locale: string
  heroImage?: PharmacyMedia | null
  heroVideo?: PharmacyVideo | null
  demoVideo?: ModuleDemoVideoContent | null
  whatsappUrl?: string | null
}

export const PHARMACY_CAPABILITIES = [
  {
    title: 'Dispensing and patient records',
    body: 'Capture prescriptions with patient and prescriber details, add medicines, review patient history, and take the prepared prescription into checkout.',
  },
  {
    title: 'Batch and expiry stock',
    body: 'Receive stock with batch numbers and expiry dates, see expiring items, and use available non-expired batches during a sale.',
  },
  {
    title: 'Controlled register',
    body: 'Keep controlled-medicine entries with the medicine, patient, batch, quantity, prescriber, and dispenser details used by the pharmacy.',
  },
  {
    title: 'Pharmacy POS and M-Pesa',
    body: 'Sell prescription and over-the-counter items through the same pharmacy POS. Use a configured M-Pesa provider, including STK push, or record another payment method.',
  },
  {
    title: 'KRA eTIMS sales records',
    body: 'Send configured sales through the KRA eTIMS workflow. If submission cannot complete, queued invoices can be retried when the connection returns.',
  },
  {
    title: 'SHA and private insurance',
    body: 'Work with configured SHA or private insurance providers, claim details, covered amounts, and patient copay at the point of dispensing.',
  },
] as const

const WORKFLOW = [
  {
    marker: 'Stock in',
    title: 'Receive by batch',
    body: 'Record the supplier, quantity, buying price, batch number, and expiry date as medicines arrive.',
  },
  {
    marker: 'Dispensary',
    title: 'Prepare the prescription',
    body: 'Keep patient, prescriber, medicine, dosage, and refill details together before payment.',
  },
  {
    marker: 'Counter',
    title: 'Take payment and issue the sale',
    body: 'Move the prepared items into the pharmacy POS, choose the payment method, and complete the sale.',
  },
  {
    marker: 'Day end',
    title: 'Review one operating record',
    body: 'Read sales, payments, stock movement, prescriptions, and pharmacy registers from the work already recorded.',
  },
] as const

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to see the Pharmacy product in a demo.')
  return `${whatsappUrl}${separator}text=${message}`
}

export function PharmacyWebsite({
  locale,
  heroImage = null,
  heroVideo = null,
  demoVideo = null,
  whatsappUrl = null,
}: PharmacyWebsiteProps) {
  const demoHref = `/${locale}/contact?type=demo&product=pharmacy`
  const whatsappHref = whatsappDemoHref(whatsappUrl)
  const hasApprovedMedia = Boolean(heroVideo || heroImage)

  return (
    <div className={styles.page} data-pharmacy-website>
      <section className={styles.hero} data-pharmacy-section aria-labelledby="pharmacy-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.overline}>Omnix Pharmacy</p>
              <h1 id="pharmacy-heading">Pharmacy software for the counter and dispensary.</h1>
              <p className={styles.heroLede}>
                Keep dispensing, pharmacy POS sales, batch and expiry stock, prescriptions, patient records, and the controlled register in one local working record.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a pharmacy demo
                </Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
              <dl className={styles.scopeLine} aria-label="Pharmacy workflow coverage">
                <div>
                  <dt>At the dispensary</dt>
                  <dd>Prescription and patient details</dd>
                </div>
                <div>
                  <dt>On the shelf</dt>
                  <dd>Batch and expiry stock</dd>
                </div>
                <div>
                  <dt>At the till</dt>
                  <dd>Pharmacy POS and payments</dd>
                </div>
              </dl>
            </div>

            <figure className={styles.heroMedia} data-media-state={hasApprovedMedia ? 'approved' : 'empty'}>
              {heroVideo ? (
                // Approved decorative motion — muted, poster-backed, with the
                // sr-only text alternative below; playback honors reduced motion.
                <DecorativeVideo
                  src={heroVideo.url}
                  type={heroVideo.mimeType}
                  poster={heroVideo.posterUrl}
                  srLabel={heroVideo.alt}
                  preloadPoster
                />
              ) : heroImage ? (
                // Approved records reach this component only through the Task 8 media resolver.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage.url} alt={heroImage.alt} width={960} height={720} />
              ) : (
                <div className={styles.mediaFallback}>
                  <div>
                    <span className={styles.fallbackLabel}>Your demo docket</span>
                    <p>Bring one prescription and a recent stock delivery.</p>
                  </div>
                  <ul>
                    <li>Receive a batch with an expiry date</li>
                    <li>Prepare a prescription for checkout</li>
                    <li>Take payment at the pharmacy POS</li>
                    <li>Review the resulting records</li>
                  </ul>
                  <span className={styles.fallbackNote}>No unapproved image substituted</span>
                </div>
              )}
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.demoVideo} data-pharmacy-section aria-label="Pharmacy product demo video">
        <div className={styles.container}>
          <ModuleDemoVideo
            product="pharmacy"
            productLabel="Pharmacy"
            content={demoVideo}
            bookDemoHref={demoHref}
            locale={locale}
          />
        </div>
      </section>

      <section className={styles.workflow} data-pharmacy-section aria-labelledby="workflow-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.overline}>One pharmacy working flow</p>
              <h2 id="workflow-heading">From receiving stock to closing the day.</h2>
            </div>
            <p>Each step writes into the same stock and sales record instead of leaving a separate list to reconcile later.</p>
          </header>

          <ol className={styles.workflowList}>
            {WORKFLOW.map((item) => (
              <li key={item.marker}>
                <span>{item.marker}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.capabilities} data-pharmacy-section aria-labelledby="capabilities-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.overline}>What the Pharmacy product covers</p>
              <h2 id="capabilities-heading">The records behind each dispense and sale.</h2>
            </div>
            <p>Start with the pharmacy workflow you use today. We will show the matching screens and configuration in the demo.</p>
          </header>

          <div className={styles.capabilityGrid}>
            {PHARMACY_CAPABILITIES.map((capability) => (
              <article key={capability.title}>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.boundary} data-pharmacy-section aria-labelledby="boundary-heading">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div>
              <p className={styles.overline}>Built for unreliable connectivity</p>
              <h2 id="boundary-heading">The pharmacy record stays on the shop computer.</h2>
            </div>
            <div className={styles.boundaryCopy}>
              <p>Core sales, stock, prescription, and patient work uses the local desktop database. Internet-connected services such as M-Pesa, KRA eTIMS submission, and online insurance checks need a working connection.</p>
              <p>Omnix provides software workflows and recordkeeping tools. Your pharmacy remains responsible for its configuration, operating procedures, and statutory obligations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} data-pharmacy-section aria-labelledby="pharmacy-closing-heading">
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.overline}>See it with a real pharmacy task</p>
              <h2 id="pharmacy-closing-heading">Bring the workflow you want to replace.</h2>
              <p>We will use the demo to walk through dispensing, stock, payment, and recordkeeping around the way your pharmacy operates.</p>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a pharmacy demo
              </Link>
              {whatsappHref ? (
                <a className={styles.textAction} href={whatsappHref} rel="noreferrer">
                  Ask on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
