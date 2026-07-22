import Link from 'next/link'

import { ModuleDemoVideo, type ModuleDemoVideoContent } from './module-demo-video'
import { DecorativeVideo } from './decorative-video'
import styles from './hospitality-website.module.css'

export interface HospitalityMedia {
  url: string
  alt: string
}

export interface HospitalityVideo extends HospitalityMedia {
  mimeType: string
  posterUrl: string
}

interface HospitalityWebsiteProps {
  locale: string
  heroImage?: HospitalityMedia | null
  heroVideo?: HospitalityVideo | null
  demoVideo?: ModuleDemoVideoContent | null
  whatsappUrl?: string | null
}

export const HOSPITALITY_CAPABILITIES = [
  {
    title: 'Restaurant POS and table service',
    body: 'Open a dine-in, takeaway, delivery, or room-service order, add menu items and notes, then prepare the order for checkout through the POS.',
  },
  {
    title: 'Dining areas and tables',
    body: 'Set up dining areas, table codes, seat counts, and table status so the service team can see what is available, occupied, reserved, or being cleaned.',
  },
  {
    title: 'KOT and kitchen orders',
    body: 'Send new order items to their kitchen station with the table, waiter, quantity, notes, and selected modifiers kept on the ticket.',
  },
  {
    title: 'Kitchen display',
    body: 'Read station queues on a live kitchen board, mark items ready, and carry the order status back to the service team.',
  },
  {
    title: 'Recipe costing and stock',
    body: 'Build a recipe from stock items, quantities, buying prices, and wastage. Recipe-linked menu sales can consume ingredient stock when the recipe is configured.',
  },
  {
    title: 'Rooms and bookings',
    body: 'Keep room types, rates, room status, guest details, arrival and departure dates, deposits, and booking status in the local property record.',
  },
  {
    title: 'Guest folios',
    body: 'Open a folio at check-in, post room or restaurant charges, record payments, read the balance, and settle or approve the balance before checkout.',
  },
  {
    title: 'Restaurant and hotel reports',
    body: 'Review restaurant sales and order activity alongside room occupancy, room revenue, bookings, and folio balances from the work already recorded.',
  },
] as const

const SERVICE_PASS = [
  {
    label: 'Table',
    title: 'Open the order where service starts',
    body: 'Choose the table and order type, keep the waiter and party details with it, then add the guest’s items and notes.',
  },
  {
    label: 'KOT',
    title: 'Send only what is ready for the kitchen',
    body: 'New items move to the kitchen queue with their station, modifiers, quantities, and preparation notes.',
  },
  {
    label: 'Kitchen',
    title: 'Move the ticket from sent to ready',
    body: 'The kitchen display groups active tickets by station and returns ready status to the order board.',
  },
  {
    label: 'Checkout',
    title: 'Close through POS or post to a room',
    body: 'Prepare the served order for payment, or add an eligible room-service order to the guest’s open folio.',
  },
] as const

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to book a demo of the Hospitality product.')
  return `${whatsappUrl}${separator}text=${message}`
}

function HospitalityMark() {
  return (
    <svg className={styles.hospitalityMark} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M7 34h34M11 39h26" />
      <path d="M13 32c0-8.3 4.9-15 11-15s11 6.7 11 15" />
      <path d="M24 11v6M20 11h8" />
      <path d="M15 27h18" />
    </svg>
  )
}

