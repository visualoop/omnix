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
  const canonical = `${SITE_URL}/${locale}/refund-policy`
  return {
    title: 'Refund policy — Omnix',
    description:
      'How refunds work for an Omnix licence: a 14-day refund window less the Paystack processing fee, and what is not refundable.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/refund-policy'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix refund policy',
      description:
        'If a licence is not the right fit, there is a 14-day refund window less the Paystack processing fee.',
      type: 'website',
    }),
  }
}

export default async function RefundPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])

  return (
    <LegalLayout
      kicker="Payments"
      title="Refund policy"
      description="How refunds work on an Omnix licence, in plain terms. The short version: there is a 14-day window if a licence is not the right fit."
      lastUpdated="2026-07-01"
      locale={locale}
      supportEmail={settings.supportEmail}
      sections={[
        {
          id: 'window',
          heading: 'The 14-day window',
          body: (
            <>
              <p>
                If you buy a licence and decide within 14 days that Omnix is not the right fit, we
                refund the amount you paid less the Paystack processing fee (Paystack does not
                return its fee to us).
              </p>
              <p>
                Email <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> with
                your licence key and a short note. We start the refund as soon as we have confirmed
                the purchase.
              </p>
            </>
          ),
        },
        {
          id: 'after-14-days',
          heading: 'After 14 days',
          body: (
            <p>
              After the window we do not offer refunds, but we do stand behind the software: if
              something is broken we fix it, if a step is unclear we walk you through it, and
              feature requests go on the roadmap. The licence you bought is perpetual, so it keeps
              working regardless.
            </p>
          ),
        },
        {
          id: 'non-refundable',
          heading: 'What is not refundable',
          body: (
            <>
              <p>The following are outside the refund window:</p>
              <ul>
                <li>Optional annual compliance updates once a year has started.</li>
                <li>Cloud backup — cancel any time; partial months are not refunded.</li>
                <li>One-time extra-branch and extra-machine upgrades.</li>
                <li>Major-version upgrade purchases once activated.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'fair-use',
          heading: 'Fair use',
          body: (
            <p>
              We may decline a refund where the request is clearly being used to extract value and
              then reclaim payment — for example repeated refund requests across multiple licences.
              This is about fairness, not fine print.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: 'Questions',
          body: (
            <p>
              Not sure whether a refund applies to you? Email{' '}
              <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
              {settings.whatsappDisplay ? `, or reach us on WhatsApp at ${settings.whatsappDisplay}.` : '.'}
            </p>
          ),
        },
      ]}
    />
  )
}
