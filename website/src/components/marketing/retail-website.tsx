import Link from 'next/link'

import { ModuleDemoVideo, type ModuleDemoVideoContent } from './module-demo-video'
import { DecorativeVideo } from './decorative-video'
import styles from './retail-website.module.css'

export interface RetailMedia {
  url: string
  alt: string
}

export interface RetailVideo extends RetailMedia {
  mimeType: string
  posterUrl: string
}

interface RetailWebsiteProps {
  locale: string
  heroImage?: RetailMedia | null
  heroVideo?: RetailVideo | null
  demoVideo?: ModuleDemoVideoContent | null
  whatsappUrl?: string | null
}

export const RETAIL_CAPABILITIES = [
  {
    title: 'Barcode POS and product variants',
    body: 'Scan a barcode or search at the till. Keep size, colour, shade, SKU, barcode, selling price, and stock against the right product variant.',
  },
  {
    title: 'Inventory that follows the sale',
    body: 'A completed sale updates stock. Review stock movement, low-stock items, transfers, stock takes, returns, and adjustments from the same local record.',
  },
  {
    title: 'Customer price lists',
    body: 'Create price lists such as Retail, Wholesale, or VIP, set product prices on each list, and assign the right list to a customer.',
  },
  {
    title: 'Loyalty and promotions',
    body: 'Configure loyalty earning and redemption, then run percentage, amount-off, or buy-X-get-Y promotions for a cart, product, or category.',
  },
  {
    title: 'Layby at the counter',
    body: 'Record a customer deposit, reserve available stock, track later payments and the balance, then finish the handover through the till.',
  },
  {
    title: 'Shelf labels with Code 128 barcodes',
    body: 'Print shelf labels with the product name, barcode, price, and unit so shelf pricing can follow the product record used at checkout.',
  },
  {
    title: 'Purchasing and goods received',
    body: 'Raise a purchase order for a supplier, receive full or partial deliveries, and bring the received quantities into stock with a goods received record.',
  },
  {
    title: 'Cash, M-Pesa, and eTIMS workflow',
    body: 'Take cash or use a configured M-Pesa provider. Configured taxable sales enter the eTIMS workflow, with unsuccessful submissions kept for retry.',
  },
] as const

const COUNTER_FLOW = [
  {
    marker: 'At the till',
    title: 'Find the exact item',
    body: 'Scan its barcode or search, select the correct variant, confirm the customer price, and add it to the sale.',
  },
  {
    marker: 'At payment',
    title: 'Close the sale clearly',
    body: 'Take cash, send a configured M-Pesa STK request, or use another enabled payment method before issuing the sale.',
  },
  {
    marker: 'On the shelf',
    title: 'Keep stock and price aligned',
    body: 'The sale updates the item record. Use stock counts, price lists, promotions, and shelf labels for the next trading decision.',
  },
  {
    marker: 'At receiving',
    title: 'Bring new stock in against an order',
    body: 'Create a supplier purchase order, record what actually arrived, and carry received quantities into inventory.',
  },
] as const

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to book a demo of the Retail product.')
  return `${whatsappUrl}${separator}text=${message}`
}

