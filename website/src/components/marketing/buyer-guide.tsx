import Link from 'next/link'

import { Icon } from '@/components/icons'
import { type BuyerGuide as BuyerGuideData, guidePricingFacts } from '@/config/guides'

import styles from './buyer-guide.module.css'

interface BuyerGuideProps {
  guide: BuyerGuideData
  locale: string
  whatsappUrl?: string | null
}

const CONTENTS = [
  { id: 'audience', label: 'Who it fits' },
  { id: 'workflow', label: 'The working day' },
  { id: 'boundary', label: 'Local and connected' },
  { id: 'facts', label: 'Platform facts' },
  { id: 'migration', label: 'Before you switch' },
  { id: 'evaluation', label: 'Questions for any vendor' },
  { id: 'product', label: 'Where Omnix fits' },
] as const

function whatsappGuideHref(whatsappUrl: string | null | undefined, label: string): string | null {
  if (!whatsappUrl) return null
  const separator = whatsappUrl.includes('?') ? '&' : '?'
  const message = encodeURIComponent(`Hi Omnix, I am comparing ${label} and would like a demo.`)
  return `${whatsappUrl}${separator}text=${message}`
}

export function BuyerGuide({ guide, locale, whatsappUrl = null }: BuyerGuideProps) {
  const demoHref = `/${locale}/contact?type=demo&product=${guide.product.demoProduct}`
  const productHref = `/${locale}${guide.product.path}`
  const guidesHref = `/${locale}/guides`
  const whatsappHref = whatsappGuideHref(whatsappUrl, guide.product.label)
  const facts = guidePricingFacts()

  return (
    <article className={styles.page} data-buyer-guide={guide.slug}>
      <section className={styles.hero} aria-labelledby="guide-heading">
        <div className={styles.container}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <Link href={guidesHref}>Guides</Link>
            <span aria-hidden>/</span>
            <span>{guide.product.label.replace('Omnix ', '')}</span>
          </nav>

          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>{guide.kicker}</p>
              <h1 id="guide-heading">
                {guide.title} <span>{guide.titleAccent}</span>
              </h1>
              <p className={styles.lede}>{guide.lede}</p>
              <div className={styles.actions} data-guide-actions>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
                </Link>
                <Link className={styles.secondaryAction} href={productHref} data-guide-product-link>
                  View {guide.product.label}
                </Link>
                {whatsappHref ? (
                  <a
                    className={styles.textAction}
                    href={whatsappHref}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
            </div>

            <aside className={styles.contents} aria-labelledby="guide-contents-title">
              <div className={styles.contentsTop}>
                <span>Buyer guide</span>
                <span>What this covers</span>
              </div>
              <h2 id="guide-contents-title">On this page</h2>
              <ol>
                {CONTENTS.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.label}</a>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.audience} id="audience" aria-labelledby="audience-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Who it fits</p>
              <h2 id="audience-title">Who this is for, and who it is not.</h2>
            </div>
            <p>{guide.audienceIntro}</p>
          </header>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceColumn}>
              <h3 className={styles.columnLabel}>
                <Icon.Check aria-hidden weight="bold" /> A good fit if
              </h3>
              <ul>
                {guide.forYou.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.audienceColumn} data-column="not">
              <h3 className={styles.columnLabel}>
                <Icon.Minus aria-hidden weight="bold" /> Probably not if
              </h3>
              <ul>
                {guide.notForYou.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workflow} id="workflow" aria-labelledby="workflow-title">
        <div className={styles.container}>
          <div className={styles.workflowGrid}>
            <header>
              <p className={styles.kicker}>The working day</p>
              <h2 id="workflow-title">Walk the day before you buy.</h2>
              <p>{guide.workflowIntro}</p>
            </header>
            <ol className={styles.workflowList}>
              {guide.workflow.map((step) => (
                <li key={step.marker}>
                  <span>{step.marker}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.boundary} id="boundary" aria-labelledby="boundary-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Local and connected</p>
              <h2 id="boundary-title">What runs on the device, what needs the line.</h2>
            </div>
            <p>{guide.boundaryIntro}</p>
          </header>
          <div className={styles.boundaryGrid}>
            <div className={styles.boundaryColumn}>
              <h3 className={styles.columnLabel}>
                <Icon.Desktop aria-hidden weight="bold" /> Works on the device
              </h3>
              <ul>
                {guide.local.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.boundaryColumn} data-column="connected">
              <h3 className={styles.columnLabel}>
                <Icon.Globe aria-hidden weight="bold" /> Needs a connection
              </h3>
              <ul>
                {guide.connected.map((item) => (
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
              <h2 id="facts-title">The same platform facts, whatever you sell.</h2>
            </div>
            <p>
              These hold for every Omnix product. The licence is a one-time purchase, and the
              optional update plan is a separate choice.
            </p>
          </header>
          <dl className={styles.factList}>
            <div>
              <dt>Platform</dt>
              <dd>Windows desktop (Windows 10 or 11, 64-bit)</dd>
            </div>
            <div>
              <dt>Works offline</dt>
              <dd>Core sales, stock and records use the local database on the computer</dd>
            </div>
            <div>
              <dt>Install</dt>
              <dd>Protected download from the customer dashboard after purchase</dd>
            </div>
            <div>
              <dt>Activation</dt>
              <dd>Each device activates its own licence</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>{facts.oneTime} one-time, per device, perpetual</dd>
            </div>
            <div>
              <dt>Compliance updates</dt>
              <dd>Optional {facts.maintenanceYearly} per year, not required to keep the licence working</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.migration} id="migration" aria-labelledby="migration-title">
        <div className={styles.container}>
          <div className={styles.migrationGrid}>
            <header>
              <p className={styles.kicker}>Before you switch</p>
              <h2 id="migration-title">Questions about moving your data.</h2>
              <p>{guide.migrationIntro}</p>
            </header>
            <ul className={styles.questionList}>
              {guide.migrationQuestions.map((question) => (
                <li key={question}>
                  <Icon.Question aria-hidden weight="bold" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.evaluation} id="evaluation" aria-labelledby="evaluation-title">
        <div className={styles.container}>
          <div className={styles.migrationGrid}>
            <header>
              <p className={styles.kicker}>Questions for any vendor</p>
              <h2 id="evaluation-title">Ask these before you commit.</h2>
              <p>{guide.evaluationIntro}</p>
            </header>
            <ul className={styles.questionList}>
              {guide.evaluationQuestions.map((question) => (
                <li key={question}>
                  <Icon.ListBullets aria-hidden weight="bold" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.product} id="product" aria-labelledby="product-title">
        <div className={styles.container}>
          <div className={styles.productPanel}>
            <div className={styles.productCopy}>
              <p className={styles.kicker}>Where Omnix fits</p>
              <h2 id="product-title">{guide.product.label}</h2>
              <p className={styles.productIntro}>{guide.productIntro}</p>
              <p>{guide.product.body}</p>
            </div>
            <div className={styles.productActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a demo <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
              <Link className={styles.secondaryAction} href={productHref} data-guide-product-link>
                View {guide.product.label}
              </Link>
              <Link className={styles.textAction} href={guidesHref}>
                All buyer guides
              </Link>
            </div>
          </div>
        </div>
      </section>
    </article>
  )
}
