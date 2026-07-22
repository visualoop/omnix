import Link from 'next/link'

import { ModuleDemoVideo, type ModuleDemoVideoContent } from './module-demo-video'
import { DecorativeVideo } from './decorative-video'
import styles from './salon-website.module.css'

export interface SalonMedia {
  url: string
  alt: string
}

export interface SalonVideo extends SalonMedia {
  mimeType: string
  posterUrl: string
}

interface SalonWebsiteProps {
  locale: string
  heroImage?: SalonMedia | null
  heroVideo?: SalonVideo | null
  demoVideo?: ModuleDemoVideoContent | null
  whatsappUrl?: string | null
}

export const SALON_CAPABILITIES = [
  {
    title: 'Appointment diary',
    body: 'Read the day or week by staff member, book one or more services, and move each visit through booked, confirmed, checked in, in service, completed, no-show, or cancelled.',
  },
  {
    title: 'Services and staff skills',
    body: 'Keep each service’s duration, price, category, room requirement, and commission rule, then record which staff members can perform it.',
  },
  {
    title: 'Chairs, rooms, beds, and stations',
    body: 'Assign a bookable resource to an appointment and check both staff and resource availability before the visit is saved.',
  },
  {
    title: 'Client notes and visit history',
    body: 'Keep preferences, allergies, formulas, and salon notes with the client, then review completed visits from the same local record.',
  },
  {
    title: 'Packages and memberships',
    body: 'Sell a prepaid service package through POS, keep its session balance and optional expiry, and redeem an eligible session when the appointment is checked out.',
  },
  {
    title: 'Appointment checkout',
    body: 'Load the appointment’s services into POS, attach the client, add eligible retail products or a tip, take an available payment, and link the completed sale back to the visit.',
  },
  {
    title: 'Commission records',
    body: 'Accrue service commission at checkout, review earned, paid, and outstanding amounts by staff member, and record commission payouts against the covered lines.',
  },
  {
    title: 'Products used during services',
    body: 'Map professional products such as colour, wax, or oil to a service so configured back-bar quantities are deducted from available batches after checkout.',
  },
] as const

const APPOINTMENT_FLOW = [
  {
    label: 'Book',
    title: 'Choose the client, service, staff, time, and resource.',
    body: 'The end time follows the selected services. Conflicting staff or resource bookings are stopped before the appointment is stored.',
  },
  {
    label: 'Arrive',
    title: 'Move the visit from confirmed to checked in.',
    body: 'The diary keeps the appointment status, service lines, client, staff member, resource, and notes together.',
  },
  {
    label: 'Serve',
    title: 'Open the client record while the service is in progress.',
    body: 'Preferences, allergies, formulas, prior completed visits, and available package sessions remain available to the team.',
  },
  {
    label: 'Checkout',
    title: 'Send the visit to POS and close the appointment.',
    body: 'Payment completes through the normal sale flow; the visit, commission lines, package redemption, and configured stock use are then linked to that sale.',
  },
] as const

