import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

import styles from './downloads.module.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

const VARIANTS = [
  {
    code: 'RX',
    name: 'Pharmacy',
    use: 'Pharmacies',
    detail: 'Prescription, patient, batch and controlled-register workflows.',
  },
  {
    code: 'SK',
    name: 'Retail',
    use: 'Shops and mini-marts',
    detail: 'Fast-moving stock, variants, loyalty, promotions and layby.',
  },
  {
    code: 'KT',
    name: 'Hospitality',
    use: 'Restaurants and stays',
    detail: 'Tables, kitchen orders, recipes, rooms, bookings and folios.',
  },
  {
    code: 'HW',
    name: 'Hardware & Equipment',
    use: 'Trade counters',
    detail: 'Quotations, delivery notes, bulk prices, serialised units and rentals.',
  },
  {
    code: 'SP',
    name: 'Salon & Spa',
    use: 'Appointment businesses',
    detail: 'Bookings, services, staff skills, commissions, packages and checkout.',
  },
] as const

const ACCESS_STEPS = [
  [
    'Purchase recorded',
    'The order and the Windows edition you own are attached to your customer account.',
  ],
  [
    'Sign in',
    'Open Downloads inside the customer dashboard. Installer controls stay behind this account gate.',
  ],
  [
    'Choose your owned edition',
    'The dashboard shows the edition attached to your licence, not a public list of files.',
  ],
  [
    'Install and activate',
    'Run the Windows installer on the intended device, then complete the normal licence activation.',
  ],
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/downloads`
  return {
    title: 'Download Omnix after purchase · Windows installer access',
    description:
      'How Omnix customers access their licensed Windows installer through the protected customer dashboard, with five editions and assisted installation available.',
    alternates: { canonical, languages: buildAlternatesLanguages('/downloads') },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Your Omnix Windows installer, issued after purchase',
      description:
        'Protected customer-dashboard access for the Omnix edition attached to your licence.',
      type: 'website',
    }),
  }
}

function whatsappHref(base: string | null): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent('Hi Omnix, I would like to book a demo and understand installation for my business.')}`
}

export default async function DownloadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const settings = await getSiteSettings()
  const demoHref = `/${locale}/contact?type=demo`
  const whatsapp = whatsappHref(settings.whatsappUrl)

  return (
    <div className={styles.page} data-downloads-page>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Windows installer access</p>
              <h1>
                Install after purchase. <span>From your own dashboard.</span>
              </h1>
              <p className={styles.lede}>
                Omnix installers are not public trial downloads. After purchase, sign in to the
                customer dashboard to access the Windows edition attached to your licence.
              </p>
              <div className={styles.actions} data-acquisition-actions>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a demo{' '}
                  <Icon.ArrowRight aria-hidden className={styles.actionIcon} weight="bold" />
                </Link>
                {whatsapp ? (
                  <a
                    className={styles.secondaryAction}
                    href={whatsapp}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
            </div>

            <aside className={styles.accessDocket} aria-labelledby="installer-access-title">
              <div className={styles.docketHeading}>
                <span aria-hidden className={styles.lockMark}>
                  <Icon.Lock weight="bold" />
                </span>
                <div>
                  <p>Customer handover</p>
                  <h2 id="installer-access-title">Installer access</h2>
                </div>
              </div>
              <dl className={styles.accessFacts}>
                <div>
                  <dt>Platform</dt>
                  <dd>Windows desktop</dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>Customer sign-in required</dd>
                </div>
                <div>
                  <dt>Edition</dt>
                  <dd>Your purchased variant</dd>
                </div>
                <div>
                  <dt>Licence</dt>
                  <dd>Activation still required</dd>
                </div>
              </dl>
              <Link className={styles.dashboardAction} href="/login?next=%2Fdashboard%2Fdownloads">
                Open customer sign-in <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
              <p className={styles.protectionNote}>
                No installer files or protected release addresses are published on this page.
              </p>
            </aside>
          </div>

          <div className={styles.variantRail} aria-label="Available Omnix editions">
            {VARIANTS.map((variant) => (
              <span key={variant.name}>{variant.name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.editions} aria-labelledby="editions-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Five editions</p>
              <h2 id="editions-title">The right installer follows the work you do.</h2>
            </div>
            <p>
              Each purchase is issued for one business edition. The public page explains the choice;
              your dashboard handles the actual file.
            </p>
          </header>
          <div className={styles.editionList}>
            {VARIANTS.map((variant) => (
              <article key={variant.name}>
                <span className={styles.editionCode} aria-hidden>
                  {variant.code}
                </span>
                <div>
                  <p>{variant.use}</p>
                  <h3>Omnix {variant.name}</h3>
                </div>
                <p>{variant.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.handover} aria-labelledby="handover-title">
        <div className={styles.container}>
          <div className={styles.handoverGrid}>
            <header>
              <p className={styles.kicker}>Protected handover</p>
              <h2 id="handover-title">What happens after payment.</h2>
              <p>
                The licence and installer remain separate controls: receiving a file does not remove
                activation or device entitlement.
              </p>
            </header>
            <ol className={styles.stepList}>
              {ACCESS_STEPS.map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.assistance} aria-labelledby="assistance-title">
        <div className={styles.container}>
          <div className={styles.assistanceGrid}>
            <div>
              <p className={styles.kicker}>Assisted installation</p>
              <h2 id="assistance-title">You do not have to set it up alone.</h2>
            </div>
            <div className={styles.assistanceCopy}>
              <p>
                We can arrange a guided installation for the licensed Windows device, check the
                edition, walk through first-run setup and help connect supported counter hardware.
              </p>
              <p>
                Assistance does not bypass sign-in, licence activation, device limits or the
                separate work needed for data migration.
              </p>
              <Link href={demoHref}>
                Discuss setup in a demo <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
            </div>
          </div>
          <div className={styles.requirements}>
            <div>
              <Icon.Monitor aria-hidden weight="bold" />
              <span>
                <strong>Windows device</strong>Windows 10 or 11, 64-bit
              </span>
            </div>
            <div>
              <Icon.UserCircle aria-hidden weight="bold" />
              <span>
                <strong>Customer account</strong>Use the account linked to purchase
              </span>
            </div>
            <div>
              <Icon.ShieldCheck aria-hidden weight="bold" />
              <span>
                <strong>Normal activation</strong>The installed edition still needs its licence
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.kicker}>Before you buy</p>
              <h2>See the edition at your counter first.</h2>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a demo{' '}
                <Icon.ArrowRight aria-hidden className={styles.actionIcon} weight="bold" />
              </Link>
              {whatsapp ? (
                <a
                  className={styles.textAction}
                  href={whatsapp}
                  rel="noopener noreferrer"
                  target="_blank"
                >
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
