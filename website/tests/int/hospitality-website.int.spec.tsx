import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  HOSPITALITY_CAPABILITIES,
  HospitalityWebsite,
} from '@/components/marketing/hospitality-website'

const HOSPITALITY_ROUTE = join(
  process.cwd(),
  'src',
  'app',
  '[locale]',
  '(frontend)',
  'hospitality',
  'page.tsx',
)

afterEach(cleanup)

describe('Task 12 Hospitality product website', () => {
  it('uses verified Hospitality buyer language without generic or fabricated claims', () => {
    render(<HospitalityWebsite locale="ke" />)

    const page = document.querySelector('[data-hospitality-website]')
    expect(page?.textContent).toMatch(/Restaurant POS/i)
    expect(page?.textContent).toMatch(/tables/i)
    expect(page?.textContent).toMatch(/KOT/i)
    expect(page?.textContent).toMatch(/kitchen orders/i)
    expect(page?.textContent).toMatch(/recipe costing/i)
    expect(page?.textContent).toMatch(/rooms/i)
    expect(page?.textContent).toMatch(/bookings/i)
    expect(page?.textContent).toMatch(/folios/i)
    expect(page?.textContent).toMatch(/stock/i)
    expect(page?.textContent).toMatch(/M-Pesa/i)
    expect(page?.textContent).toMatch(/KRA eTIMS/i)
    expect(HOSPITALITY_CAPABILITIES).toHaveLength(8)

    expect(page?.textContent).not.toMatch(/certified|regulatory approval|guaranteed compliance/i)
    expect(page?.textContent).not.toMatch(/save \d|faster|trusted by|customers trust/i)
    expect(page?.textContent).not.toMatch(/\bERP\b|\bAI\b/i)
  })

  it('keeps Kenya-only connected services out of unsupported locale copy', () => {
    render(<HospitalityWebsite locale="ng" />)

    const page = document.querySelector('[data-hospitality-website]')
    expect(page?.textContent).not.toMatch(/M-Pesa|KRA eTIMS/i)
    expect(page?.textContent).toMatch(/available only where Omnix supports the provider/i)
    expect(page?.textContent).toMatch(/Ask the team what is available in your market/i)
  })

  it('states local, connected, and business responsibility boundaries', () => {
    render(<HospitalityWebsite locale="ke" />)

    expect(screen.getByText(/Restaurant POS records, cash checkout, tables, kitchen orders, recipes, stock, rooms, bookings, and folios use the local desktop database/i)).not.toBeNull()
    expect(screen.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).not.toBeNull()
    expect(screen.getByText(/eTIMS attempt that cannot complete can remain queued for retry/i)).not.toBeNull()
    expect(screen.getByText(/Your business remains responsible/i)).not.toBeNull()
  })

  it('uses a locale-aware demo primary and configured WhatsApp secondary', () => {
    const { rerender } = render(<HospitalityWebsite locale="ng" />)

    const demoLinks = screen.getAllByRole('link', { name: 'Book a hospitality demo' })
    expect(demoLinks).toHaveLength(2)
    for (const link of demoLinks) {
      expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=hospitality')
    }
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()

    rerender(<HospitalityWebsite locale="ke" whatsappUrl="https://wa.me/254700000000" />)
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    }
  })

  it('renders a useful no-media state and only supplied approved media', () => {
    const { rerender } = render(<HospitalityWebsite locale="ke" />)
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('A typical menu order')).not.toBeNull()
    expect(screen.getByText('A sample guest stay')).not.toBeNull()
    expect(screen.getByText('No unapproved image substituted')).not.toBeNull()

    rerender(
      <HospitalityWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/hospitality.webp', alt: 'Hospitality table and kitchen screen' }}
      />,
    )
    expect(screen.getByAltText('Hospitality table and kitchen screen')).not.toBeNull()
    expect(document.querySelector('[data-media-state="approved"]')).not.toBeNull()

    rerender(
      <HospitalityWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/fallback.webp', alt: 'Fallback Hospitality screen' }}
        heroVideo={{
          url: 'https://media.omnix.co.ke/hospitality.webm',
          posterUrl: 'https://media.omnix.co.ke/hospitality-poster.webp',
          alt: 'Hospitality service workflow video',
          mimeType: 'video/webm',
        }}
      />,
    )
    const videoDescription = screen.getByText('Hospitality service workflow video')
    expect(videoDescription.classList.contains('sr-only')).toBe(true)
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('poster')).toBe('https://media.omnix.co.ke/hospitality-poster.webp')
    expect(video).toHaveProperty('muted', true)
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(screen.queryByAltText('Fallback Hospitality screen')).toBeNull()
  })

  it('uses only Task 8 Hospitality slots and locale-free hreflang input', () => {
    const route = readFileSync(HOSPITALITY_ROUTE, 'utf8')

    expect(route).toContain("getSlotImage('module.hospitality.hero')")
    expect(route).toContain("getSlotMedia('module.hospitality.video')")
    expect(route).toContain("getSlotImage('module.hospitality.video-poster')")
    expect(route).toContain("buildAlternatesLanguages('/hospitality')")
    expect(route).toContain('const canonical = `${SITE_URL}/${locale}/hospitality`')
    expect(route).not.toContain('VariantLanding')
  })
})