function salonWhatsAppHref(url: string | null | undefined): string | null {
  if (!url) return null
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}text=${encodeURIComponent('Hi Omnix, I would like to book a Salon & Spa demo.')}`
}

function SalonMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M10 15.5C10 10.8 13.7 8 18.4 8c5.2 0 8.6 3.1 8.6 7.3 0 9.2-16.8 7.1-16.8 16.4 0 4.9 4 8.3 10.2 8.3 7.1 0 11.6-4 11.6-9.7" />
      <path d="M38 32.5C38 37.2 34.3 40 29.6 40c-5.2 0-8.6-3.1-8.6-7.3 0-9.2 16.8-7.1 16.8-16.4C37.8 11.4 33.8 8 27.6 8 20.5 8 16 12 16 17.7" />
    </svg>
  )
}

export function SalonWebsite({
  locale,
  heroImage = null,
  heroVideo = null,
  demoVideo = null,
  whatsappUrl = null,
}: SalonWebsiteProps) {
  const demoHref = `/${locale}/contact?type=demo&product=salon`
  const whatsappHref = salonWhatsAppHref(whatsappUrl)
  const hasApprovedMedia = Boolean(heroVideo || heroImage)
  const isKenya = locale === 'ke'

  return (
    <div className={styles.page} data-salon-website>
      <section className={styles.hero} data-salon-section aria-labelledby="salon-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.identity}><SalonMark /><p>Omnix Salon &amp; Spa</p></div>
              <h1 id="salon-heading">A clear day book for every chair.</h1>
              <p className={styles.lede}>Windows desktop software for salons, spas, barber shops, and beauty studios: appointments, services, staff skills, client history, packages, commissions, checkout, and stock kept in one local working record.</p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>Book a Salon &amp; Spa demo</Link>
                {whatsappHref ? <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a> : null}
              </div>
              <p className={styles.localNote}>Appointments are entered by your team in the salon. Public internet self-booking is not included.</p>
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
                // Only approved Task 8 module.salon media reaches this component.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage.url} alt={heroImage.alt} width={960} height={720} />
              ) : (
                <div className={styles.demoDocket}>
                  <header><SalonMark /><div><h2>Set the diary for your demo.</h2><p>Bring one working day. We will trace it from booking to checkout.</p></div></header>
                  <dl>
                    <div><dt>Diary</dt><dd>Two staff members and three sample visits</dd></div>
                    <div><dt>Services</dt><dd>Duration, price, and staff skill</dd></div>
                    <div><dt>Space</dt><dd>One chair, room, bed, or station</dd></div>
                    <div><dt>Checkout</dt><dd>A package, commission, or product example</dd></div>
                  </dl>
                  <small>No unapproved image substituted</small>
                </div>
              )}
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.demoVideo} data-salon-section aria-label="Salon and Spa product demo video">
        <div className={styles.container}>
          <ModuleDemoVideo
            product="salon"
            productLabel="Salon &amp; Spa"
            content={demoVideo}
            bookDemoHref={demoHref}
            locale={locale}
          />
        </div>
      </section>

      <section className={styles.daybook} data-salon-section aria-labelledby="daybook-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <h2 id="daybook-heading">See the day as time, people, and space.</h2>
            <p>The desktop diary has day and week views. The map below explains the working record without pretending to be a live booking screen.</p>
          </header>
          <div className={styles.scheduleMap} aria-label="Example salon day showing appointment time, staff lane, service, and resource">
            <div className={styles.timeRail} aria-hidden="true"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span></div>
            <div className={styles.staffLane}>
              <h3>Stylist lane</h3>
              <article className={styles.appointmentOne}><strong>Hair service</strong><span>Client · Chair</span></article>
              <article className={styles.appointmentTwo}><strong>Colour service</strong><span>Client · Station</span></article>
            </div>
            <div className={styles.staffLane}>
              <h3>Therapist lane</h3>
              <article className={styles.appointmentThree}><strong>Body treatment</strong><span>Client · Room</span></article>
              <article className={styles.appointmentFour}><strong>Facial service</strong><span>Client · Bed</span></article>
            </div>
            <div className={styles.mapLegend}><span><i />Booked</span><span><i />In service</span><span><i />Resource checked</span></div>
          </div>
        </div>
      </section>

      <section className={styles.flow} data-salon-section aria-labelledby="flow-heading">
        <div className={styles.container}>
          <div className={styles.flowGrid}>
            <div className={styles.flowIntro}><SalonMark /><h2 id="flow-heading">One appointment, from first entry to paid visit.</h2><p>The visit remains the organising record. POS closes it instead of starting a separate, disconnected transaction.</p></div>
            <div className={styles.flowList}>{APPOINTMENT_FLOW.map((item) => <article key={item.label}><span>{item.label}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div>
          </div>
        </div>
      </section>

      <section className={styles.capabilities} data-salon-section aria-labelledby="capabilities-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}><h2 id="capabilities-heading">What sits behind the diary.</h2><p>Choose the records that matter to your salon and use them as the agenda for the demo.</p></header>
          <div className={styles.capabilityGrid}>{SALON_CAPABILITIES.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
        </div>
      </section>

      <section className={styles.boundary} data-salon-section aria-labelledby="boundary-heading">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div><h2 id="boundary-heading">Local booking stays available. Connected services do not pretend to be offline.</h2></div>
            <div className={styles.boundaryCopy}>
              <p>Appointments entered by salon staff, day and week diary views, cash checkout, services, client profiles, packages, commissions, resources, and stock records use the local desktop database and do not depend on an online booking service.</p>
              <p>Omnix Salon &amp; Spa does not currently provide a public website where clients book their own appointments. Phone, walk-in, or messaging requests must be entered into the local diary by your team.</p>
              {isKenya ? <p>Configured M-Pesa requests and KRA eTIMS submission require internet access, valid provider details, and the correct business setup. The sale is stored locally; an eTIMS attempt that cannot complete can remain queued for retry.</p> : <p>Online payment and tax connections are available only where Omnix supports the provider and your business has completed the required setup. Ask the team what is available in your market.</p>}
              <p>Your business remains responsible for service and product setup, prices and tax treatment, client-note handling, staff access, commission rules, package terms, stock quantities, connectivity, provider accounts, and its statutory obligations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} data-salon-section aria-labelledby="closing-heading">
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div><SalonMark /><h2 id="closing-heading">Bring tomorrow’s appointment sheet.</h2><p>We will map your services, staff, spaces, client notes, packages, checkout, and commission rules against a real salon day.</p></div>
            <div className={styles.closingActions}><Link className={styles.primaryAction} href={demoHref}>Book a Salon &amp; Spa demo</Link>{whatsappHref ? <a className={styles.textAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a> : null}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
