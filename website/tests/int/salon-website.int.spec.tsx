import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SALON_CAPABILITIES, SalonWebsite } from '@/components/marketing/salon-website'

const ROUTE = join(process.cwd(), 'src', 'app', '[locale]', '(frontend)', 'salon', 'page.tsx')
afterEach(cleanup)

const renderPage = (locale = 'ke') => render(<SalonWebsite locale={locale} />)

describe('Salon & Spa public product website', () => {
  it('uses implemented appointment-first workflows without unsupported marketing claims', () => {
    renderPage()
    const page = document.querySelector('[data-salon-website]')
    for (const term of ['Appointment diary', 'Services and staff skills', 'Chairs, rooms, beds, and stations', 'Client notes and visit history', 'Packages and memberships', 'Appointment checkout', 'Commission records', 'Products used during services']) {
      expect(page?.textContent).toMatch(new RegExp(term, 'i'))
    }
    expect(SALON_CAPABILITIES).toHaveLength(8)
    expect(page?.textContent).toMatch(/Public internet self-booking is not included/i)
    expect(page?.textContent).not.toMatch(/\bERP\b|\bAI\b|certified|guaranteed compliance|trusted by|online booking portal/i)
  })

  it('distinguishes local work, connected Kenya services, retry, and business responsibility', () => {
    const { rerender } = render(<SalonWebsite locale="ke" />)
    expect(screen.getByText(/Appointments entered by salon staff.*use the local desktop database/i)).not.toBeNull()
    expect(screen.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).not.toBeNull()
    expect(screen.getByText(/queued for retry/i)).not.toBeNull()
    expect(screen.getByText(/Your business remains responsible/i)).not.toBeNull()

    rerender(<SalonWebsite locale="ng" />)
    expect(document.querySelector('[data-salon-website]')?.textContent).not.toMatch(/M-Pesa|KRA eTIMS/i)
    expect(screen.getByText(/available only where Omnix supports the provider/i)).not.toBeNull()
  })

  it('uses locale-aware demo links, configured WhatsApp, and a useful fail-closed docket', () => {
    const { rerender } = render(<SalonWebsite locale="ng" />)
    for (const link of screen.getAllByRole('link', { name: 'Book a Salon & Spa demo' })) expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=salon')
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('Two staff members and three sample visits')).not.toBeNull()
    expect(screen.getByText('No unapproved image substituted')).not.toBeNull()

    rerender(<SalonWebsite locale="ke" whatsappUrl="https://wa.me/254700000000" heroVideo={{ url: 'https://media.omnix.co.ke/salon.webm', posterUrl: 'https://media.omnix.co.ke/salon-poster.webp', alt: 'Salon appointment workflow', mimeType: 'video/webm' }} />)
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    const video = document.querySelector('video')
    expect(video).toHaveProperty('muted', true)
    expect(video?.getAttribute('poster')).toBe('https://media.omnix.co.ke/salon-poster.webp')
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(screen.getByText('Salon appointment workflow')).not.toBeNull()
  })

  it('uses only approved Task 8 Salon slots and localized canonical alternates', () => {
    const route = readFileSync(ROUTE, 'utf8')
    expect(route).toContain("getSlotImage('module.salon.hero')")
    expect(route).toContain("getSlotMedia('module.salon.video')")
    expect(route).toContain("getSlotImage('module.salon.video-poster')")
    expect(route).toContain("buildAlternatesLanguages('/salon')")
    expect(route).toContain('const canonical = `${SITE_URL}/${locale}/salon`')
    expect(route).not.toContain('VariantLanding')
  })
})
