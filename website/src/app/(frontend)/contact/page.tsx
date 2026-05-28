import type { Metadata } from 'next'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'
import { ContactForm } from '@/components/marketing/contact-form'

export const metadata: Metadata = {
  title: 'Contact — talk to us',
  description: 'Book a demo, ask about Custom pricing, or just say hello. We respond within 24 hours.',
}

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={<>Talk <em>to us.</em></>}
        description="Book a demo, ask about Custom pricing, or just say hello. We respond within 24 hours."
      />

      <section className="section">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[28px] font-normal text-[var(--color-fg)]">Send us a message</h2>
              <p className="mt-3 text-[15px] text-[var(--color-fg-muted)] max-w-[52ch]">We read every message. Real person responds within 24 hours, usually faster.</p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>

            <div className="lg:w-80">
              <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal text-[var(--color-fg)]">Other ways to reach us</h3>
              <ul className="mt-6 space-y-5">
                <li>
                  <div className="caption-mono mb-2">WhatsApp</div>
                  <a href="https://wa.me/254700000000" className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]">
                    <Icon.WhatsApp className="size-4" weight="bold" />
                    +254 700 000 000
                  </a>
                </li>
                <li>
                  <div className="caption-mono mb-2">Email</div>
                  <a href="mailto:hello@omnix.co.ke" className="inline-flex items-center gap-2 text-[15px] text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]">
                    <Icon.Email className="size-4" weight="bold" />
                    hello@omnix.co.ke
                  </a>
                </li>
                <li>
                  <div className="caption-mono mb-2">Office</div>
                  <p className="text-[15px] text-[var(--color-fg-muted)]">Nairobi, Kenya<br />By appointment only</p>
                </li>
              </ul>

              <div className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="caption-mono mb-3">Response time</div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--color-positive)]" />
                  <span className="text-[15px] text-[var(--color-fg)]">Usually within 4 hours</span>
                </div>
                <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">Monday–Friday, 8am–6pm EAT. Weekend messages answered Monday morning.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
