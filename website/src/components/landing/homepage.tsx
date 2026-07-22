import Link from 'next/link'

import { DecorativeVideo } from '@/components/marketing/decorative-video'
import styles from './homepage.module.css'

export interface HomepageMedia {
  url: string
  alt: string
}

export interface HomepageVideo extends HomepageMedia {
  mimeType: string
}

export interface HomepageProduct {
  id: 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'
  name: string
  audience: string
  lead: string
  outcome: string
  href: string
}

export const HOMEPAGE_PRODUCTS: readonly HomepageProduct[] = [
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    audience: 'Chemists, clinics and dispensaries',
    lead: 'Pharmacy software for the counter and dispensary.',
    outcome: 'Handle prescriptions, expiry, controlled medicines, insurance claims, inventory and each POS sale in one working flow.',
    href: '/pharmacy',
  },
  {
    id: 'retail',
    name: 'Retail',
    audience: 'Mini-marts, fashion and general retail',
    lead: 'POS and inventory for a busy shop floor.',
    outcome: 'Sell variants, take returns, hold sales, run promotions and see what needs restocking without keeping a second spreadsheet.',
    href: '/retail',
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    audience: 'Restaurants, bars, hotels and lodges',
    lead: 'Restaurant POS from table to kitchen.',
    outcome: 'Send kitchen orders, manage tables, cost recipes and keep rooms, bookings and guest folios connected to checkout.',
    href: '/hospitality',
  },
  {
    id: 'hardware',
    name: 'Hardware & Equipment',
    audience: 'Hardware stores, yards and equipment dealers',
    lead: 'Counter sales and stock control for heavy inventory.',
    outcome: 'Prepare quotations, issue delivery notes, manage contractor credit and track serialized equipment, pricing and warranty records.',
    href: '/hardware',
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    audience: 'Salons, barbershops, nail bars and spas',
    lead: 'Appointments, service checkout and stock together.',
    outcome: 'Book clients, match staff skills, calculate commissions and manage packages, memberships and back-bar inventory.',
    href: '/salon',
  },
] as const

interface HomepageProps {
  locale: string
  heroMedia?: HomepageMedia | null
  heroVideo?: HomepageVideo | null
  heroVideoPoster?: HomepageMedia | null
  productMedia?: Partial<Record<HomepageProduct['id'], HomepageMedia>>
  whatsappUrl?: string | null
}

function localeHref(locale: string, path: string): string {
  return `/${locale}${path}`
}

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to book a product demo.')
  return `${whatsappUrl}${separator}text=${message}`
}

export function Homepage({
  locale,
  heroMedia = null,
  heroVideo = null,
  heroVideoPoster = null,
  productMedia = {},
  whatsappUrl = null,
}: HomepageProps) {
  const demoHref = localeHref(locale, '/contact?type=demo')
  const whatsappHref = whatsappDemoHref(whatsappUrl)
  const hasApprovedVideo = Boolean(heroVideo && heroVideoPoster)
  const hasHeroMedia = Boolean(hasApprovedVideo || heroMedia)

  return (
    <div className={styles.page} data-homepage-acquisition>
      <section className={styles.hero} aria-labelledby="homepage-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.overline}>POS and inventory for the way you trade</p>
              <h1 id="homepage-heading" className={styles.heroTitle}>
                Run the counter. Know what is in stock.
              </h1>
              <p className={styles.heroLede}>
                Omnix keeps sales, stock and the day’s records together—even when the internet is down. Choose the product shaped for your business, then see your own workflow in a guided demo.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo
                </Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
              <dl className={styles.counterNotes} aria-label="What stays connected">
                <div>
                  <dt>At the counter</dt>
                  <dd>POS, cash and M-Pesa</dd>
                </div>
                <div>
                  <dt>Behind the counter</dt>
                  <dd>Inventory and purchasing</dd>
                </div>
                <div>
                  <dt>At day end</dt>
                  <dd>Sales and business records</dd>
                </div>
              </dl>
            </div>

            <div className={styles.heroMedia} data-media-state={hasHeroMedia ? 'approved' : 'empty'}>
              {hasApprovedVideo && heroVideo && heroVideoPoster ? (
                // Approved records reach this component only through getSlotMedia.
                <DecorativeVideo
                  src={heroVideo.url}
                  type={heroVideo.mimeType}
                  poster={heroVideoPoster.url}
                  ariaLabel={heroVideo.alt}
                />
              ) : heroMedia ? (
                // Approved records reach this component only through getSlotImage.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroMedia.url} alt={heroMedia.alt} width={960} height={720} />
              ) : (
                <div className={styles.heroEmpty}>
                  <span className={styles.emptyCode}>Guided product view</span>
                  <p>See the live POS, inventory and reporting flow during your demo.</p>
                  <span>No stock image substituted</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.products} aria-labelledby="products-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.overline}>Choose your product</p>
              <h2 id="products-heading">Start with your working day.</h2>
            </div>
            <p>
              The same sales and inventory foundation, shaped around five different counters.
            </p>
          </div>

          <div className={styles.productIndex}>
            {HOMEPAGE_PRODUCTS.map((product) => {
              const media = productMedia[product.id]
              return (
                <article className={styles.productRow} data-home-product={product.id} key={product.id}>
                  <div className={styles.productBody}>
                    <div className={styles.productCopy}>
                      <p className={styles.productAudience}>{product.audience}</p>
                      <h3>{product.name}</h3>
                      <p className={styles.productLead}>{product.lead}</p>
                      <p className={styles.productOutcome}>{product.outcome}</p>
                      <Link className={styles.productAction} href={localeHref(locale, product.href)} aria-label={`Explore ${product.name}`}>
                        View {product.id === 'hardware' ? 'Hardware' : product.id === 'salon' ? 'Salon' : product.name}
                        <span aria-hidden>↗</span>
                      </Link>
                    </div>
                    <div className={styles.productMedia} data-media-state={media ? 'approved' : 'empty'}>
                      {media ? (
                        // Approved records reach this component only through getSlotImage.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={media.url} alt={media.alt} loading="lazy" width={800} height={500} />
                      ) : (
                        <div className={styles.productEmpty}>
                          <span>{product.name}</span>
                          <p>Product view available in the guided demo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.outcomes} aria-labelledby="outcomes-heading">
        <div className={styles.container}>
          <div className={styles.outcomeIntro}>
            <p className={styles.overline}>One working record</p>
            <h2 id="outcomes-heading">From first sale to closing time.</h2>
          </div>
          <div className={styles.outcomeGrid}>
            <div>
              <h3>Sell without waiting on the internet</h3>
              <p>Keep the counter moving offline. Sales remain part of the same local business record.</p>
            </div>
            <div>
              <h3>See stock change with the work</h3>
              <p>Sales, returns, receiving and stock counts update inventory instead of leaving separate lists to reconcile.</p>
            </div>
            <div>
              <h3>Close with records ready</h3>
              <p>Review sales, payments and stock movement from the work already completed during the day.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-heading">
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.overline}>See your counter in Omnix</p>
              <h2 id="closing-heading">Bring the questions from your working day.</h2>
              <p>We will walk through the product that fits your business and show the POS, inventory and records that matter to you.</p>
            </div>
            <Link className={styles.primaryAction} href={demoHref}>
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
