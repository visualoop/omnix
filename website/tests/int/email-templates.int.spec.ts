/**
 * Email template tests — render to HTML + assert critical content
 * without hitting Resend.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import {
  MagicLinkEmail,
  InviteEmail,
  PaymentReceiptEmail,
  SupportReplyEmail,
  DiagnosticEmail,
} from '@/emails/templates'

describe('Email templates', () => {
  describe('MagicLinkEmail', () => {
    it('embeds the magic link URL twice (button href + plain-text fallback)', async () => {
      const html = await render(
        MagicLinkEmail({ url: 'https://omnix.co.ke/api/auth/magic-link/verify?token=abc123' }),
      )
      const matches = html.match(/abc123/g) ?? []
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })

    it('shows the expiry countdown', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com', expiresInMinutes: 30 }))
      expect(html).toContain('30')
      expect(html.toLowerCase()).toContain('minutes')
    })

    it('includes Omnix branding', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com' }))
      expect(html).toContain('Omnix')
      expect(html.toLowerCase()).toContain('sign in')
    })

    it('uses cream paper background', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com' }))
      expect(html).toContain('#FBFAF6')
    })
  })

  describe('InviteEmail', () => {
    it('renders inviter + org names', async () => {
      const html = await render(
        InviteEmail({
          inviteLink: 'https://omnix.co.ke/accept-invitation/xyz',
          inviterName: 'Justine',
          orgName: 'Maziwa Pharmacy',
        }),
      )
      expect(html).toContain('Justine')
      expect(html).toContain('Maziwa Pharmacy')
      expect(html).toContain('xyz')
    })
  })

  describe('PaymentReceiptEmail', () => {
    it('formats amount with thousand separators', async () => {
      const html = await render(
        PaymentReceiptEmail({
          customerName: 'Justine',
          amount: 30000,
          currency: 'KES',
          reference: 'OMX-12345',
          purpose: 'license_fee',
          date: '23 June 2026',
        }),
      )
      expect(html).toContain('30,000')
      expect(html).toContain('KES')
      expect(html).toContain('OMX-12345')
    })

    it('humanises purpose snake_case', async () => {
      const html = await render(
        PaymentReceiptEmail({
          customerName: 'Justine',
          amount: 100,
          currency: 'KES',
          reference: 'r1',
          purpose: 'maintenance_renewal',
          date: '2026-06-23',
        }),
      )
      expect(html).toContain('Maintenance Renewal')
    })
  })

  describe('SupportReplyEmail', () => {
    it('preserves whitespace in agent body', async () => {
      const html = await render(
        SupportReplyEmail({
          ticketSubject: 'Cannot complete sale',
          ticketId: '01HX9Z2KRRABC123XYZ',
          body: 'Try clearing\nthe cache.',
          agentName: 'Aisha',
        }),
      )
      expect(html).toContain('Aisha')
      expect(html).toContain('Cannot complete sale')
      expect(html).toContain('clearing')
    })
  })

  describe('DiagnosticEmail', () => {
    it('renders integration smoke message', async () => {
      const html = await render(
        DiagnosticEmail({ from: 'Omnix <noreply@omnix.co.ke>', sentAt: '2026-06-23T10:00:00Z' }),
      )
      expect(html).toContain('It works')
      expect(html).toContain('Resend')
      expect(html).toContain('noreply@omnix.co.ke')
    })
  })
})
