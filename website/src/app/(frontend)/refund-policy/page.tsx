import type { Metadata } from 'next'
import { LegalLayout } from '@/components/marketing/legal-layout'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'How refunds work for Duka licences.',
}

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Refund Policy"
      description="How refunds work for Duka licences."
      lastUpdated="2026-05-01"
      sections={[
        { id: 'trial', heading: 'Free trial first', body: <p>You get 30 days free to try every module before paying anything. No credit card required. Use this time to make sure Duka is the right fit.</p> },
        { id: 'window', heading: '14-day refund window', body: <><p>If you pay and decide within 14 days that Duka isn&rsquo;t the right fit, we refund the full amount minus the Paystack processing fee (~2.9% + KES 100).</p><p>Email hello@omnix.co.ke with your licence key and reason. We process refunds within 5 business days.</p></> },
        { id: 'after-14-days', heading: 'After 14 days', body: <p>After the 14-day window, we don&rsquo;t offer refunds — but we work with you to fix whatever isn&rsquo;t working. If there&rsquo;s a bug, we fix it. If a feature is missing, we prioritise it. If you&rsquo;re stuck, we walk you through it.</p> },
        { id: 'no-refund', heading: 'No refunds for', body: <><p>We don&rsquo;t refund:</p><ul><li>Maintenance renewals (optional, you choose to renew)</li><li>Cloud backup subscriptions (cancel anytime, no refund for partial months)</li><li>Extra branch or machine upgrades (one-time, non-refundable)</li><li>Custom licences (negotiated separately, refund terms in contract)</li></ul></> },
        { id: 'abuse', heading: 'Refund abuse', body: <p>We reserve the right to refuse refunds if we detect abuse (e.g., requesting a refund after extracting all your data, or repeated refund requests across multiple licences).</p> },
        { id: 'contact', heading: 'Questions?', body: <p>Email hello@omnix.co.ke or WhatsApp +254 700 000 000. We respond within 24 hours.</p> },
      ]}
    />
  )
}
