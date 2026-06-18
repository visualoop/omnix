import type { Metadata } from 'next'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'
import { ContactForm } from '@/components/marketing/contact-form'
import { getPayload } from 'payload'
import { getLocale } from 'next-intl/server'
import config from '@/payload.config'
import { getSiteSettings } from '@/lib/site-settings'

export const metadata: Metadata = {
  title: 'Contact — talk to us',
  description: 'Book a demo, ask about Custom pricing, or just say hello. We respond within 24 hours.',
}

interface ContactGlobal {
  pageTitle?: string
  pageSubtitle?: string
  methodsHeading?: string
  methods?: { channel: string; label?: string | null; description?: string | null }[]
  faqHeading?: string
  faq?: { question: string; answer: string }[]
  ctaHeading?: string | null
  ctaBody?: string | null
  ctaPrimaryLabel?: string | null
  ctaPrimaryHref?: string | null
}

async function getContactContent(locale: string): Promise<ContactGlobal> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const g = (await payload.findGlobal({
      slug: 'contact-content',
      locale: locale as never,
      overrideAccess: true,
    })) as unknown as ContactGlobal
    return g
  } catch {
    return {}
  }
}

export default async function ContactPage() {
  const locale = await getLocale()
  const [settings, content] = await Promise.all([getSiteSettings(), getContactContent(locale)])

  const title = content.pageTitle ?? 'Talk to us.'
  const subtitle =
    content.pageSubtitle ??
    'Book a demo, ask about Custom pricing, or just say hello. We respond within 24 hours.'

  const methods = (content.methods ?? []).filter((m) => m && m.channel)

  // If no methods configured in CMS, fall back to a sensible default set
  const fallbackMethods: { channel: string; label?: string; description?: string }[] = [
    { channel: 'whatsapp', label: 'WhatsApp' },
    { channel: 'email-support', label: 'Email' },
    { channel: 'office', label: 'Office', description: 'Nairobi, Kenya · By appointment only' },
  ]
  const renderMethods = methods.length > 0 ? methods : fallbackMethods

  return (
    <>
      <PageHero eyebrow="Contact" title={title} description={subtitle} />

      <section className="section">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[28px] font-normal text-[var(--color-fg)]">
                Send us a message
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] text-[var(--color-fg-muted)]">
                We read every message. Real person responds within 24 hours, usually faster.
              </p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>

            <div className="lg:w-80">
              <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal text-[var(--color-fg)]">
                {content.methodsHeading ?? 'Other ways to reach us'}
              </h3>
              <ul className="mt-6 space-y-5">
                {renderMethods.map((m) => {
                  const label = m.label ?? channelLabel(m.channel)
                  const value = renderChannelValue(m.channel, settings)
                  if (!value) return null
                  return (
                    <li key={m.channel}>
                      <div className="caption-mono mb-2">{label}</div>
                      {value}
                      {m.description ? (
                        <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">{m.description}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="caption-mono mb-3">Response time</div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--color-positive)]" />
                  <span className="text-[15px] text-[var(--color-fg)]">Usually within 4 hours</span>
                </div>
                <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">
                  {settings.office.workingHours ??
                    'Monday–Friday, 8am–6pm EAT. Weekend messages answered Monday morning.'}
                </p>
              </div>
            </div>
          </div>

          {content.faq && content.faq.length > 0 ? (
            <section className="mt-20">
              <h2 className="font-[family-name:var(--font-display)] text-[28px] font-normal text-[var(--color-fg)]">
                {content.faqHeading ?? 'Frequently asked'}
              </h2>
              <dl className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-x-12">
                {content.faq.map((q, i) => (
                  <div key={i}>
                    <dt className="text-[16px] font-medium text-[var(--color-fg)]">{q.question}</dt>
                    <dd className="mt-2 text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">{q.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </section>
    </>
  )
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp'
    case 'email-support':
      return 'Support email'
    case 'email-sales':
      return 'Sales email'
    case 'phone':
      return 'Phone'
    case 'office':
      return 'Office'
    default:
      return channel
  }
}

function renderChannelValue(
  channel: string,
  settings: { whatsappUrl: string | null; whatsappDisplay: string | null; supportEmail: string; salesEmail: string | null; phoneNumber: string | null; office: { address: string | null } },
): React.ReactNode {
  switch (channel) {
    case 'whatsapp':
      if (!settings.whatsappUrl) return null
      return (
        <a
          href={settings.whatsappUrl}
          className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
        >
          <Icon.WhatsApp className="size-4" weight="bold" />
          {settings.whatsappDisplay}
        </a>
      )
    case 'email-support':
      return (
        <a
          href={`mailto:${settings.supportEmail}`}
          className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
        >
          <Icon.Email className="size-4" weight="bold" />
          {settings.supportEmail}
        </a>
      )
    case 'email-sales':
      if (!settings.salesEmail) return null
      return (
        <a
          href={`mailto:${settings.salesEmail}`}
          className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
        >
          <Icon.Email className="size-4" weight="bold" />
          {settings.salesEmail}
        </a>
      )
    case 'phone':
      if (!settings.phoneNumber) return null
      return (
        <a
          href={`tel:${settings.phoneNumber.replace(/[^0-9+]/g, '')}`}
          className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
        >
          {settings.phoneNumber}
        </a>
      )
    case 'office':
      if (!settings.office.address) return null
      return (
        <p className="text-[15px] whitespace-pre-line text-[var(--color-fg-muted)]">
          {settings.office.address}
        </p>
      )
    default:
      return null
  }
}
