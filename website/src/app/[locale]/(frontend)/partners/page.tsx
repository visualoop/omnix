import type { Metadata } from 'next'

import { PartnersForm } from '@/components/marketing/partners-form'
import {
  TrustClosing,
  TrustFormLayout,
  TrustHero,
  TrustList,
  TrustPage,
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
  const canonical = `${SITE_URL}/${locale}/partners`

  return {
    title: 'Partner with Omnix — reselling, integration, and OEM',
    description:
      'Omnix is private commercial software. Resellers, distributors, integrators, and OEMs work with Omnix under a written agreement. Submit an enquiry to start the conversation.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/partners'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Partner with Omnix',
      description:
        'Reselling, integration, OEM, and referral partnerships under a written agreement.',
      type: 'website',
    }),
  }
}

const PARTNER_TYPES = [
  {
    term: 'Resellers',
    detail:
      'Sell licences and onboard businesses in your county or region under an agreed margin and territory.',
  },
  {
    term: 'Integrators',
    detail:
      'Build deployments that connect Omnix to a specific industry workflow for the businesses you serve.',
  },
  {
    term: 'OEM',
    detail:
      'Bundle Omnix with a hardware kit — point-of-sale terminals, mini PCs, or kiosks — under an OEM agreement.',
  },
  {
    term: 'Referral',
    detail:
      'Introduce customers in exchange for an agreed revenue share, without carrying deployment or support yourself.',
  },
] as const

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, settings] = await Promise.all([params, getSiteSettings()])
  const whatsappMessage = 'Hi Omnix, I would like to discuss a partnership.'

  return (
    <TrustPage>
      <TrustHero
        kicker="Partnerships"
        title="Carry Omnix to"
        accent="your market."
        lede="Omnix is private commercial software — not open source. Resellers, regional distributors, integrators, and OEMs work with Omnix under a written agreement that sets out margin, territory, support expectations, and brand use."
        factsTitle="Partnership basis"
        facts={[
          { label: 'Software', value: 'Private commercial licence — no forking or white-label without agreement' },
          { label: 'Models', value: 'Reseller, integrator, OEM, or referral' },
          { label: 'Agreement', value: 'Written, covering margin, territory, support, and brand use' },
          { label: 'Next step', value: 'Submit an enquiry; we reply by email once it is reviewed' },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="partner-types"
        kicker="Who we work with"
        title="Four ways to work together."
        intro="Each model is defined in the agreement. Tell us which fits and we shape the terms around it."
      >
        <TrustList items={PARTNER_TYPES} />
      </TrustSection>

      <TrustSection
        id="partner-enquiry"
        alt
        kicker="Start the conversation"
        title="Tell us what you are working on."
        intro="Submitting the form is not a partnership offer — it starts a review. The more concrete the detail, the faster the fit becomes clear."
      >
        <TrustFormLayout
          intro={[
            'Omnix is the proprietary commercial software of Omnix. You cannot fork it, white-label it, host a clone, or resell it without a signed agreement. The agreement itself is straightforward and is signed quickly when the fit is clear.',
            'Include your country and region, the industries you serve, an estimate of monthly deployments, and anything distinctive about your distribution — physical stores, training centres, or an integration team.',
          ]}
        >
          <PartnersForm />
        </TrustFormLayout>
      </TrustSection>

      <TrustClosing
        kicker="Prefer to see it first?"
        title="Book a demo before you commit to a territory."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
