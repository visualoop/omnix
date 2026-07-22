/* Hallmark · Working Counter · legal ledger */
import type { Metadata } from 'next'

import { LegalLayout } from '@/components/marketing/legal-layout'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/privacy`
  return {
    title: 'Privacy policy — Omnix',
    description:
      'Where your Omnix data lives, what stays on your device, what optional telemetry and cloud backup send, and the third parties involved in payment and email.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/privacy'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix privacy policy',
      description:
        'Business data stays on your device. This page explains the local record, optional telemetry, optional encrypted cloud backup, and the third parties for payment and email.',
      type: 'website',
    }),
  }
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])

  return (
    <LegalLayout
      kicker="Data handling"
      title="Privacy policy"
      description="Omnix runs on your Windows machine. Your business records stay there by default. This page is specific about what leaves the device and when."
      lastUpdated="2026-07-01"
      locale={locale}
      supportEmail={settings.supportEmail}
      sections={[
        {
          id: 'overview',
          heading: 'The short version',
          body: (
            <>
              <p>
                Omnix is desktop software. Your business data — customers, products, sales,
                prescriptions, employees — is written to a local database on your machine and does
                not leave it unless you turn on cloud backup or share an export with support.
              </p>
              <p>
                This policy covers the account data we hold to run your licence, the optional
                diagnostics you can send us, optional cloud backup, and the third parties involved.
              </p>
            </>
          ),
        },
        {
          id: 'local-data',
          heading: 'Data that stays on your device',
          body: (
            <>
              <p>
                <strong>Business data (local by default):</strong> customer names, product names,
                sale amounts, prescriptions, employee details, and bank transactions live in a
                SQLite database file on your Windows machine. We never see this data unless you
                contact support and choose to share an export.
              </p>
              <p>
                Omnix does not encrypt the local database file itself. Access to it depends on your
                Windows account, physical access to the computer, and any full-disk encryption you
                configure. Securing the device is your responsibility; the software keeps the record
                local so that responsibility stays with you.
              </p>
            </>
          ),
        },
        {
          id: 'account-data',
          heading: 'Account data we hold',
          body: (
            <>
              <p>
                To operate your account and licence we store your name, email, phone, business name,
                KRA PIN (if you provide one), licence keys, activated machines, and payment history.
                This is the minimum needed to issue a licence, bind it to a device, and support you.
              </p>
              <p>We do not sell your data to anyone.</p>
            </>
          ),
        },
        {
          id: 'telemetry',
          heading: 'Telemetry and diagnostics',
          body: (
            <>
              <p>
                Diagnostics are opt-in. If you enable them, Omnix may send the app version, the
                operating-system version, the active module, error logs, and aggregated counts such
                as the number of branches, users, and sales — plus a random session identifier that
                is not tied to your identity. You can turn this off at any time in Settings →
                Privacy.
              </p>
              <p>
                <strong>What is never sent:</strong> customer names, product names, sale amounts,
                prescriptions, employee names, national IDs, KRA PINs, bank account numbers, M-Pesa
                till numbers, or any free-text you type. Diagnostics are used to fix bugs and
                prioritise work — never sold or shared with third parties.
              </p>
            </>
          ),
        },
        {
          id: 'website-analytics',
          heading: 'Website analytics (optional, opt-in)',
          body: (
            <>
              <p>
                This website can measure anonymous page visits with Google Analytics, but only if
                you choose &ldquo;Accept analytics&rdquo; in the notice we show you. Until you
                accept, no analytics script loads and no request is made to Google. If you never
                accept, nothing is measured.
              </p>
              <p>
                Your choice is stored on your device in local storage, not in a cookie, and it is
                not tied to any identifier we could use to recognise you. If your browser sends a
                Do Not Track or Global Privacy Control signal, analytics stays off and we do not
                ask.
              </p>
              <p>
                <strong>What a page view records:</strong> a normalised page path drawn from a
                fixed allowlist of public pages (for example <code>/ke/pharmacy</code>) and the
                site origin — nothing more. Article, guide, and location pages are recorded by a
                generic template such as <code>/ke/blog/article</code>, never the specific slug,
                and any path we do not recognise is recorded as <code>/ke/not-found</code>. We do
                not send the page title, the query string, the fragment after a <code>#</code>, the
                page you came from, or the full address. Checkout, account, and admin pages sit
                outside this measurement, so a payment, order, or licence reference can never reach
                it.
              </p>
              <p>
                <strong>What a conversion records:</strong> for a small set of actions (a completed
                demo request, a WhatsApp click, starting a product video), we send the event name
                plus up to three fixed labels: which product, which country, and which control. No
                name, email, phone, business name, message, amount, or reference is ever included.
              </p>
              <p>
                You can change your mind at any time with <strong>Analytics preferences</strong> in
                the site footer, without clearing your browser storage. Turning analytics off does
                not affect the product, your purchase, or the support you receive. This is our own
                practice, not a certification or a legal guarantee.
              </p>
            </>
          ),
        },
        {
          id: 'cloud-backup',
          heading: 'Cloud backup (optional)',
          body: (
            <>
              <p>
                Cloud backup is an optional add-on (KES 500 per month per branch). When it is on,
                each snapshot of your local database is encrypted on your device with AES-256-GCM
                <strong> before</strong> it is uploaded to Cloudflare R2 storage we operate from
                London. The encryption key is derived from your password plus your licence key, so
                the Omnix team cannot decrypt your backup.
              </p>
              <p>You can delete your cloud backups at any time from your dashboard.</p>
            </>
          ),
        },
        {
          id: 'third-parties',
          heading: 'Third parties we rely on',
          body: (
            <>
              <p>
                <strong>Paystack</strong> processes payments. We share the name, email, phone, and
                amount needed to take payment; Paystack&rsquo;s own privacy terms apply.
              </p>
              <p>
                <strong>Resend</strong> sends transactional email such as a licence key or a
                compliance-renewal reminder. We share your name and email for that purpose.
              </p>
              <p>
                <strong>Cloudflare R2</strong> stores cloud backups if you enable them. Data is
                encrypted on your device before it reaches Cloudflare.
              </p>
              <p>
                <strong>Google Analytics</strong> measures anonymous page visits on this website,
                and only after you opt in. Before you accept, no request reaches Google. See
                &ldquo;Website analytics&rdquo; above for exactly what is sent.
              </p>
              <p>
                If you connect an AI provider, you supply your own key and requests go directly from
                your machine to that provider — we do not see your prompts, responses, or keys.
              </p>
            </>
          ),
        },
        {
          id: 'your-rights',
          heading: 'Your choices',
          body: (
            <>
              <p>You can:</p>
              <ul>
                <li>
                  Ask for a copy of the account data we hold — email{' '}
                  <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>.
                </li>
                <li>Ask us to delete your account; we remove account data within 30 days.</li>
                <li>Turn diagnostics off in Settings → Privacy.</li>
                <li>Export your business data from within Omnix at any time.</li>
                <li>Delete your cloud backups from your dashboard.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about this policy? Email{' '}
              <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
              {settings.whatsappDisplay ? `, or reach us on WhatsApp at ${settings.whatsappDisplay}.` : '.'}
            </p>
          ),
        },
      ]}
    />
  )
}
