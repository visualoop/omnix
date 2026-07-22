import Link from 'next/link'

import { HOMEPAGE_PRODUCTS } from '@/components/landing/homepage'

import styles from './acquisition-routes.module.css'

interface ModulesWebsiteProps {
  locale: string
  whatsappUrl?: string | null
}

const PRODUCT_DETAILS = {
  pharmacy: {
    register: 'Counter + dispensary',
    handles: 'Prescriptions, patient records, batch and expiry stock, controlled medicines and insurance workflows.',
  },
  retail: {
    register: 'Shop floor + stockroom',
    handles: 'Barcode sales, variants, returns, promotions, layby, loyalty and replenishment records.',
  },
  hospitality: {
    register: 'Table + kitchen + front desk',
    handles: 'Tables, kitchen orders, recipes, rooms, bookings, folios and checkout.',
  },
  hardware: {
    register: 'Trade counter + yard',
    handles: 'Quotations, delivery notes, contractor credit, tiered pricing, serialized equipment and warranty records.',
  },
  salon: {
    register: 'Diary + service checkout',
    handles: 'Appointments, staff skills, commissions, packages, memberships and back-bar stock.',
  },
} as const

function localeHref(locale: string, path: string): string {
  return `/${locale}${path}`
}

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to book a demo and choose the right product for my business.')
  return `${whatsappUrl}${separator}text=${message}`
}

export function ModulesWebsite({ locale, whatsappUrl = null }: ModulesWebsiteProps) {
  const demoHref = localeHref(locale, '/contact?type=demo')
  const whatsappHref = whatsappDemoHref(whatsappUrl)

  return (
    <div className={styles.page} data-modules-acquisition>
      <section className={styles.catalogueHero} aria-labelledby="modules-heading">
        <div className={styles.container}>
          <div className={styles.catalogueHeader}>
            <div>
              <p className={styles.overline}>Omnix product catalogue</p>
              <h1 id="modules-heading">Five products for five kinds of working day.</h1>
            </div>
            <div className={styles.catalogueIntro}>
              <p>Each product starts with sales, stock and business records, then adds the workflow your team uses at the counter.</p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>Book a demo</Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a>
                ) : null}
              </div>
            </div>
          </div>
          <div className={styles.catalogueCount} aria-label="Five Omnix products">
            <span>05</span>
            <span>products · available now</span>
          </div>
        </div>
      </section>

      <section className={styles.catalogue} aria-label="Omnix products">
        <div className={styles.container}>
          <div className={styles.catalogueLabels} aria-hidden>
            <span>Product</span>
            <span>Working area</span>
            <span>What it keeps together</span>
            <span>Details</span>
          </div>
          <div className={styles.catalogueList}>
            {HOMEPAGE_PRODUCTS.map((product, index) => {
              const detail = PRODUCT_DETAILS[product.id]
              return (
                <article className={styles.productRecord} data-public-product={product.id} key={product.id}>
                  <div className={styles.recordIdentity}>
                    <span className={styles.recordNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h2>{product.name}</h2>
                      <p>{product.lead}</p>
                    </div>
                  </div>
                  <p className={styles.recordArea}>{detail.register}</p>
                  <p className={styles.recordDescription}>{detail.handles}</p>
                  <Link className={styles.recordAction} href={localeHref(locale, product.href)} aria-label={`View ${product.name}`}>
                    View product <span aria-hidden>↗</span>
                  </Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.sharedRecord} aria-labelledby="shared-record-heading">
        <div className={styles.container}>
          <div className={styles.sharedRecordGrid}>
            <div>
              <h2 id="shared-record-heading">Different counters. A consistent business record.</h2>
            </div>
            <div className={styles.sharedPoints}>
              <div><span>Sales</span><p>Record the work where the customer is served.</p></div>
              <div><span>Stock</span><p>Keep inventory changes tied to sales, receiving and returns.</p></div>
              <div><span>Day end</span><p>Review the day from the transactions already recorded.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="modules-closing-heading">
        <div className={styles.container}>
          <div className={styles.closingInner}>
            <div>
              <h2 id="modules-closing-heading">Choose by the work, not a feature checklist.</h2>
              <p>Bring your daily process to a guided demo. We will open the product that fits it.</p>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href={demoHref}>Book a demo</Link>
              {whatsappHref ? (
                <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