function RetailMark() {
  return (
    <span className={styles.retailMark} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}

export function RetailWebsite({
  locale,
  heroImage = null,
  heroVideo = null,
  demoVideo = null,
  whatsappUrl = null,
}: RetailWebsiteProps) {
  const demoHref = `/${locale}/contact?type=demo&product=retail`
  const whatsappHref = whatsappDemoHref(whatsappUrl)
  const hasApprovedMedia = Boolean(heroVideo || heroImage)

  return (
    <div className={styles.page} data-retail-website>
      <section className={styles.hero} data-retail-section aria-labelledby="retail-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.identityLine}>
                <RetailMark />
                <p className={styles.overline}>Omnix Retail</p>
              </div>
              <h1 id="retail-heading">Retail POS that keeps the shelf and till in step.</h1>
              <p className={styles.heroLede}>
                Sell by barcode, manage product variants and stock, set the right customer price, run shop offers, and receive supplier orders in one Windows desktop product for dukas, mini-marts, boutiques, and general shops.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a retail demo
                </Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>

              <div className={styles.counterTape} aria-label="Retail counter workflow">
                <span>Scan</span>
                <span>Price</span>
                <span>Pay</span>
                <span>Stock</span>
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
                // Only approved Task 8 records are passed into this component.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage.url} alt={heroImage.alt} width={960} height={720} />
              ) : (
                <div className={styles.mediaFallback}>
                  <div className={styles.fallbackHeader}>
                    <span className={styles.fallbackLabel}>Your retail demo docket</span>
                    <p>Bring the shelf and till problems you handle every day.</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Bring</dt>
                      <dd>Three product barcodes</dd>
                    </div>
                    <div>
                      <dt>Bring</dt>
                      <dd>One item sold in sizes or colours</dd>
                    </div>
                    <div>
                      <dt>Bring</dt>
                      <dd>A recent supplier delivery</dd>
                    </div>
                    <div>
                      <dt>We will test</dt>
                      <dd>Sale, stock, price, and receiving</dd>
                    </div>
                  </dl>
                  <span className={styles.fallbackNote}>No unapproved image substituted</span>
                </div>
              )}
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.demoVideo} data-retail-section aria-label="Retail product demo video">
        <div className={styles.container}>
          <ModuleDemoVideo
            product="retail"
            productLabel="Retail"
            content={demoVideo}
            bookDemoHref={demoHref}
            locale={locale}
          />
        </div>
      </section>

      <section className={styles.flow} data-retail-section aria-labelledby="counter-flow-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <h2 id="counter-flow-heading">From barcode to replenishment.</h2>
            </div>
            <p>Follow one item through the daily work: find it, sell it, update it, and order it again.</p>
          </header>

          <ol className={styles.flowList}>
            {COUNTER_FLOW.map((item) => (
              <li key={item.marker}>
                <span>{item.marker}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.merchandising} data-retail-section aria-labelledby="merchandising-heading">
        <div className={styles.container}>
          <div className={styles.merchandisingGrid}>
            <div className={styles.merchandisingIntro}>
              <h2 id="merchandising-heading">Run the offer without losing the item record.</h2>
              <p>Use the retail tools only when they fit the way your shop trades. The demo can be configured around your products, customers, and counter rules.</p>
            </div>
            <div className={styles.merchandisingLedger}>
              <article>
                <span>Price</span>
                <h3>Retail, wholesale, or customer list</h3>
                <p>Assign a customer price list and let the till resolve that product price.</p>
              </article>
              <article>
                <span>Offer</span>
                <h3>Loyalty or a defined promotion</h3>
                <p>Configure points and supported cart, product, or category promotions.</p>
              </article>
              <article>
                <span>Reserve</span>
                <h3>Deposit now, collect later</h3>
                <p>Keep the layby customer, reserved items, payments, and balance together.</p>
              </article>
              <article>
                <span>Shelf</span>
                <h3>Print the product price and barcode</h3>
                <p>Produce Code 128 shelf labels from the item details used by the shop.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.capabilities} data-retail-section aria-labelledby="retail-capabilities-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <h2 id="retail-capabilities-heading">The records behind a stocked, priced sale.</h2>
            </div>
            <p>Ask to see any of these workflows with your own product examples during the retail demo.</p>
          </header>

          <div className={styles.capabilityGrid}>
            {RETAIL_CAPABILITIES.map((capability) => (
              <article key={capability.title}>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.boundary} data-retail-section aria-labelledby="retail-boundary-heading">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div>
              <p className={styles.overline}>Local counter, connected services</p>
              <h2 id="retail-boundary-heading">Keep selling when the internet is not part of the sale.</h2>
            </div>
            <div className={styles.boundaryCopy}>
              <p>Core POS, cash sales, inventory, variants, price lists, purchasing, loyalty, promotions, layby, and shelf-label work use the local desktop database.</p>
              <p>M-Pesa STK requests and KRA eTIMS submission require a working internet connection and correctly configured provider details. If an eTIMS submission cannot complete, the invoice can remain queued for retry when connectivity returns.</p>
              <p>Omnix provides the software workflow and records. Your business remains responsible for product and tax setup, till procedures, connectivity, provider accounts, and its statutory obligations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} data-retail-section aria-labelledby="retail-closing-heading">
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <h2 id="retail-closing-heading">Bring a barcode, a variant, and a supplier delivery.</h2>
              <p>We will trace them through the till, stock, pricing, payment, and receiving records so you can judge the fit for your shop.</p>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a retail demo
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
