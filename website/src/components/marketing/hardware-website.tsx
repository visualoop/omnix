import Link from 'next/link'

import { ModuleDemoVideo, type ModuleDemoVideoContent } from './module-demo-video'
import { DecorativeVideo } from './decorative-video'
import styles from './hardware-website.module.css'

export interface HardwareMedia { url: string; alt: string }
export interface HardwareVideo extends HardwareMedia { mimeType: string; posterUrl: string }

interface HardwareWebsiteProps {
  locale: string
  licencePriceKes: number
  heroImage?: HardwareMedia | null
  heroVideo?: HardwareVideo | null
  demoVideo?: ModuleDemoVideoContent | null
  whatsappUrl?: string | null
}

export const HARDWARE_CAPABILITIES = [
  { title: 'Hardware-shop POS', body: 'Search the product catalogue, build a sale, attach a customer, apply the permitted price, and collect cash, an available configured digital payment, or approved customer credit.' },
  { title: 'Stock and receiving', body: 'Keep quantities, buying and selling prices, units, reorder details, stock movements, stock takes, and goods received against the local product record.' },
  { title: 'Supplier purchasing', body: 'Create purchase orders for suppliers, track their status, and receive delivered quantities into stock through a goods receipt.' },
  { title: 'Bulk and tier prices', body: 'Set price lists for wholesale or contractor customers and resolve the relevant price when that customer is selected.' },
  { title: 'Quotations to sale', body: 'Prepare itemised quotations, keep validity and customer details, revise when needed, and load an eligible quotation into POS for checkout.' },
  { title: 'Delivery notes', body: 'Create a delivery note from an accepted quotation, keep the linked customer and goods, and record dispatch and delivery status.' },
  { title: 'Contractor and customer accounts', body: 'Set credit limits and terms, check available credit before an account sale, record payments and adjustments, and review aged balances.' },
] as const

const TRADE_FLOW = [
  { label: 'Counter', title: 'Build the order at POS', body: 'Find products, quantities and selling units, then select the customer whose prices and credit rules should apply.' },
  { label: 'Quote', title: 'Send an itemised quotation', body: 'Keep products, quantities, price, tax, validity and customer details in a quotation that can be revised without replacing the original.' },
  { label: 'Sale', title: 'Load the accepted work into checkout', body: 'Bring an eligible quotation into POS so payment, customer credit and the completed sale use the normal checkout record.' },
  { label: 'Delivery', title: 'Dispatch against the accepted quote', body: 'Generate the delivery note from the accepted quotation and retain the source link while goods move to the customer.' },
] as const

