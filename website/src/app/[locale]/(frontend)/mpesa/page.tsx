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
  const canonical = `${SITE_URL}/${locale}/mpesa`

  return {
    title: 'M-Pesa at the Omnix counter — how it works and where the line is',
    description:
      'How Omnix records an M-Pesa sale locally while STK push, paybill, and till confirmation cross the internet to Safaricom. What Omnix does, what your Daraja account does, and what stays statutory.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/mpesa'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'M-Pesa at the Omnix counter',
      description:
        'The local sale record versus the connected M-Pesa request — explained honestly for Kenyan businesses.',
      type: 'website',
    }),
  }
}

const FLOWS = [
  {
    term: 'STK push',
    detail:
      'The till sends a payment prompt to the customer’s phone number, and the customer approves it on their own handset. The prompt has to reach Safaricom and the phone, so this step needs a connection at the moment of payment.',
  },
  {
    term: 'Paybill',
    detail:
      'Customers pay your paybill against an account reference, often the invoice number. The sale is already in Omnix; matching it to the incoming payment relies on the confirmation arriving over the connection.',
  },
  {
    term: 'Till (Buy Goods)',
    detail:
      'Customers pay your till number and share the M-Pesa code. The code can be recorded against the open sale so the local record is complete even before online confirmation is reconciled.',
  },
  {
    term: 'Reconciliation',
    detail:
      'M-Pesa payments are matched to Omnix sales by reference. Pulling and comparing confirmations against your own M-Pesa records is a connected step; the underlying sales remain in the local database regardless.',
  },
] as const

const BOUNDARIES = [
  {
    owner: 'On the device',
    title: 'The sale is recorded locally.',
    body: 'Ringing up a sale, recording the amount and payment method, and printing or reprinting the receipt happen in the local database — whether or not the internet is up.',
  },
  {
    owner: 'Needs a connection',
    title: 'The M-Pesa request travels online.',
    body: 'STK push, and confirmation of a paybill or till payment, require internet access at the moment of payment so the request can reach Safaricom and the customer’s phone.',
  },
  {
    owner: 'Your configuration',
    title: 'A Safaricom business account is required.',
    body: 'M-Pesa collection runs against your own Safaricom Daraja business account — paybill or till — set up with valid credentials. Omnix connects to that account; it does not provide the M-Pesa account for you.',
  },
  {
    owner: 'Safaricom & KRA',
    title: 'Fees and tax stay with the provider and the authority.',
    body: 'Transaction charges are set by Safaricom and billed directly to your business; Omnix takes no margin on M-Pesa. The tax treatment of each sale, and any eTIMS receipt, remain your statutory responsibility.',
  },
] as const

export default async function MpesaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like a demo of M-Pesa at the till.'

  return (
    <TrustPage>
      <TrustHero
        kicker="M-Pesa · Kenya"
        title="M-Pesa at the counter,"
        accent="recorded either way."
        lede="Omnix supports STK push, paybill, and till payments at the till. The sale itself is written to the local record whether you are online or off; the M-Pesa request to Safaricom is a connected step that needs the internet and your own business account."
        factsTitle="M-Pesa at a glance"
        facts={[
          { label: 'Sale record', value: 'Stored locally, online or offline' },
          { label: 'M-Pesa request', value: 'Needs internet at payment time' },
          { label: 'Account', value: 'Your Safaricom Daraja paybill or till' },
          { label: 'Fees', value: 'Set by Safaricom — Omnix takes no margin' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="mpesa-flows"
        kicker="How it works"
        title="Three ways customers pay, one sale record."
        intro="However the customer chooses to pay, Omnix keeps the sale in the same local ledger. Only the confirmation of the M-Pesa payment depends on a connection."
      >
        <TrustList items={FLOWS} />
      </TrustSection>

      <BoundaryLedger
        title="What is local, what is connected, and what stays yours."
        intro="M-Pesa spans your device, Safaricom’s network, and your own accounts. This ledger keeps those responsibilities separate so there are no surprises."
        items={BOUNDARIES}
      />

      <TrustSection
        id="mpesa-offline"
        alt
        kicker="When the line is down"
        title="The counter keeps working."
        intro="A dropped connection stops the online request, not the sale."
      >
        <TrustProse
          paragraphs={[
            'If the internet is down at the moment of payment, the STK push cannot be sent. The sale is still recorded in Omnix, and where a customer has paid by till or paybill and can share the M-Pesa code, that code can be entered against the sale so the local record is complete.',
            'When a connection returns, M-Pesa confirmations can be reconciled against your Omnix sales, and any KRA eTIMS receipt that could not be submitted earlier can be retried. Omnix does not promise a fixed reconciliation time; it keeps the local record intact so the connected steps can catch up.',
          ]}
        />
      </TrustSection>

      <TrustClosing
        kicker="See it at your till"
        title="Book a demo and pay a real test sale by M-Pesa."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
