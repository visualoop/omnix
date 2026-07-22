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
  const canonical = `${SITE_URL}/${locale}/etims`

  return {
    title: 'KRA eTIMS in Omnix — local invoices, connected signing',
    description:
      'How Omnix creates a tax invoice locally and signs and submits it to KRA eTIMS over a connection. What needs internet, what registration you must hold, and what filing stays your statutory duty.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/etims'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'KRA eTIMS in Omnix',
      description:
        'The local invoice record versus connected KRA signing and submission — explained honestly.',
      type: 'website',
    }),
  }
}

const CAPABILITIES = [
  {
    term: 'Invoice at the till',
    detail:
      'Every sale creates a tax invoice in the local record with its line items, VAT lines, and totals, ready to be signed and sent to KRA.',
  },
  {
    term: 'Control-unit signing',
    detail:
      'Signing an invoice with KRA’s system happens over a connection. A signed invoice carries the KRA control-unit details; an invoice that has not yet been signed is held until it can be sent.',
  },
  {
    term: 'Offline queue',
    detail:
      'When KRA cannot be reached, invoices are queued and retried in order once the connection returns. The till keeps recording sales in the meantime, so trading is not blocked.',
  },
  {
    term: 'Period returns',
    detail:
      'Omnix can prepare period figures such as a VAT3 return from the invoices you have recorded. Reviewing, confirming, and filing the return with KRA remains your responsibility.',
  },
] as const

const BOUNDARIES = [
  {
    owner: 'On the device',
    title: 'Invoices are created and stored locally.',
    body: 'Each sale produces an invoice in the local database with its items, VAT lines, and totals, whether or not you are online. The trading record does not depend on KRA being reachable.',
  },
  {
    owner: 'Needs a connection',
    title: 'Signing and submission cross to KRA.',
    body: 'Signing an invoice with KRA eTIMS and submitting it require internet access. An attempt that cannot complete is queued and retried when the connection returns.',
  },
  {
    owner: 'Your configuration',
    title: 'KRA registration and credentials are required.',
    body: 'eTIMS runs against your own KRA registration: a valid KRA PIN, eTIMS credentials, and each branch or device registered with KRA. Omnix uses that setup; it does not register your business for you.',
  },
  {
    owner: 'KRA & the owner',
    title: 'Tax accuracy and filing stay statutory.',
    body: 'Your VAT registration status, the tax category applied to each item, and the filing of returns remain your obligations under KRA rules. Omnix helps prepare and submit; it does not take on your statutory duties.',
  },
] as const

export default async function EtimsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like a demo of KRA eTIMS in Omnix.'

  return (
    <TrustPage>
      <TrustHero
        kicker="KRA eTIMS · Kenya"
        title="Tax invoices built locally,"
        accent="signed with KRA."
        lede="Omnix creates each tax invoice in the local record as you sell, then signs and submits it to KRA eTIMS when a connection is available. The invoice is never blocked by the line being down; the signing step is the part that needs the internet."
        factsTitle="eTIMS at a glance"
        facts={[
          { label: 'Invoice record', value: 'Created and stored locally' },
          { label: 'Signing', value: 'Needs internet and KRA registration' },
          { label: 'Setup', value: 'Your KRA PIN and eTIMS credentials' },
          { label: 'Filing', value: 'Reviewed and submitted by you' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="etims-capabilities"
        kicker="What Omnix does"
        title="From a till sale to a KRA-signed invoice."
        intro="The steps below stay inside what the software actually does — create the invoice locally, sign it with KRA when connected, and help you prepare the return."
      >
        <TrustList items={CAPABILITIES} />
      </TrustSection>

      <BoundaryLedger
        title="What is local, what needs KRA, and what stays your duty."
        intro="eTIMS involves your device, KRA’s system, and your own tax registration. This ledger keeps those apart so the compliance boundary is clear."
        items={BOUNDARIES}
      />

      <TrustSection
        id="etims-offline"
        alt
        kicker="When KRA cannot be reached"
        title="Selling does not stop."
        intro="A missing connection defers the signing, not the sale."
      >
        <TrustProse
          paragraphs={[
            'If KRA’s system cannot be reached, Omnix records the sale and holds the invoice in a queue rather than blocking the till. Sales keep printing on the local record while the queue waits for a connection.',
            'Once the line returns, queued invoices are retried in order and updated with the KRA control-unit details on success. Omnix does not claim a guaranteed signing time, and it does not remove your responsibility to check that the resulting records match what you have filed with KRA.',
          ]}
        />
      </TrustSection>

      <TrustClosing
        kicker="See a real invoice signed"
        title="Book a demo and watch a test sale reach KRA."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
