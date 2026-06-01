import type { Metadata } from 'next'
import { LegalLayout } from '@/components/marketing/legal-layout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The legal agreement between you and Omnix.',
}

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of Service"
      description="The legal agreement between you and Omnix."
      lastUpdated="2026-05-01"
      sections={[
        { id: 'agreement', heading: 'Agreement', body: <p>By downloading, installing, or using Omnix, you agree to these terms. If you don&rsquo;t agree, don&rsquo;t use the software.</p> },
        { id: 'licence', heading: 'Licence', body: <><p>We grant you a non-exclusive, non-transferable licence to use Omnix on the number of machines specified in your licence tier (3 for trial, 10 for standard, unlimited for custom).</p><p>You may not reverse-engineer, decompile, or redistribute Omnix. You may not use Omnix to violate any law.</p></> },
        { id: 'trial', heading: 'Free trial', body: <p>The 30-day trial is fully functional. No credit card required. At the end of the trial, POS stops working until you pay. Your data remains accessible and exportable.</p> },
        { id: 'payment', heading: 'Payment', body: <><p>The standard licence is KES 100,000 one-time. Payment via M-Pesa or card through Paystack. Licence is perpetual — you own it forever.</p><p>Maintenance (bug fixes, statutory updates) is free for 1 year. After that, KES 12,000/year optional. Major version upgrades (v2, v3) are 50% off list for current owners.</p></> },
        { id: 'refunds', heading: 'Refunds', body: <p>14-day refund window after payment, minus Paystack processing fee. After 14 days, no refunds — but we&rsquo;ll work with you to fix whatever isn&rsquo;t working. See our refund policy for details.</p> },
        { id: 'data', heading: 'Your data', body: <p>Your business data is yours. It lives on your machine. We never access it unless you contact support and explicitly share a database export. You can export your data at any time (File → Export).</p> },
        { id: 'warranty', heading: 'Warranty disclaimer', body: <p>Omnix is provided "as is" without warranty of any kind. We don&rsquo;t guarantee it will be error-free or uninterrupted. Use at your own risk.</p> },
        { id: 'liability', heading: 'Limitation of liability', body: <p>Our liability is limited to the amount you paid for your licence. We&rsquo;re not liable for lost profits, data loss, or indirect damages.</p> },
        { id: 'termination', heading: 'Termination', body: <p>We may terminate your licence if you violate these terms. You may stop using Omnix at any time. Termination doesn&rsquo;t entitle you to a refund after the 14-day window.</p> },
        { id: 'changes', heading: 'Changes to terms', body: <p>We may update these terms. We&rsquo;ll email you 30 days before major changes. Continued use after changes means you accept them.</p> },
        { id: 'law', heading: 'Governing law', body: <p>These terms are governed by the laws of Kenya. Disputes resolved in Nairobi courts.</p> },
        { id: 'contact', heading: 'Contact', body: <p>Questions? Email hello@omnix.co.ke or WhatsApp +254 700 000 000.</p> },
      ]}
    />
  )
}
