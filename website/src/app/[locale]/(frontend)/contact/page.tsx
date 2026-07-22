/* Hallmark · Working Counter · contact routing desk · procedural, not simulated */
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

import { PageContainer } from '@/components/layout/layout-primitives'
import { ContactForm } from '@/components/marketing/contact-form'
import { DemoBookingForm } from '@/components/marketing/demo-booking-form'
import { Button } from '@/components/ui/button'
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
  const canonical = `${SITE_URL}/${locale}/contact`

  return {
    title: 'Book an Omnix demo or contact the team',
    description:
      'Book a prepared Omnix product demo, open the configured WhatsApp chat, or email Omnix support. Each route states what happens next.',
    alternates: {
      canonical,
      languages: buildAlternatesLanguages('/contact'),
    },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Book an Omnix demo or contact the team',
      description:
        'Choose the dedicated demo request, configured WhatsApp chat, or support email route.',
      type: 'website',
    }),
  }
}

function whatsappQuestionHref(base: string | null): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent('Hi Omnix, I would like to ask about Omnix for my business.')}`
}

interface ContactPageProps {
  searchParams: Promise<{ type?: string; product?: string }>
}

type DemoProduct = 'pharmacy' | 'retail' | 'hospitality' | 'hardware' | 'salon'
const DEMO_PRODUCTS = new Set<DemoProduct>(['pharmacy', 'retail', 'hospitality', 'hardware', 'salon'])

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const locale = await getLocale()
  const query = await searchParams
  const settings = await getSiteSettings()
  const whatsappHref = whatsappQuestionHref(settings.whatsappUrl)
  const type = query.type

  if (type === 'demo') {
    const initialProduct = DEMO_PRODUCTS.has(query.product as DemoProduct)
      ? query.product as DemoProduct
      : undefined

    return (
      <div className="border-b border-[var(--color-border)]">
        <PageContainer width="wide" className="py-[var(--space-section)]">
          <div className="grid min-w-0 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 xl:gap-24">
            <div className="min-w-0">
              <header className="max-w-3xl border-b border-[var(--color-border)] pb-10 sm:pb-12">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  Book a demo
                </p>
                <h1 className="mt-4 overflow-wrap-anywhere text-balance text-[clamp(2.4rem,7vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--color-fg)]">
                  A demo built around your counter.
                </h1>
                <p className="mt-6 max-w-[58ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
                  Tell us what you sell, how many locations you run, and where work gets stuck. We will prepare the relevant POS, inventory, payment, and operating workflows.
                </p>
              </header>

              <div className="pt-10 sm:pt-12">
                <DemoBookingForm
                  initialProduct={initialProduct}
                  locale={locale}
                  whatsappUrl={settings.whatsappUrl}
                />
              </div>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <div className="border-t-2 border-[var(--color-fg)] pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  Demo docket
                </p>
                <ol className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                  {[
                    ['01', 'We review the business details you send.'],
                    ['02', 'We contact you to confirm a suitable time.'],
                    ['03', 'The session follows your selected workflows.'],
                  ].map(([number, text]) => (
                    <li key={number} className="grid grid-cols-[2rem_1fr] gap-3 py-4">
                      <span className="font-mono text-[10px] text-[var(--color-accent)]">{number}</span>
                      <span className="text-[13px] leading-5 text-[var(--color-fg-muted)]">{text}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 text-[12px] leading-5 text-[var(--color-fg-subtle)]">
                  Your request is stored for follow-up. Product updates are optional and require a separate choice in the form.
                </p>
                {whatsappHref ? (
                  <Button asChild variant="outline" size="lg" className="mt-6 w-full">
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">Ask on WhatsApp instead</a>
                  </Button>
                ) : null}
              </div>
            </aside>
          </div>
        </PageContainer>
      </div>
    )
  }

  return (
    <div className="min-w-0 border-b border-[var(--color-border)]">
      <PageContainer width="wide" className="py-[var(--space-section-tight)] sm:py-[var(--space-section)]">
        <header className="grid min-w-0 gap-10 border-b border-[var(--color-border)] pb-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end lg:gap-20 lg:pb-16">
          <div className="min-w-0">
            <h1 className="max-w-[11ch] text-balance text-[clamp(2.8rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-[var(--color-fg)]">
              Choose the shortest route.
            </h1>
          </div>
          <div className="min-w-0 border-t-2 border-[var(--color-fg)] pt-5">
            <p className="max-w-[52ch] text-[15px] leading-7 text-[var(--color-fg-muted)] sm:text-[16px]">
              Book a prepared product demo, continue in WhatsApp, or write to support. There is no generic form on this page pretending to send a message.
            </p>
          </div>
        </header>

        <div className="pt-10 sm:pt-14">
          <ContactForm
            locale={locale}
            supportEmail={settings.supportEmail}
            whatsappUrl={settings.whatsappUrl}
            whatsappDisplay={settings.whatsappDisplay}
          />
        </div>
      </PageContainer>
    </div>
  )
}
