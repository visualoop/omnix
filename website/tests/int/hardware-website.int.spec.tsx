import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HARDWARE_CAPABILITIES, HardwareWebsite } from '@/components/marketing/hardware-website'

const ROUTE = join(process.cwd(), 'src', 'app', '[locale]', '(frontend)', 'hardware', 'page.tsx')
afterEach(cleanup)

const renderPage = (locale = 'ke') => render(<HardwareWebsite locale={locale} licencePriceKes={30_000} />)

describe('Task 13 Hardware & Equipment product website', () => {
  it('leads with implemented hardware-shop workflows and honest equipment records', () => {
    renderPage()
    const page = document.querySelector('[data-hardware-website]')
    for (const term of ['Hardware-shop POS', 'Stock and receiving', 'Supplier purchasing', 'Bulk and tier prices', 'Quotations to sale', 'Delivery notes', 'Contractor and customer accounts']) {
      expect(page?.textContent).toMatch(new RegExp(term, 'i'))
    }
    expect(HARDWARE_CAPABILITIES).toHaveLength(7)
    expect(screen.getByRole('heading', { name: 'Records for equipment your business sells or rents.' })).not.toBeNull()
    expect(page?.textContent).toMatch(/not a warranty for Omnix software/i)
    expect(page?.textContent).not.toMatch(/\bERP\b|\bAI\b|certified|guaranteed compliance|trusted by/i)
  })

  it('uses configured pricing and states the perpetual licence and installation path', () => {
    renderPage()
    expect(screen.getByText(/KES\s*30,000/)).not.toBeNull()
    expect(screen.getByText(/One-time perpetual licence for one Windows device/i)).not.toBeNull()
    expect(screen.getByText(/download the Windows installer and install it on the licensed device/i)).not.toBeNull()
    expect(screen.getByText(/arrange assisted installation/i)).not.toBeNull()
    expect(screen.getByText(/annual compliance-update plan is optional and is not required/i)).not.toBeNull()
  })

  it('keeps Kenya integrations explicit and omits them in other locales', () => {
    const { rerender } = render(<HardwareWebsite locale="ke" licencePriceKes={30_000} />)
    expect(screen.getByText(/M-Pesa requests and KRA eTIMS submission require internet access/i)).not.toBeNull()
    expect(screen.getByText(/queued for retry/i)).not.toBeNull()
    rerender(<HardwareWebsite locale="ng" licencePriceKes={30_000} />)
    expect(document.querySelector('[data-hardware-website]')?.textContent).not.toMatch(/M-Pesa|KRA eTIMS/i)
    expect(screen.getByText(/available only where Omnix supports the provider/i)).not.toBeNull()
  })

  it('uses localized demo links, configured WhatsApp, and useful fail-closed media', () => {
    const { rerender } = render(<HardwareWebsite locale="ng" licencePriceKes={30_000} />)
    for (const link of screen.getAllByRole('link', { name: 'Book a Hardware & Equipment demo' })) expect(link.getAttribute('href')).toBe('/ng/contact?type=demo&product=hardware')
    expect(screen.queryByRole('link', { name: 'Ask on WhatsApp' })).toBeNull()
    expect(document.querySelector('[data-media-state="empty"]')).not.toBeNull()
    expect(screen.getByText('Five typical stock lines and units')).not.toBeNull()
    expect(screen.getByText('No unapproved image substituted')).not.toBeNull()

    rerender(<HardwareWebsite locale="ke" licencePriceKes={30_000} whatsappUrl="https://wa.me/254700000000" heroVideo={{ url: 'https://media.omnix.co.ke/hardware.webm', posterUrl: 'https://media.omnix.co.ke/hardware-poster.webp', alt: 'Hardware counter workflow video', mimeType: 'video/webm' }} />)
    for (const link of screen.getAllByRole('link', { name: 'Ask on WhatsApp' })) expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/254700000000\?text=/)
    const video = document.querySelector('video')
    expect(video).toHaveProperty('muted', true)
    expect(video?.getAttribute('poster')).toBe('https://media.omnix.co.ke/hardware-poster.webp')
    expect(video?.getAttribute('aria-hidden')).toBe('true')
    expect(video?.hasAttribute('controls')).toBe(false)
  })

  it('uses only approved Task 8 hardware slots, config pricing, and locale-free alternates', () => {
    const route = readFileSync(ROUTE, 'utf8')
    expect(route).toContain("getSlotImage('module.hardware.hero')")
    expect(route).toContain("getSlotMedia('module.hardware.video')")
    expect(route).toContain("getSlotImage('module.hardware.video-poster')")
    expect(route).toContain('pricing.starter.oneTimeFee.KES')
    expect(route).toContain("buildAlternatesLanguages('/hardware')")
    expect(route).toContain('const canonical = `${SITE_URL}/${locale}/hardware`')
    expect(route).not.toContain('VariantLanding')
  })
})
