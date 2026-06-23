/**
 * Email template tests — render to HTML + assert critical content
 * without hitting Resend.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import {
  MagicLinkEmail,
  WelcomeEmail,
  InviteEmail,
  LicenseKeyEmail,
  PaymentReceiptEmail,
  PaymentFailedEmail,
  TrialEndingEmail,
  MaintenanceEndingEmail,
  MaintenanceLapsedEmail,
  CloudBackupEndingEmail,
  SupportReplyEmail,
  DiagnosticEmail,
} from '@/emails/templates'

const BRAND = {
  tagline: 'Offline-first ERP for Kenyan SMEs.',
  supportEmail: 'support@omnix.co.ke',
  supportWhatsapp: '+254 712 345 678',
  businessAddress: 'Westlands, Nairobi, Kenya',
  legalName: 'Omnix Limited',
  copyright: '© 2026 Omnix. Built in Nairobi.',
  unsubscribe: "You're receiving this because you have an active Omnix account.",
  brandUrl: 'https://omnix.co.ke',
}

describe('Email templates', () => {
  describe('Shell letterhead', () => {
    it('renders the brand tagline + support email + copyright in every email', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com', brand: BRAND }))
      expect(html).toContain(BRAND.tagline)
      expect(html).toContain(BRAND.supportEmail)
      expect(html).toContain('© 2026 Omnix')
    })

    it('respects optional WhatsApp + address values', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com', brand: BRAND }))
      expect(html).toContain('WhatsApp')
      expect(html).toContain('Westlands')
    })

    it('hides WhatsApp + address when not set', async () => {
      const minimal = { ...BRAND, supportWhatsapp: null, businessAddress: null }
      const html = await render(MagicLinkEmail({ url: 'https://example.com', brand: minimal }))
      expect(html).not.toContain('WhatsApp')
      expect(html).not.toContain('Westlands')
    })
  })

  describe('MagicLinkEmail', () => {
    it('embeds the magic link URL twice (button href + plain-text fallback)', async () => {
      const html = await render(
        MagicLinkEmail({
          url: 'https://omnix.co.ke/api/auth/magic-link/verify?token=abc123',
          brand: BRAND,
        }),
      )
      const matches = html.match(/abc123/g) ?? []
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })

    it('shows the expiry countdown', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com', expiresInMinutes: 30, brand: BRAND }))
      expect(html).toContain('30')
    })

    it('uses cream paper background', async () => {
      const html = await render(MagicLinkEmail({ url: 'https://example.com', brand: BRAND }))
      expect(html).toContain('#FBFAF6')
    })
  })

  describe('WelcomeEmail', () => {
    it('greets the customer by name', async () => {
      const html = await render(WelcomeEmail({ name: 'Justine', brand: BRAND }))
      expect(html).toContain('Justine')
      expect(html).toContain('Karibu')
    })
  })

  describe('InviteEmail', () => {
    it('renders inviter + org names', async () => {
      const html = await render(
        InviteEmail({
          inviteLink: 'https://omnix.co.ke/accept-invitation/xyz',
          inviterName: 'Justine',
          orgName: 'Maziwa Pharmacy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('Justine')
      expect(html).toContain('Maziwa Pharmacy')
      expect(html).toContain('xyz')
    })
  })

  describe('LicenseKeyEmail', () => {
    it('formats the license key in groups of four', async () => {
      const html = await render(
        LicenseKeyEmail({
          customerName: 'Justine',
          licenseKey: 'ABCD1234EFGH5678IJKL',
          variant: 'Dawa',
          amountPaid: 30000,
          currency: 'KES',
          reference: 'OMX-12345',
          date: '2026-06-23',
          downloadUrl: 'https://omnix.co.ke/downloads',
          maintenanceUntil: '2027-06-23',
          brand: BRAND,
        }),
      )
      expect(html).toContain('ABCD-1234-EFGH-5678-IJKL')
      expect(html).toContain('Dawa')
      expect(html).toContain('30,000')
      expect(html).toContain('2027-06-23')
    })

    it('shows the copper accent strip', async () => {
      const html = await render(
        LicenseKeyEmail({
          customerName: 'A',
          licenseKey: 'XYZ',
          variant: 'pro',
          amountPaid: 1,
          currency: 'KES',
          reference: 'r',
          date: '2026-01-01',
          downloadUrl: 'https://omnix.co.ke',
          maintenanceUntil: '2027-01-01',
          brand: BRAND,
        }),
      )
      expect(html).toContain('#C77B3F') // copper trim
    })
  })

  describe('PaymentReceiptEmail', () => {
    it('formats amount with thousand separators + humanises purpose', async () => {
      const html = await render(
        PaymentReceiptEmail({
          customerName: 'Justine',
          amount: 30000,
          currency: 'KES',
          reference: 'OMX-12345',
          purpose: 'maintenance_renewal',
          date: '23 June 2026',
          brand: BRAND,
        }),
      )
      expect(html).toContain('30,000')
      expect(html).toContain('KES')
      expect(html).toContain('OMX-12345')
      expect(html).toContain('Maintenance Renewal')
    })
  })

  describe('PaymentFailedEmail', () => {
    it('shows reason + retry CTA', async () => {
      const html = await render(
        PaymentFailedEmail({
          customerName: 'Justine',
          amount: 30000,
          currency: 'KES',
          reference: 'OMX-FAIL',
          purpose: 'license_fee',
          reason: 'Insufficient funds',
          retryUrl: 'https://omnix.co.ke/buy?ref=OMX-FAIL',
          brand: BRAND,
        }),
      )
      expect(html).toContain('Insufficient funds')
      expect(html).toContain('Retry payment')
    })
  })

  describe('TrialEndingEmail', () => {
    it('uses singular "day" when daysLeft = 1', async () => {
      const html = await render(
        TrialEndingEmail({
          customerName: 'A',
          variant: 'Dawa',
          daysLeft: 1,
          buyUrl: 'https://omnix.co.ke/buy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('1 day')
    })

    it('uses plural "days" when daysLeft > 1', async () => {
      const html = await render(
        TrialEndingEmail({
          customerName: 'A',
          variant: 'Dawa',
          daysLeft: 7,
          buyUrl: 'https://omnix.co.ke/buy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('7 days')
    })
  })

  describe('MaintenanceEndingEmail', () => {
    it('shows expiry date + renewal CTA', async () => {
      const html = await render(
        MaintenanceEndingEmail({
          customerName: 'Justine',
          variant: 'Pro',
          daysLeft: 14,
          expiresOn: '2026-07-07',
          renewUrl: 'https://omnix.co.ke/buy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('2026-07-07')
      expect(html).toContain('Renew maintenance')
    })
  })

  describe('MaintenanceLapsedEmail', () => {
    it('communicates app keeps working but updates stop', async () => {
      const html = await render(
        MaintenanceLapsedEmail({
          customerName: 'Justine',
          variant: 'Pro',
          expiredOn: '2026-06-23',
          renewUrl: 'https://omnix.co.ke/buy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('keeps working')
      expect(html).toContain('Renew now')
    })
  })

  describe('CloudBackupEndingEmail', () => {
    it('warns about local-only state without backup', async () => {
      const html = await render(
        CloudBackupEndingEmail({
          customerName: 'Justine',
          daysLeft: 7,
          expiresOn: '2026-06-30',
          renewUrl: 'https://omnix.co.ke/buy',
          brand: BRAND,
        }),
      )
      expect(html).toContain('local-only')
      expect(html).toContain('Renew cloud backup')
    })
  })

  describe('SupportReplyEmail', () => {
    it('preserves multi-line body + agent attribution', async () => {
      const html = await render(
        SupportReplyEmail({
          ticketSubject: 'Cannot complete sale',
          ticketId: '01HX9Z2KRRABC123XYZ',
          body: 'Try clearing\nthe cache.',
          agentName: 'Aisha',
          brand: BRAND,
        }),
      )
      expect(html).toContain('Aisha')
      expect(html).toContain('Cannot complete sale')
      expect(html).toContain('clearing')
    })
  })

  describe('DiagnosticEmail', () => {
    it('renders integration smoke message with timestamps', async () => {
      const html = await render(
        DiagnosticEmail({ from: 'Omnix <noreply@omnix.co.ke>', sentAt: '2026-06-23T10:00:00Z', brand: BRAND }),
      )
      expect(html).toContain('It works')
      expect(html).toContain('noreply@omnix.co.ke')
      expect(html).toContain('2026-06-23T10:00:00Z')
    })
  })
})
