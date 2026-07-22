import type { Metadata } from 'next'

import {
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
  const canonical = `${SITE_URL}/${locale}/about`

  return {
    title: 'About Omnix — owned business software for owner-operators',
    description:
      'Omnix is offline-first Windows business software you buy once and run on your own device. Read how the product is built and where the boundaries sit before you commit.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/about'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'About Omnix — software your business owns',
      description:
        'Why Omnix is built offline-first for owner-operators, and what stays on your device versus what needs a connection.',
      type: 'website',
    }),
  }
}

const APPROACH = [
  {
    term: 'Owned, not rented',
    detail:
      'Omnix is a one-time Windows licence, not a monthly subscription. The software keeps working on your device whether or not you renew annual compliance updates.',
  },
  {
    term: 'Offline-first',
    detail:
      'The point of sale, inventory, customers, and reports read and write a local database, so the counter keeps moving when the internet line drops.',
  },
  {
    term: 'One working record',
    detail:
      'Sales, stock, purchasing, and accounting share the same local record instead of living in separate spreadsheets and a paper book.',
  },
  {
    term: 'Honest about limits',
    detail:
      'Connected services — payments, tax submission, insurance verification — are described as connected, with the configuration and provider accounts they require named up front.',
  },
] as const

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like to learn more about Omnix for my business.'

  return (
    <TrustPage>
      <TrustHero
        kicker="About Omnix"
        title="Business software your shop"
        accent="actually owns."
        lede="Omnix is offline-first Windows software for owner-operators: point of sale, inventory, customers, suppliers, purchasing, and accounting in one local record. You buy the licence once and run it on your own device."
        factsTitle="What Omnix is"
        facts={[
          { label: 'Licence', value: 'One-time purchase, no subscription' },
          { label: 'Platform', value: 'Windows desktop' },
          { label: 'Data', value: 'Stored in a local database on your device' },
          { label: 'Works', value: 'Offline-first; connected services are optional' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="why-omnix"
        kicker="Why Omnix exists"
        title="Built for the counter, not the boardroom."
        intro="The software is shaped around a single shop that has to keep serving customers whether or not the line is up."
      >
        <TrustProse
          paragraphs={[
            'Many small businesses in Kenya run on a mix of a subscription till, a spreadsheet, and a paper book — and still close the day unsure of what they made. Omnix exists to replace that with one Windows application the business installs once and owns.',
            'The design brief is deliberately narrow: run the whole shop from one local record, keep working when the internet drops, and file with the relevant authorities correctly when a connection is available. Where a task needs the internet, a provider account, or a statutory registration, the product says so plainly rather than implying everything happens by magic.',
          ]}
        />
      </TrustSection>

      <TrustSection
        id="how-we-build"
        alt
        kicker="How Omnix is built"
        title="Four commitments the product keeps."
        intro="These are the rules the software is measured against — not marketing promises about speed or scale."
      >
        <TrustList items={APPROACH} />
      </TrustSection>

      <TrustClosing
        kicker="See it for yourself"
        title="Bring a real working day to a demo."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
