import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  PHARMACY_CAPABILITIES,
  PharmacyWebsite,
} from '@/components/marketing/pharmacy-website'

const APP_ROOT = join(process.cwd(), 'src', 'app', '[locale]', '(frontend)')

afterEach(cleanup)

describe('Task 10 Pharmacy product website', () => {
  it('uses pharmacy buyer language and avoids unsupported outcome claims', () => {
    render(<PharmacyWebsite locale="ke" />)

    const page = document.querySelector('[data-pharmacy-website]')
    expect(page?.textContent).toMatch(/pharmacy software/i)
    expect(page?.textContent).toMatch(/pharmacy POS/i)
    expect(page?.textContent).toMatch(/dispensing/i)
    expect(page?.textContent).toMatch(/batch and expiry/i)
    expect(page?.textContent).toMatch(/prescription/i)
    expect(page?.textContent).toMatch(/patient records/i)
    expect(page?.textContent).toMatch(/controlled register/i)
    expect(page?.textContent).toMatch(/M-Pesa/i)
    expect(page?.textContent).toMatch(/KRA eTIMS/i)
    expect(page?.textContent).toMatch(/SHA and private insurance/i)
    expect(PHARMACY_CAPABILITIES).toHaveLength(6)

    expect(page?.textContent).not.toMatch(/certified|regulatory approval|guaranteed compliance/i)
    expect(page?.textContent).not.toMatch(/save \d|faster|customers trust|trusted by/i)
    expect(page?.textContent).not.toMatch(/\bERP\b|\bAI\b/i)
  })

  it('uses a locale-aware demo primary and configured WhatsApp secondary', () => {
    const { rerender } = render(<PharmacyWebsite locale="ng" />)

    const demoLinks = screen.getAllByRole('link', { name: 'Book a pharmacy demo' })
    expect(demoLinks).toHaveLength(2)
    for (const link of demoLinks) {
      expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=pharmacy')
    }
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()

    rerender(<PharmacyWebsite locale="ke" whatsappUrl="https://wa.me/254700000000" />)
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    }
  })

  it('renders a useful no-media state and only supplied approved media', () => {
    const { rerender } = render(<PharmacyWebsite locale="ke" />)
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('Bring one prescription and a recent stock delivery.')).not.toBeNull()
    expect(screen.getByText('No unapproved image substituted')).not.toBeNull()

    rerender(
      <PharmacyWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/dawa.webp', alt: 'Pharmacy dispensing screen' }}
      />,
    )
    expect(screen.getByAltText('Pharmacy dispensing screen')).not.toBeNull()
    expect(document.querySelector('[data-media-state="approved"]')).not.toBeNull()

    rerender(
      <PharmacyWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/fallback.webp', alt: 'Fallback pharmacy screen' }}
        heroVideo={{
          url: 'https://media.omnix.co.ke/dawa.webm',
          posterUrl: 'https://media.omnix.co.ke/dawa-poster.webp',
          alt: 'Pharmacy workflow video',
          mimeType: 'video/webm',
        }}
      />,
    )
    const videoDescription = screen.getByText('Pharmacy workflow video')
    expect(videoDescription.classList.contains('sr-only')).toBe(true)
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('poster')).toBe('https://media.omnix.co.ke/dawa-poster.webp')
    expect(video).toHaveProperty('muted', true)
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(screen.queryByAltText('Fallback pharmacy screen')).toBeNull()
  })

  it('uses Task 8 slots and consolidates Dawa on the Pharmacy canonical', () => {
    const pharmacyRoute = readFileSync(join(APP_ROOT, 'pharmacy', 'page.tsx'), 'utf8')
    const dawaRoute = readFileSync(join(APP_ROOT, 'dawa', 'page.tsx'), 'utf8')

    expect(pharmacyRoute).toContain("getSlotImage('module.dawa.hero')")
    expect(pharmacyRoute).toContain("getSlotMedia('module.dawa.video')")
    expect(pharmacyRoute).toContain("getSlotImage('module.dawa.video-poster')")
    expect(pharmacyRoute).toContain("buildAlternatesLanguages('/pharmacy')")
    expect(pharmacyRoute).toContain('canonical')
    expect(dawaRoute).toContain('permanentRedirect(`/${locale}/pharmacy')
    expect(dawaRoute).toContain('robots: { index: false, follow: true }')
    expect(dawaRoute).not.toContain('VariantLanding')
  })
})
