import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ContactForm } from '@/components/marketing/contact-form'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const securityPage = read('src/app/[locale]/(frontend)/security/page.tsx')
const contactPage = read('src/app/[locale]/(frontend)/contact/page.tsx')
const contactChannels = read('src/components/marketing/contact-form.tsx')

afterEach(cleanup)
const demoForm = read('src/components/marketing/demo-booking-form.tsx')

function hrefOf(link: HTMLElement): string | null {
  return link.getAttribute('href')
}

describe('security acquisition route', () => {
  it('states implemented controls and their actual boundaries', () => {
    for (const claim of [
      'Local SQLite record',
      'Argon2id',
      'Owner, Manager, Cashier, and Viewer',
      'high-risk or critical permission checks',
      'AES-256-GCM',
      'RSA signature',
      'Tauri updater',
    ]) {
      expect(securityPage).toContain(claim)
    }

    expect(securityPage).toContain('The database file is not encrypted by Omnix')
    expect(securityPage).toContain('Local .db backup files are ordinary database copies')
    expect(securityPage).toContain('not a tamper-proof external ledger')
    expect(securityPage).toContain('Checking for and downloading a release requires internet access')
  })

  it('does not repeat the previous absolute or unsupported security promises', () => {
    expect(securityPage).not.toMatch(/immutable audit log/i)
    expect(securityPage).not.toMatch(/never on someone else['’]s server/i)
    expect(securityPage).not.toMatch(/stolen laptop never means/i)
    expect(securityPage).not.toMatch(/roll back to any prior version/i)
    expect(securityPage).not.toMatch(/safe to trust with a decade/i)
    expect(securityPage).not.toMatch(/encrypted backups \(both local/i)
  })

  it('keeps acquisition and support actions locale-safe and configuration-backed', () => {
    expect(securityPage).toContain('const demoHref = `/${locale}/contact?type=demo`')
    expect(securityPage).toContain('settings.whatsappUrl')
    expect(securityPage).toContain('settings.supportEmail')
    expect(securityPage).toContain("buildAlternatesLanguages('/security')")
    expect(securityPage).toContain('`${SITE_URL}/${locale}/security`')
    expect(securityPage).not.toContain('href="/signup"')
  })
})

describe('general contact acquisition route', () => {
  it('renders procedural channels with demo primary, WhatsApp secondary, and support email', () => {
    render(
      <ContactForm
        locale="ng"
        supportEmail="support@omnix.co.ke"
        whatsappUrl="https://wa.me/254700000000"
        whatsappDisplay="+254 700 000 000"
      />,
    )

    expect(hrefOf(screen.getByRole('link', { name: 'Book a demo' }))).toBe('/ng/contact?type=demo')
    expect(hrefOf(screen.getByRole('link', { name: 'Ask on WhatsApp' }))).toContain('https://wa.me/254700000000?text=')
    expect(hrefOf(screen.getByRole('link', { name: 'Email support' }))).toContain('mailto:support@omnix.co.ke')
    expect(screen.getByText(/This page does not send a message for you/)).toBeTruthy()
    expect(document.querySelector('form')).toBeNull()
  })

  it('does not simulate a generic submission or fabricate response timing', () => {
    expect(contactChannels).not.toContain('setTimeout')
    expect(contactChannels).not.toContain('console.info')
    expect(contactChannels).not.toContain('onSubmit')
    expect(contactChannels).not.toMatch(/within (one|1|four|4|24) (business )?(hour|hours)/i)
    expect(contactPage).toContain("buildAlternatesLanguages('/contact')")
    expect(contactPage).toContain('`${SITE_URL}/${locale}/contact`')
    expect(contactPage).not.toMatch(/usually respond|response time|within 24 hours/i)
  })

  it('preserves the dedicated demo branch and production API form', () => {
    expect(contactPage).toContain("type === 'demo'")
    expect(contactPage).toContain('<DemoBookingForm')
    expect(contactPage).toContain('initialProduct={initialProduct}')
    expect(contactPage).toContain('locale={locale}')
    expect(contactPage).toContain('whatsappUrl={settings.whatsappUrl}')
    expect(demoForm).toContain("fetch('/api/demo-requests'")
  })

  it('degrades cleanly when WhatsApp is not configured', () => {
    render(
      <ContactForm
        locale="ke"
        supportEmail="support@omnix.co.ke"
        whatsappUrl={null}
        whatsappDisplay={null}
      />,
    )

    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()
    expect(hrefOf(screen.getByRole('link', { name: 'Book a demo' }))).toBe('/ke/contact?type=demo')
    expect(screen.getByRole('link', { name: 'Email support' })).toBeTruthy()
  })
})
