import type { Metadata } from 'next'

import {
  BoundaryLedger,
  TrustClosing,
  TrustHero,
  TrustList,
  TrustPage,
  TrustProse,
  TrustSection,
} from '@/components/marketing/trust-pages'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/sha`

  return {
    title: 'SHA insurance billing in Omnix — local records, connected claims',
    description:
      'How Omnix keeps member records, copay splits, and claim drafts locally while SHA verification and claim submission cross the internet. What needs accreditation, and what SHA alone decides.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/sha'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'SHA insurance billing in Omnix',
      description:
        'The local patient and claim record versus connected SHA verification and submission — explained honestly for pharmacies and clinics.',
      type: 'website',
    }),
  }
}

const CAPABILITIES = [
  {
    term: 'Member verification',
    detail:
      'Checking a member’s SHA status and cover is a connected step that calls SHA over the internet. The result is recorded with the visit so the counter knows what is covered before dispensing.',
  },
  {
    term: 'Copay split',
    detail:
      'Where a scheme covers part of a bill, Omnix can split the sale into an insurance portion and a customer copay, both recorded on the same local sale and receipt.',
  },
  {
    term: 'Claim submission',
    detail:
      'Claims are prepared on the local record and submitted to SHA over a connection, in batches you control. Each line returns accepted or rejected with the reason SHA gives.',
  },
  {
    term: 'Settlement tracking',
    detail:
      'A claim moves through submitted, accepted, and paid as SHA responds. Matching payouts against your own records is a connected step; the claim records themselves stay local.',
  },
] as const

const BOUNDARIES = [
  {
    owner: 'On the device',
    title: 'Patient records and claim drafts are local.',
    body: 'Member details on file, the sale, the copay split, and the claim as drafted live in the local database, whether or not you are online.',
  },
  {
    owner: 'Needs a connection',
    title: 'Verification and submission go to SHA.',
    body: 'Checking a member’s eligibility and submitting a claim require internet access. When SHA cannot be reached, the sale and the draft claim stay on the local record until they can be sent.',
  },
  {
    owner: 'Your accreditation',
    title: 'An accredited provider account is required.',
    body: 'SHA verification and claims run against your own registered, accredited provider account and credentials. Omnix connects to that account; it does not make your business an accredited provider. Private schemes work only where Omnix supports the scheme and your business is set up with it.',
  },
  {
    owner: 'SHA & the owner',
    title: 'Eligibility and payment are SHA’s decision.',
    body: 'Cover, benefit limits, and whether a claim is approved or paid are determined by SHA under its rules, not by Omnix. Submitting accurate claims and meeting provider obligations remain your responsibility.',
  },
] as const

export default async function ShaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like a demo of SHA insurance billing.'

  return (
    <TrustPage>
      <TrustHero
        kicker="SHA · Kenya"
        title="Insurance kept on the record,"
        accent="claimed through SHA."
        lede="For pharmacies and clinics, Omnix keeps member details, copay splits, and claims on the same local sale record. Verifying a member and submitting a claim are connected steps that go to SHA and depend on your own accredited provider account."
        factsTitle="SHA at a glance"
        facts={[
          { label: 'Member records', value: 'Kept in the local patient record' },
          { label: 'Verify & claim', value: 'Need internet and SHA credentials' },
          { label: 'Eligibility', value: 'Requires an accredited SHA provider account' },
          { label: 'Approval', value: 'Decided by SHA, not by Omnix' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="sha-capabilities"
        kicker="What Omnix does"
        title="From the counter to a submitted claim."
        intro="The steps below stay within what the software does — keep the record locally, verify and submit to SHA when connected, and track the response."
      >
        <TrustList items={CAPABILITIES} />
      </TrustSection>

      <BoundaryLedger
        title="What is local, what needs SHA, and what SHA alone decides."
        intro="SHA billing spans your device, SHA’s systems, and your accreditation. This ledger keeps those responsibilities separate so the claim boundary is clear."
        items={BOUNDARIES}
      />

      <TrustSection
        id="sha-offline"
        alt
        kicker="When SHA cannot be reached"
        title="Dispensing does not stop."
        intro="A missing connection defers verification and submission, not the visit."
      >
        <TrustProse
          paragraphs={[
            'If SHA cannot be reached, the sale is still recorded and the claim can be drafted and held rather than lost. Where your workflow requires verified eligibility before dispensing on insurance, that check waits for a connection, and the copay or cash arrangement is handled on the local record in the meantime.',
            'When the line returns, verification can be repeated and queued claims submitted. Omnix does not decide cover or approve claims and does not promise a fixed turnaround; those outcomes belong to SHA, and it remains your responsibility to reconcile what SHA accepts and pays against your records.',
          ]}
        />
      </TrustSection>

      <TrustClosing
        kicker="See it with a real member"
        title="Book a demo and walk a claim from counter to SHA."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
