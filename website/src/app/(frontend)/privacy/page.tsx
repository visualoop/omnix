import type { Metadata } from 'next'
import { LegalLayout } from '@/components/marketing/legal-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Duka collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      description="How Duka collects, uses, and protects your data."
      lastUpdated="2026-05-01"
      sections={[
        {
          id: 'overview',
          heading: 'Overview',
          body: (
            <>
              <p>Duka is desktop software that runs on your Windows machine. Your business data (customers, products, sales, prescriptions, employees) never leaves your device unless you explicitly enable cloud backup.</p>
              <p>This policy covers what data we collect when you use Duka, how we use it, and your rights.</p>
            </>
          ),
        },
        {
          id: 'data-we-collect',
          heading: 'Data we collect',
          body: (
            <>
              <p><strong>Business data (stored locally only):</strong> Customer names, product names, sale amounts, prescriptions, employee details, bank transactions. This data lives in an encrypted SQLite database on your Windows machine. We never see it unless you contact support and explicitly share a database export.</p>
              <p><strong>Telemetry (sent to our servers if you consent):</strong> App version, OS version, module in use, error logs, aggregated counts (number of branches, users, sales today). We never send customer names, product names, sale amounts, or any PII. See our telemetry policy below.</p>
              <p><strong>Account data (stored on our servers):</strong> Your name, email, phone, business name, KRA PIN, licence key, payment history. Required to operate your account and licence.</p>
            </>
          ),
        },
        {
          id: 'telemetry',
          heading: 'Telemetry & diagnostics',
          body: (
            <>
              <p>On first launch, we ask if you want to send anonymous diagnostics. You can opt out at any time in Settings → Privacy.</p>
              <p><strong>What we send:</strong> App version, OS version, active module, error logs, aggregated counts (branches, users, products, sales count). Session ID (random, not tied to your identity).</p>
              <p><strong>What we never send:</strong> Customer names, product names, sale amounts, prescriptions, employee names, national IDs, KRA PINs, bank account numbers, M-Pesa till numbers, any free-text user input.</p>
              <p>Telemetry helps us fix bugs faster and prioritise features. It is never sold or shared with third parties.</p>
            </>
          ),
        },
        {
          id: 'cloud-backup',
          heading: 'Cloud backup (optional)',
          body: (
            <>
              <p>If you enable cloud backup (KES 500/month per branch), an encrypted snapshot of your local database uploads to Cloudflare R2 storage we operate from London. The encryption key is derived from a passphrase you set — we don&rsquo;t have it. We cannot decrypt your backup.</p>
              <p>Backups are retained for 30 days. You can delete them at any time from your dashboard.</p>
            </>
          ),
        },
        {
          id: 'third-parties',
          heading: 'Third-party services',
          body: (
            <>
              <p><strong>Paystack:</strong> Processes payments. We send your name, email, phone, and payment amount. Paystack&rsquo;s privacy policy applies.</p>
              <p><strong>Resend:</strong> Sends transactional emails (licence issued, trial ending). We send your name and email. Resend&rsquo;s privacy policy applies.</p>
              <p><strong>Cloudflare R2:</strong> Stores cloud backups (if enabled). Data is encrypted before upload. Cloudflare&rsquo;s privacy policy applies.</p>
              <p>We never sell your data to third parties.</p>
            </>
          ),
        },
        {
          id: 'your-rights',
          heading: 'Your rights',
          body: (
            <>
              <p>You have the right to:</p>
              <ul>
                <li>Access your account data (email us at hello@omnix.co.ke)</li>
                <li>Delete your account (email us; we delete within 30 days)</li>
                <li>Opt out of telemetry (Settings → Privacy)</li>
                <li>Export your business data (File → Export → Full database)</li>
                <li>Delete your cloud backups (Dashboard → Backups → Delete)</li>
              </ul>
            </>
          ),
        },
        {
          id: 'contact',
          heading: 'Contact',
          body: <p>Questions about this policy? Email us at hello@omnix.co.ke or WhatsApp +254 700 000 000.</p>,
        },
      ]}
    />
  )
}
