import type { Metadata } from 'next'
import { headers } from 'next/headers'

import {
  buildWhatsAppHref,
  TrustChannelGrid,
  TrustClosing,
  TrustHero,
  TrustList,
  TrustPage,
  TrustSection,
  type TrustChannel,
} from '@/components/marketing/trust-pages'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { auth } from '@/lib/auth'
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
  const canonical = `${SITE_URL}/${locale}/support`

  return {
    title: 'Omnix support — real routes to a human',
    description:
      'How to get help with Omnix: the configured WhatsApp line, documentation, support email, and dashboard tickets for licensed customers. Each route says what it is for.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/support'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Omnix support',
      description: 'The configured routes for Omnix help — WhatsApp, docs, email, and dashboard tickets.',
      type: 'website',
    }),
  }
}

const ANSWERS = [
  {
    term: 'Offline use',
    detail:
      'Point of sale, inventory, customers, and reports run from the local database on your device. A connection is only needed for connected services such as payments, tax submission, insurance verification, and updates.',
  },
  {
    term: 'Where data lives',
    detail:
      'Business records are written to a local database on the Windows device. How backups and any optional cloud copy work — and their limits — is set out on the security page.',
  },
  {
    term: 'Users and sign-in',
    detail:
      'The business owner creates staff users inside the desktop app; there is no public sign-up. Website account and licence access is through the customer dashboard, and a forgotten dashboard password can be reset from the sign-in screen.',
  },
  {
    term: 'Devices and branches',
    detail:
      'Extra devices and branches are handled through licensing and your agreement, which set the limits. The pricing page explains the current options.',
  },
] as const

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const reqHeaders = await headers()
  const [{ locale }, settings, session] = await Promise.all([
    params,
    getSiteSettings(),
    auth.api.getSession({ headers: reqHeaders }).catch(() => null),
  ])
  const whatsappMessage = 'Hi Omnix, I need help with Omnix.'
  const whatsappSupportHref = buildWhatsAppHref(settings.whatsappUrl, whatsappMessage)
  const ticketHref = session
    ? '/dashboard/support'
    : '/login?next=%2Fdashboard%2Fsupport%2Fnew'

  const channels: TrustChannel[] = [
    {
      title: 'Support inbox and tickets',
      body: 'Start a ticket and keep every customer and Omnix reply in the same account-backed conversation. Closed or resolved tickets reopen when you send a follow-up.',
      href: ticketHref,
      linkLabel: session ? 'Open your support inbox' : 'Sign in and start a ticket',
    },
    ...(whatsappSupportHref
      ? [
          {
            title: 'WhatsApp',
            body: 'The quickest route for a short question or an urgent issue at the counter. Opens the configured Omnix WhatsApp line with a message started for you.',
            href: whatsappSupportHref,
            linkLabel: 'Open WhatsApp',
            external: true,
          } satisfies TrustChannel,
        ]
      : []),
    {
      title: 'Documentation',
      body: 'Step-by-step guides for setup, day-to-day use, and the connected services. Best when you want to follow a procedure at your own pace.',
      href: `/${locale}/docs`,
      linkLabel: 'Browse the docs',
    },
    {
      title: 'Support email',
      body: 'For a detailed issue you can describe in writing, with screenshots or files. Write to the configured support address.',
      href: `mailto:${settings.supportEmail}`,
      linkLabel: `Email ${settings.supportEmail}`,
      external: true,
    },
  ]

  return (
    <TrustPage>
      <TrustHero
        kicker="Support"
        title="Real routes to"
        accent="a human."
        lede="Open your account-backed support inbox to start or continue a ticket. You and the Omnix team reply in the same visible thread, with WhatsApp, email, and documentation available when they fit better."
        factsTitle="Where help comes from"
        facts={[
          { label: 'Fastest', value: settings.whatsappUrl ? 'Configured WhatsApp line' : 'A booked demo or support email' },
          { label: 'Self-serve', value: 'Documentation with step-by-step guides' },
          { label: 'Account help', value: 'A searchable ticket conversation with Omnix staff' },
          { label: 'Email', value: settings.supportEmail },
        ]}
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />

      <TrustSection
        id="support-channels"
        kicker="Get help"
        title="Pick the route that fits the problem."
        intro="No channel here promises a turnaround it cannot keep. They are simply the ways to reach the team and the documentation."
      >
        <TrustChannelGrid channels={channels} />
      </TrustSection>

      <TrustSection
        id="support-answers"
        alt
        kicker="Before you write in"
        title="Answers to the questions asked most."
        intro="A few things worth checking first — most of them come down to what is local and what needs a connection."
      >
        <TrustList items={ANSWERS} />
      </TrustSection>

      <TrustClosing
        kicker="Weighing it up?"
        title="A demo answers most questions in one session."
        locale={locale}
        whatsappUrl={settings.whatsappUrl}
        whatsappMessage={whatsappMessage}
      />
    </TrustPage>
  )
}