export function HospitalityWebsite({
  locale,
  heroImage = null,
  heroVideo = null,
  demoVideo = null,
  whatsappUrl = null,
}: HospitalityWebsiteProps) {
  const demoHref = `/${locale}/contact?type=demo&product=hospitality`
  const whatsappHref = whatsappDemoHref(whatsappUrl)
  const hasApprovedMedia = Boolean(heroVideo || heroImage)
  const isKenya = locale === 'ke'

  return (
    <div className={styles.page} data-hospitality-website>
      <section className={styles.hero} data-hospitality-section aria-labelledby="hospitality-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.identityLine}>
                <HospitalityMark />
                <p>Omnix Hospitality</p>
              </div>
              <h1 id="hospitality-heading">Restaurant POS, kitchen orders, and rooms in one working flow.</h1>
              <p className={styles.heroLede}>
                Run tables, KOT and kitchen work, menu and recipe costing, stock, room bookings, and guest folios from one Windows desktop product for restaurants, cafés, lodges, and small hotels.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a hospitality demo
                </Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>

              <div className={styles.serviceRail} aria-label="Hospitality service flow">
                <span>Table</span>
                <span>KOT</span>
                <span>Kitchen</span>
                <span>Folio</span>
              </div>
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
                // Only approved Task 8 Hospitality records are passed into this component.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage.url} alt={heroImage.alt} width={960} height={720} />
              ) : (
                <div className={styles.mediaFallback}>
                  <div className={styles.fallbackTitle}>
                    <span>Set the pass for your demo</span>
                    <p>Bring one table order and one guest stay.</p>
                  </div>
                  <div className={styles.fallbackColumns}>
                    <dl>
                      <div><dt>Restaurant</dt><dd>A typical menu order</dd></div>
                      <div><dt>Kitchen</dt><dd>Your KOT or station handoff</dd></div>
                      <div><dt>Stock</dt><dd>One recipe to cost</dd></div>
                    </dl>
                    <dl>
                      <div><dt>Property</dt><dd>A room type and rate</dd></div>
                      <div><dt>Booking</dt><dd>A sample guest stay</dd></div>
                      <div><dt>Folio</dt><dd>A charge and payment</dd></div>
                    </dl>
                  </div>
                  <span className={styles.fallbackNote}>No unapproved image substituted</span>
                </div>
              )}
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.demoVideo} data-hospitality-section aria-label="Hospitality product demo video">
        <div className={styles.container}>
          <ModuleDemoVideo
            product="hospitality"
            productLabel="Hospitality"
            content={demoVideo}
            bookDemoHref={demoHref}
            locale={locale}
          />
        </div>
      </section>

      <section className={styles.pass} data-hospitality-section aria-labelledby="service-pass-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <h2 id="service-pass-heading">Keep the table, ticket, and kitchen handoff together.</h2>
            <p>Follow one restaurant order without re-entering it between the floor, kitchen, and checkout.</p>
          </header>
          <div className={styles.passBoard}>
            {SERVICE_PASS.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.stay} data-hospitality-section aria-labelledby="stay-heading">
        <div className={styles.container}>
          <div className={styles.stayGrid}>
            <div className={styles.stayIntro}>
              <HospitalityMark />
              <h2 id="stay-heading">The guest stay has its own clear ledger.</h2>
              <p>Rooms, bookings, check-in, charges, payments, and checkout stay connected without turning the restaurant flow into a hotel spreadsheet.</p>
            </div>
            <div className={styles.stayLedger}>
              <article>
                <span>Before arrival</span>
                <div>
                  <h3>Reserve the room and rate</h3>
                  <p>Record the guest, room type, stay dates, party details, rate, deposit, source, and notes.</p>
                </div>
              </article>
              <article>
                <span>At check-in</span>
                <div>
                  <h3>Open the room and folio</h3>
                  <p>Assign the room, mark it occupied, and open a folio for eligible room, restaurant, and service charges.</p>
                </div>
              </article>
              <article>
                <span>At checkout</span>
                <div>
                  <h3>Read the balance before departure</h3>
                  <p>Apply folio payments, settle the remaining balance or use the authorised override, then release the room for cleaning.</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.capabilities} data-hospitality-section aria-labelledby="hospitality-capabilities-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <h2 id="hospitality-capabilities-heading">What the Hospitality product can show in a demo.</h2>
            <p>Choose the restaurant, kitchen, stock, room, or guest workflow that matters to your operation.</p>
          </header>
          <div className={styles.capabilityGrid}>
            {HOSPITALITY_CAPABILITIES.map((capability) => (
              <article key={capability.title}>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </article>
            ))}
            {isKenya ? (
              <article className={styles.connectedCapability}>
                <h3>Configured M-Pesa and KRA eTIMS workflow</h3>
                <p>Take a configured M-Pesa payment at POS and send taxable sales into the eTIMS workflow. Both services need working connectivity and the correct provider setup.</p>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.boundary} data-hospitality-section aria-labelledby="hospitality-boundary-heading">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div>
              <span className={styles.boundaryLabel}>Local work / connected services</span>
              <h2 id="hospitality-boundary-heading">Service records stay local. Connected services still need a connection.</h2>
            </div>
            <div className={styles.boundaryCopy}>
              <p>Restaurant POS records, cash checkout, tables, kitchen orders, recipes, stock, rooms, bookings, and folios use the local desktop database.</p>
              {isKenya ? (
                <p>Configured M-Pesa requests and KRA eTIMS submission require internet access and valid provider details. A completed sale is stored locally; an eTIMS attempt that cannot complete can remain queued for retry.</p>
              ) : (
                <p>Online payment and tax connections are available only where Omnix supports the provider and your business has completed the required setup. Ask the team what is available in your market.</p>
              )}
              <p>Omnix provides the software workflow and records. Your business remains responsible for menu and recipe setup, prices and tax treatment, room rates, staff permissions, operating procedures, connectivity, provider accounts, and its statutory obligations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} data-hospitality-section aria-labelledby="hospitality-closing-heading">
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <h2 id="hospitality-closing-heading">Bring a table order and a guest stay.</h2>
              <p>We will trace both through the screens and records your team would use, so you can judge the fit before making a decision.</p>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a hospitality demo
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
