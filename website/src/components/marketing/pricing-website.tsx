import Link from 'next/link'

import { CURRENCIES, type SupportedCurrency } from '@/lib/currency'
import { HOMEPAGE_PRODUCTS } from '@/components/landing/homepage'

import styles from './acquisition-routes.module.css'

interface PricingWebsiteProps {
  locale: string
  currency: SupportedCurrency
  oneTimeFee: number
  maintenanceYearly: number
  cloudBackupMonthly: number
  extraBranchOneTime: number
  extraMachineOneTime: number
  whatsappUrl?: string | null
}

function localeHref(locale: string, path: string): string {
  return `/${locale}${path}`
}

function formatAmount(amount: number, currency: SupportedCurrency): string {
  const decimals = CURRENCIES[currency].decimals
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function whatsappDemoHref(whatsappUrl: string | null | undefined): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent('Hi Omnix, I would like to book a product demo and understand the licence price.')
  return `${whatsappUrl}${separator}text=${message}`
}

export function PricingWebsite({
  locale,
  currency,
  oneTimeFee,
  maintenanceYearly,
  cloudBackupMonthly,
  extraBranchOneTime,
  extraMachineOneTime,
  whatsappUrl = null,
}: PricingWebsiteProps) {
  const demoHref = localeHref(locale, '/contact?type=demo')
  const whatsappHref = whatsappDemoHref(whatsappUrl)
  const price = formatAmount(oneTimeFee, currency)
  const optionalCosts = [
    {
      name: 'Compliance updates',
      price: `${currency} ${formatAmount(maintenanceYearly, currency)} / year`,
      note: 'Optional. Keep current statutory and compliance changes without changing your perpetual licence.',
    },
    {
      name: 'Cloud backup',
      price: `${currency} ${formatAmount(cloudBackupMonthly, currency)} / month`,
      note: 'Optional encrypted off-site backup for a branch.',
    },
    {
      name: 'Extra branch',
      price: `${currency} ${formatAmount(extraBranchOneTime, currency)} once`,
      note: 'A one-time addition when the licensed setup grows to another branch.',
    },
    {
      name: 'Extra machine seat',
      price: `${currency} ${formatAmount(extraMachineOneTime, currency)} once`,
      note: 'A one-time addition for another machine on the licensed setup.',
    },
  ] as const

  return (
    <div className={styles.page} data-pricing-acquisition>
      <section className={styles.priceHero} aria-labelledby="pricing-heading">
        <div className={styles.container}>
          <div className={styles.priceHeroGrid}>
            <div className={styles.priceStatement}>
              <p className={styles.overline}>One perpetual licence</p>
              <h1 id="pricing-heading">Own the software. Keep running it.</h1>
              <p className={styles.lede}>
                Pay once for the Omnix product that fits your business. The starter licence does not expire, and optional compliance updates are not required to keep it working.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={demoHref}>Book a demo</Link>
                {whatsappHref ? (
                  <a className={styles.secondaryAction} href={whatsappHref} rel="noreferrer">Ask on WhatsApp</a>
                ) : null}
              </div>
            </div>

            <div className={styles.priceDocket} aria-label="Starter licence price">
              <span className={styles.priceCurrency}>{currency}</span>
              <strong className={styles.priceAmount}>{price}</strong>
              <span className={styles.priceCadence}>one-time · per device · perpetual</span>
              <dl className={styles.priceFacts}>
                <div><dt>Renewal</dt><dd>Not required</dd></div>
                <div><dt>Licence term</dt><dd>Perpetual</dd></div>
                <div><dt>Product choice</dt><dd>One of five</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.productPricing} aria-labelledby="product-pricing-heading">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 id="product-pricing-heading">Five products. The same starter price.</h2>
            <p>Choose the product shaped around your daily work. Each starts at the configured one-time licence price shown above.</p>
          </div>
          <div className={styles.priceProductList}>
            {HOMEPAGE_PRODUCTS.map((product) => (
              <Link
                className={styles.priceProductRow}
                data-pricing-product={product.id}
                href={localeHref(locale, product.href)}
                key={product.id}
              >
                <span className={styles.productName}>{product.name}</span>
                <span className={styles.productAudience}>{product.audience}</span>
                <span className={styles.rowPrice}>{currency} {price}</span>
                <span className={styles.rowAction}>View product <span aria-hidden>↗</span></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.licenceTerms} aria-labelledby="licence-terms-heading">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 id="licence-terms-heading">What “perpetual” means here.</h2>
            <p>The licence and the optional services are separate decisions.</p>
          </div>
          <div className={styles.termGrid}>
            <article>
              <span className={styles.termKey}>Licence</span>
              <h3>Keep using the version you bought.</h3>
              <p>Your starter licence keeps working without an annual licence renewal.</p>
            </article>
            <article>
              <span className={styles.termKey}>Updates</span>
              <h3>Renew compliance updates only when useful.</h3>
              <p>Skipping the optional update plan does not deactivate the licence.</p>
            </article>
            <article>
              <span className={styles.termKey}>Before payment</span>
              <h3>See your workflow in a guided demo.</h3>
              <p>We will show the relevant product and answer setup questions before you decide.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.optionalCosts} aria-labelledby="optional-costs-heading">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 id="optional-costs-heading">Optional costs, stated separately.</h2>
            <p>Add only what the business needs. These items do not replace the one-time starter licence.</p>
          </div>
          <dl className={styles.costLedger}>
            {optionalCosts.map((item) => (
              <div key={item.name}>
                <dt>{item.name}</dt>
                <dd className={styles.costPrice}>{item.price}</dd>
                <dd className={styles.costNote}>{item.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="pricing-closing-heading">
        <div className={styles.container}>
          <div className={styles.closingInner}>
            <div>
              <h2 id="pricing-closing-heading">Start with the counter you run today.</h2>
              <p>Book a guided demo of the product for your business.</p>
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
