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
  const canonical = `${SITE_URL}/${locale}/terms`
  return {
    title: 'Terms of service — Omnix',
    description:
      'The agreement for using Omnix: a perpetual per-device licence, optional annual compliance updates, payment through Paystack, and how your local data, refunds, and support work.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/terms'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix terms of service',
      description:
        'Perpetual per-device licence, optional compliance updates, Paystack payment, local-first data, and a 14-day refund window — the plain terms of using Omnix.',
      type: 'website',
    }),
  }
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])

  return (
    <LegalLayout
      kicker="Agreement"
      title="Terms of service"
      description="The agreement between you and Omnix when you download, install, or run the software. Written to be read, not to hide behind."
      lastUpdated="2026-07-01"
      locale={locale}
      supportEmail={settings.supportEmail}
      sections={[
        {
          id: 'agreement',
          heading: 'Accepting these terms',
          body: (
            <p>
              By downloading, installing, or using Omnix you agree to these terms. If you do not
              agree, do not install or use the software.
            </p>
          ),
        },
        {
          id: 'licence',
          heading: 'What your licence covers',
          body: (
            <>
              <p>
                Omnix is licensed, not sold. Your licence is <strong>perpetual</strong> and is
                bound to the devices you activate it on — you keep the right to run the version you
                bought for as long as you like, offline, with no recurring fee to keep it working.
              </p>
              <p>
                A single trade licence (Dawa, Retail, Hospitality, Hardware, or Salon &amp; Spa)
                unlocks that trade plus the shared core. Each licence activates on a set number of
                machines; you can add machines or branches as one-time upgrades from your dashboard.
              </p>
              <p>
                You may not reverse-engineer, decompile, resell, redistribute, or sub-license
                Omnix, and you may not use it to break the law. The source that is published is for
                security review only and does not grant a right to reuse it.
              </p>
            </>
          ),
        },
        {
          id: 'payment',
          heading: 'Pricing and payment',
          body: (
            <>
              <p>
                A licence is KES 30,000 one-time. Prices are shown in your region&rsquo;s currency
                at checkout. Payment is processed by Paystack (card, or M-Pesa where available);
                Omnix does not store your card details.
              </p>
              <p>
                The licence itself is perpetual. <strong>Compliance updates</strong> — the
                statutory and regulatory changes such as KRA eTIMS and SHA formats — are an
                optional annual subscription (KES 12,000 per year). Fixes to the version you already
                own are included, and the licence keeps working whether or not you renew; a paid
                compliance year is only needed to keep receiving new statutory updates. Major
                version upgrades are offered to existing owners at 50% of list price.
              </p>
            </>
          ),
        },
        {
          id: 'installers',
          heading: 'Getting the installer',
          body: (
            <p>
              Installers are distributed through your signed-in customer dashboard after purchase.
              We do not publish public installer download links. Activation is still required after
              installing, and device limits apply per licence.
            </p>
          ),
        },
        {
          id: 'data',
          heading: 'Your data',
          body: (
            <p>
              Your business data is yours and lives in a local database file on your machine. Omnix
              does not read it. We only ever see business data if you contact support and choose to
              share an export. You can export your data at any time. The database file is protected
              by your Windows account and any disk encryption you configure — Omnix does not encrypt
              the local file itself, so keeping the device secure is your responsibility.
            </p>
          ),
        },
        {
          id: 'refunds',
          heading: 'Refunds',
          body: (
            <p>
              If you pay and decide within 14 days that Omnix is not the right fit, we refund the
              amount you paid less the Paystack processing fee. After 14 days we do not offer
              refunds, but we will work with you to fix what is not working. Full details are on the
              refund policy page.
            </p>
          ),
        },
        {
          id: 'warranty',
          heading: 'Warranty disclaimer',
          body: (
            <p>
              Omnix is provided &ldquo;as is&rdquo;, without warranty of any kind. We do not
              guarantee it will be uninterrupted or error-free, and we make no certification or
              regulatory-approval claim beyond what the software actually does. Meeting your own tax,
              health, and record-keeping obligations remains your responsibility.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: 'Limitation of liability',
          body: (
            <p>
              To the extent the law allows, our total liability is limited to the amount you paid
              for your licence. We are not liable for lost profits, lost data, or indirect or
              consequential damages. Keep your own backups.
            </p>
          ),
        },
        {
          id: 'termination',
          heading: 'Termination',
          body: (
            <p>
              We may suspend or terminate a licence that breaches these terms. You may stop using
              Omnix at any time. Ending use after the 14-day refund window does not create a right
              to a refund.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: (
            <p>
              We may update these terms as the product changes. The &ldquo;last updated&rdquo; date
              above always reflects the current version. Continuing to use Omnix after a change
              means you accept the updated terms.
            </p>
          ),
        },
        {
          id: 'law',
          heading: 'Governing law',
          body: (
            <p>
              These terms are governed by the laws of Kenya, and disputes are handled by the courts
              of Kenya.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: (
            <p>
              Questions about these terms? Email{' '}
              <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
              {settings.whatsappDisplay ? `, or reach us on WhatsApp at ${settings.whatsappDisplay}.` : '.'}
            </p>
          ),
        },
      ]}
    />
  )
}
