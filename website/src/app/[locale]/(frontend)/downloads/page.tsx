import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { getLatestAndroidRelease } from '@/lib/android-release'
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

const CLIENTS = [
  {
    id: 'windows',
    name: 'Windows desktop hub',
    label: 'Main application',
    purpose:
      'The full POS and back office. It holds the branch database and runs the service used by companion devices.',
    requirements: [
      'Windows 10 or 11, 64-bit',
      'A customer account and device licence',
      'A stable branch network for companion access',
    ],
    steps: [
      'Sign in to the protected customer dashboard.',
      'Download the Windows edition attached to your licence.',
      'Run the installer, activate the PC, and complete setup.',
    ],
    docSlug: 'windows-desktop-hub',
    icon: 'Monitor',
  },
  {
    id: 'android',
    name: 'Android app',
    label: 'Mobile POS and reports',
    purpose:
      'An enrolled phone or tablet for mobile selling, branch views, offline work, and PDF report sharing.',
    requirements: [
      'A supported Android phone or tablet',
      'An authorised Omnix user and enrolment',
      'Branch Wi-Fi or Omnix Private Mesh for sync',
    ],
    steps: [
      'Download the signed APK only from the Omnix website.',
      'Allow that browser to install the APK when Android asks.',
      'Open Omnix and enrol it from the Windows desktop hub.',
    ],
    docSlug: 'android-app',
    icon: 'Phone',
  },
  {
    id: 'browser',
    name: 'Browser companion',
    label: 'Read-only branch view',
    purpose:
      'A no-install view for checking approved branch information in a browser on the branch network.',
    requirements: [
      'The Windows hub running the branch service',
      'A current browser on the same Wi-Fi or wired LAN',
      'An Omnix user allowed to view that branch',
    ],
    steps: [
      'Open the browser companion controls on the Windows hub.',
      'Join the same branch network on the browser device.',
      'Enter the local address shown by the hub and sign in.',
    ],
    docSlug: 'browser-companion',
    icon: 'Globe',
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
    title: 'Omnix downloads · Windows, Android and browser companion',
    description:
      'Install the Omnix Windows desktop hub, get the signed Android APK, or connect the read-only browser companion on your branch network.',
    alternates: { canonical, languages: buildAlternatesLanguages('/downloads') },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Choose the Omnix client for the work at hand',
      description:
        'Windows hub access, signed Android APK instructions, and LAN browser companion setup.',
      type: 'website',
    }),
  }
}

function whatsappHref(base: string | null): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent('Hi Omnix, I would like to book a demo and understand installation for my business.')}`
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function DownloadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [settings, androidRelease] = await Promise.all([
    getSiteSettings(),
    getLatestAndroidRelease(),
  ])
  const demoHref = `/${locale}/contact?type=demo`
  const whatsapp = whatsappHref(settings.whatsappUrl)

  return (
    <div className={styles.page} data-downloads-page>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Three Omnix clients</p>
              <h1>
                Install after purchase. <span>Use the right client.</span>
              </h1>
              <p className={styles.lede}>
                The Windows hub runs the branch, Android handles approved mobile work, and the
                browser companion gives staff a read-only view on the branch network. Windows
                installer access remains protected by customer sign-in.
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
                Windows installer files and protected desktop release addresses are not published
                on this page.
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

      <section className={styles.clients} aria-labelledby="clients-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Choose a client</p>
              <h2 id="clients-title">One branch record, three ways in.</h2>
            </div>
            <p>
              Start with the Windows hub. Add Android for enrolled mobile work or open the browser
              companion when someone only needs to read branch information.
            </p>
          </header>

          <div className={styles.clientGrid}>
            {CLIENTS.map((client) => {
              const ClientIcon = Icon[client.icon]
              return (
                <article id={client.id} key={client.id}>
                  <header className={styles.clientHeader}>
                    <span aria-hidden className={styles.clientIcon}>
                      <ClientIcon weight="bold" />
                    </span>
                    <div>
                      <p>{client.label}</p>
                      <h3>{client.name}</h3>
                    </div>
                  </header>
                  <p className={styles.clientPurpose}>{client.purpose}</p>
                  {client.id === 'android' ? (
                    androidRelease?.apkUrl && androidRelease.sha256 ? (
                      <div className={styles.androidDownload}>
                        <div className={styles.androidReleaseMeta}>
                          <span>Current signed release</span>
                          <strong>
                            v{androidRelease.version}
                            {androidRelease.apkSize
                              ? ` · ${formatMegabytes(androidRelease.apkSize)}`
                              : ''}
                          </strong>
                        </div>
                        <a
                          className={styles.apkAction}
                          href={androidRelease.apkUrl}
                          rel="noopener noreferrer"
                        >
                          Download Android APK
                          <Icon.Download aria-hidden weight="bold" />
                        </a>
                        <div className={styles.checksum}>
                          <span>SHA-256</span>
                          <code>{androidRelease.sha256}</code>
                        </div>
                        <p>
                          Install this APK from the Omnix website. Omnix is not distributed through
                          the Google Play Store.
                        </p>
                      </div>
                    ) : (
                      <div className={styles.androidUnavailable}>
                        The signed Android release is being prepared. Return here for the official
                        Omnix website download.
                      </div>
                    )
                  ) : null}
                  <div className={styles.clientDetails}>
                    <div>
                      <h4>Requirements</h4>
                      <ul>
                        {client.requirements.map((requirement) => (
                          <li key={requirement}>{requirement}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Install or connect</h4>
                      <ol>
                        {client.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <Link className={styles.clientGuide} href={`/${locale}/docs/${client.docSlug}`}>
                    Read the {client.name.toLowerCase()} guide
                    <Icon.ArrowRight aria-hidden weight="bold" />
                  </Link>
                </article>
              )
            })}
          </div>

          <p className={styles.platformNote}>
            iOS is not available. Google Play distribution is not live, so install Android only
            from the signed APK supplied on the Omnix website. The browser companion is read-only
            and initially works only on the branch LAN.
          </p>
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
