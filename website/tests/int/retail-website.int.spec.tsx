import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  RETAIL_CAPABILITIES,
  RetailWebsite,
} from '@/components/marketing/retail-website'

const RETAIL_ROUTE = join(
  process.cwd(),
  'src',
  'app',
  '[locale]',
  '(frontend)',
  'retail',
  'page.tsx',
)

afterEach(cleanup)

describe('Task 11 Retail product website', () => {
  it('uses verified retail buyer language without generic or fabricated claims', () => {
    render(<RetailWebsite locale="ke" />)

    const page = document.querySelector('[data-retail-website]')
    expect(page?.textContent).toMatch(/Retail POS/i)
    expect(page?.textContent).toMatch(/barcode/i)
    expect(page?.textContent).toMatch(/product variants/i)
    expect(page?.textContent).toMatch(/inventory/i)
    expect(page?.textContent).toMatch(/price lists/i)
    expect(page?.textContent).toMatch(/loyalty/i)
    expect(page?.textContent).toMatch(/promotions/i)
    expect(page?.textContent).toMatch(/layby/i)
    expect(page?.textContent).toMatch(/shelf labels/i)
    expect(page?.textContent).toMatch(/purchase order/i)
    expect(page?.textContent).toMatch(/cash/i)
    expect(page?.textContent).toMatch(/M-Pesa/i)
    expect(page?.textContent).toMatch(/KRA eTIMS/i)
    expect(RETAIL_CAPABILITIES).toHaveLength(8)

    expect(page?.textContent).not.toMatch(/certified|regulatory approval|guaranteed compliance/i)
    expect(page?.textContent).not.toMatch(/save \d|faster|trusted by|customers trust/i)
    expect(page?.textContent).not.toMatch(/\bERP\b|\bAI\b/i)
  })

  it('states connectivity and business responsibility boundaries', () => {
    render(<RetailWebsite locale="ke" />)

    expect(screen.getByText(/M-Pesa STK requests and KRA eTIMS submission require a working internet connection/i)).not.toBeNull()
    expect(screen.getByText(/invoice can remain queued for retry/i)).not.toBeNull()
    expect(screen.getByText(/Your business remains responsible/i)).not.toBeNull()
  })

  it('uses a locale-aware demo primary and configured WhatsApp secondary', () => {
    const { rerender } = render(<RetailWebsite locale="ng" />)

    const demoLinks = screen.getAllByRole('link', { name: 'Book a retail demo' })
    expect(demoLinks).toHaveLength(2)
    for (const link of demoLinks) {
      expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=retail')
    }
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()

    rerender(<RetailWebsite locale="ke" whatsappUrl="https://wa.me/254700000000" />)
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    }
  })

  it('renders a useful no-media state and only supplied approved media', () => {
    const { rerender } = render(<RetailWebsite locale="ke" />)
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('Three product barcodes')).not.toBeNull()
    expect(screen.getByText('No unapproved image substituted')).not.toBeNull()

    rerender(
      <RetailWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/retail.webp', alt: 'Retail checkout screen' }}
      />,
    )
    expect(screen.getByAltText('Retail checkout screen')).not.toBeNull()
    expect(document.querySelector('[data-media-state="approved"]')).not.toBeNull()

    rerender(
      <RetailWebsite
        locale="ke"
        heroImage={{ url: 'https://media.omnix.co.ke/fallback.webp', alt: 'Fallback retail screen' }}
        heroVideo={{
          url: 'https://media.omnix.co.ke/retail.webm',
          posterUrl: 'https://media.omnix.co.ke/retail-poster.webp',
          alt: 'Retail counter workflow video',
          mimeType: 'video/webm',
        }}
      />,
    )
    const videoDescription = screen.getByText('Retail counter workflow video')
    expect(videoDescription.classList.contains('sr-only')).toBe(true)
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('poster')).toBe('https://media.omnix.co.ke/retail-poster.webp')
    expect(video).toHaveProperty('muted', true)
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(screen.queryByAltText('Fallback retail screen')).toBeNull()
  })

  it('uses only Task 8 Retail slots and locale-free hreflang input', () => {
    const route = readFileSync(RETAIL_ROUTE, 'utf8')

    expect(route).toContain("getSlotImage('module.retail.hero')")
    expect(route).toContain("getSlotMedia('module.retail.video')")
    expect(route).toContain("getSlotImage('module.retail.video-poster')")
    expect(route).toContain("buildAlternatesLanguages('/retail')")
    expect(route).toContain('const canonical = `${SITE_URL}/${locale}/retail`')
    expect(route).not.toContain('VariantLanding')
  })
})