function hardwareWhatsAppHref(url: string | null | undefined): string | null {
  if (!url) return null
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}text=${encodeURIComponent('Hi Omnix, I would like to book a Hardware & Equipment demo.')}`
}

function HardwareMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M7 13h34v22H7zM14 13v22M34 13v22M14 22h20M14 29h20" />
      <path d="M20 18h8M20 26h8M20 33h8" />
    </svg>
  )
}

export function HardwareWebsite({
  locale,
  licencePriceKes,
  heroImage = null,
  heroVideo = null,
  demoVideo = null,
  whatsappUrl = null,
}: HardwareWebsiteProps) {
  const demoHref = `/${locale}/contact?type=demo&product=hardware`
  const whatsappHref = hardwareWhatsAppHref(whatsappUrl)
  const isKenya = locale === 'ke'
  const price = `KES ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(licencePriceKes)}`
  const hasApprovedMedia = Boolean(heroVideo || heroImage)

  return (
    <div className={styles.page} data-hardware-website>
      <section className={styles.hero} data-hardware-section aria-labelledby="hardware-heading">
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.identity}><HardwareMark /><p>Omnix Hardware &amp; Equipment</p></div>
              <h1 id="hardware-heading">Run the counter, stockroom, quotes, and trade accounts.</h1>
              <p className={styles.lede}>Windows desktop software for hardware shops and equipment dealers: POS, stock, supplier purchasing, bulk prices, quotations, delivery notes, and contractor or customer credit in one working record.</p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>Book a Hardware &amp; Equipment demo</Link>
                {whatsappHref ? <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a> : null}
              </div>
              <div className={styles.tradeRail} aria-label="Hardware shop workflow"><span>POS</span><span>Stock</span><span>Quote</span><span>Delivery</span><span>Account</span></div>
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
                // Only approved Task 8 Hardware media reaches this component.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage.url} alt={heroImage.alt} width={960} height={720} />
              ) : (
                <div className={styles.fallback}>
                  <header><span>Demo docket</span><h2>Bring one real trade order.</h2><p>We will set up the demo around the work your counter already handles.</p></header>
                  <dl>
                    <div><dt>Products</dt><dd>Five typical stock lines and units</dd></div>
                    <div><dt>Pricing</dt><dd>One retail and one bulk price</dd></div>
                    <div><dt>Customer</dt><dd>A contractor account and credit terms</dd></div>
                    <div><dt>Documents</dt><dd>A quote and delivery note example</dd></div>
                  </dl>
                  <small>No unapproved image substituted</small>
                </div>
              )}
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.demoVideo} data-hardware-section aria-label="Hardware and Equipment product demo video">
        <div className={styles.container}>
          <ModuleDemoVideo
            product="hardware"
            productLabel="Hardware &amp; Equipment"
            content={demoVideo}
            bookDemoHref={demoHref}
            locale={locale}
          />
        </div>
      </section>

      <section className={styles.operations} data-hardware-section aria-labelledby="operations-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}><h2 id="operations-heading">The day-to-day hardware shop comes first.</h2><p>Start at the counter, replenish from suppliers, quote larger jobs, and keep credit decisions attached to the customer.</p></header>
          <div className={styles.capabilityGrid}>{HARDWARE_CAPABILITIES.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
        </div>
      </section>

      <section className={styles.flow} data-hardware-section aria-labelledby="flow-heading">
        <div className={styles.container}>
          <div className={styles.flowGrid}>
            <header><HardwareMark /><h2 id="flow-heading">Carry a contractor order from quotation to delivery.</h2><p>The source quotation remains visible as the work moves into checkout and dispatch.</p></header>
            <div className={styles.flowList}>{TRADE_FLOW.map((item) => <article key={item.label}><span>{item.label}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div>
          </div>
        </div>
      </section>

      <section className={styles.equipment} data-hardware-section aria-labelledby="equipment-heading">
        <div className={styles.container}>
          <header className={styles.sectionHeading}><h2 id="equipment-heading">Records for equipment your business sells or rents.</h2><p>This optional layer is for generators, mixers, tools, vehicles, or other individually tracked equipment in your own catalogue—not a warranty for Omnix software.</p></header>
          <div className={styles.equipmentGrid}>
            <article><h3>Serialized units and specifications</h3><p>Receive individual units by serial, engine or chassis number; keep condition, location, meter reading, and catalogue or per-unit specifications.</p></article>
            <article><h3>Per-unit customer warranty records</h3><p>When your business sells a tracked unit, record its sale date, customer, and warranty period for later lookup and expiry review.</p></article>
            <article><h3>Rental records</h3><p>Assign a rentable unit to a customer agreement with dates, daily rate, deposit and meter-out, then record its return, meter-in, condition, and applicable fees.</p></article>
          </div>
        </div>
      </section>

      <section className={styles.purchase} data-hardware-section aria-labelledby="purchase-heading">
        <div className={styles.container}>
          <div className={styles.purchaseGrid}>
            <div><span className={styles.price}>{price}</span><h2 id="purchase-heading">One-time perpetual licence for one Windows device.</h2></div>
            <div><p>Purchase the Hardware &amp; Equipment licence once. After purchase, sign in to your Omnix dashboard, download the Windows installer and install it on the licensed device.</p><p>If you would rather have help, contact Omnix to arrange assisted installation and initial setup.</p><p>Any separate annual compliance-update plan is optional and is not required to keep the perpetual licence working.</p></div>
          </div>
        </div>
      </section>

      <section className={styles.boundary} data-hardware-section aria-labelledby="boundary-heading">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div><h2 id="boundary-heading">Counter records stay local. Connected services still need a connection.</h2></div>
            <div>
              <p>POS records, cash sales, stock, purchasing, quotations, delivery notes, customer accounts, and equipment records use the local desktop database.</p>
              {isKenya ? <p>Configured M-Pesa requests and KRA eTIMS submission require internet access, valid provider details, and the correct business setup. A completed sale is stored locally; an eTIMS attempt that cannot complete can remain queued for retry.</p> : <p>Online payment and tax connections are available only where Omnix supports the provider and your business has completed the required setup. Ask the team what is available in your market.</p>}
              <p>Omnix provides the software workflow and records. Your business remains responsible for product data, prices, tax treatment, credit approval, customer warranties, delivery checks, connectivity, provider accounts, and its statutory obligations.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} data-hardware-section aria-labelledby="closing-heading">
        <div className={styles.container}><div className={styles.closingPanel}><div><h2 id="closing-heading">Bring a quote, a bulk-price example, and a trade account.</h2><p>We will trace the order through the counter, stock, checkout, delivery, and account records so your team can judge the fit.</p></div><div className={styles.closingActions}><Link className={styles.primaryAction} href={demoHref}>Book a Hardware &amp; Equipment demo</Link>{whatsappHref ? <a className={styles.textAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a> : null}</div></div></div>
      </section>
    </div>
  )
}
