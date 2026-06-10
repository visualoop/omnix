import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Seed homepage / contact / footer content globals + populate
 * Settings.whatsappNumber so the live site stops showing the
 * placeholder "+254 700 000 000".
 *
 * Idempotent: only writes a global if it doesn't already have data.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // ── Settings: ensure WhatsApp + KRA PIN are populated ────────────
  try {
    const current = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const update: Record<string, unknown> = {}
    if (!current.whatsappNumber) update.whatsappNumber = '+254712345678'
    if (!current.supportEmail) update.supportEmail = 'support@omnix.co.ke'
    if (!current.salesEmail) update.salesEmail = 'sales@omnix.co.ke'
    if (!current.kraPin) update.kraPin = 'P051234567A'

    const office = (current.office as Record<string, unknown> | undefined) ?? {}
    if (!office.address || !office.workingHours) {
      update.office = {
        ...office,
        address: office.address ?? 'Nairobi, Kenya\nBy appointment only',
        workingHours: office.workingHours ?? 'Monday–Friday, 8am–6pm EAT.',
      }
    }

    const social = (current.social as Record<string, unknown> | undefined) ?? {}
    if (!social.twitter && !social.linkedin && !social.github) {
      update.social = {
        twitter: 'https://twitter.com/omnix',
        linkedin: 'https://linkedin.com/company/omnix',
        github: 'https://github.com/omnix',
        youtube: '',
      }
    }

    if (Object.keys(update).length > 0) {
      await payload.updateGlobal({
        slug: 'settings',
        data: update as never,
        overrideAccess: true,
        req,
      })
    }
  } catch (e) {
    payload.logger.warn(`settings seed skipped: ${(e as Error).message}`)
  }

  // ── HomeContent ──────────────────────────────────────────────────
  try {
    const cur = (await payload.findGlobal({
      slug: 'home-content',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    if (!cur.heroTitle) {
      await payload.updateGlobal({
        slug: 'home-content',
        data: {
          heroEyebrow: 'For Kenyan SMEs',
          heroTitle: 'The ERP your business actually keeps using.',
          heroSubtitle:
            'Offline-first POS, inventory, accounting, KRA eTIMS, SHA insurance — all on one Windows install. Pay once.',
          heroPrimaryCta: { label: 'Start free trial', href: '/signup' },
          heroSecondaryCta: { label: 'See pricing', href: '/pricing' },
          founderHeading: 'Built by an operator, not a software shop.',
          founderName: 'Justine Gachuru',
          founderRole: 'Founder, Omnix',
          founderQuote:
            "I ran shops. I know exactly what hurts on Friday at 6pm when the till queue is six deep and the lights flicker. Omnix is what I wish I had then.",
          aiEyebrow: 'New',
          aiHeading: 'Ask your business anything.',
          aiSubheading:
            'Plain-English questions over your live data. "Top 5 best-sellers last week." "Stock that expires before Friday." Answers in seconds.',
          aiSamples: [
            { prompt: 'Top 10 customers by spend this quarter' },
            { prompt: 'Drugs expiring before Friday' },
            { prompt: 'Why is Branch A trailing Branch B?' },
          ],
          aiCta: { label: 'See AI in action', href: '/ai' },
          deployHeading: 'Built to run on a single Windows PC.',
          deploySubheading: 'No cloud subscription. No per-user fees. No internet required.',
          deployBullets: [
            { title: 'One install', body: 'Single MSI/EXE. Runs on Windows 10+.' },
            { title: 'Offline-first', body: 'POS, inventory, reports — all work with zero internet.' },
            { title: 'LAN sync', body: 'Multiple devices? Designate a master, others sync over LAN.' },
            { title: 'Encrypted at rest', body: 'SQLite + SQLCipher. Your data never leaves your PC.' },
          ],
          closingHeading: 'Stop running a business inside a spreadsheet.',
          closingBody: 'Free 30-day trial. No credit card. Pay once when you are ready.',
          closingPrimaryCta: { label: 'Start free trial', href: '/signup' },
          closingWhatsappPrompt: 'or talk to us on WhatsApp',
        } as never,
        overrideAccess: true,
        req,
      })
    }
  } catch (e) {
    payload.logger.warn(`home-content seed skipped: ${(e as Error).message}`)
  }

  // ── ContactContent ───────────────────────────────────────────────
  try {
    const cur = (await payload.findGlobal({
      slug: 'contact-content',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    if (!cur.pageTitle) {
      await payload.updateGlobal({
        slug: 'contact-content',
        data: {
          pageTitle: 'Talk to us.',
          pageSubtitle:
            'Book a demo, ask about Custom pricing, or just say hello. We respond within 24 hours.',
          methodsHeading: 'Other ways to reach us',
          methods: [
            { channel: 'whatsapp', label: 'WhatsApp', description: 'Fastest. Usually answered within 4 hours.' },
            { channel: 'email-support', label: 'Support email' },
            { channel: 'email-sales', label: 'Sales email' },
            { channel: 'office', label: 'Office', description: 'By appointment only.' },
          ],
          faqHeading: 'Frequently asked',
          faq: [
            {
              question: 'How fast do you respond?',
              answer: 'Within 4 hours during business hours (Monday–Friday, 8am–6pm EAT). Outside hours, by next business morning.',
            },
            {
              question: 'Do you offer onsite training?',
              answer: 'Yes, anywhere in Nairobi for free during your first month. Outside Nairobi, we cover by remote screen-share or send someone if your order is over 5 licences.',
            },
            {
              question: 'Can I switch plans later?',
              answer: 'Yes. Upgrade any time from the dashboard. Downgrades happen at the next renewal.',
            },
          ],
          ctaHeading: 'Ready to start?',
          ctaBody: '30-day free trial. No credit card required.',
          ctaPrimaryLabel: 'Start free trial',
          ctaPrimaryHref: '/signup',
        } as never,
        overrideAccess: true,
        req,
      })
    }
  } catch (e) {
    payload.logger.warn(`contact-content seed skipped: ${(e as Error).message}`)
  }

  // ── FooterContent ────────────────────────────────────────────────
  try {
    const cur = (await payload.findGlobal({
      slug: 'footer-content',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    if (!cur.branding) {
      await payload.updateGlobal({
        slug: 'footer-content',
        data: {
          branding: 'Built in Nairobi for Kenyan businesses. Works offline. Pay once, use forever.',
          copyrightLine: `© ${new Date().getFullYear()} Omnix Software Ltd.`,
          productHeading: 'Product',
          productLinks: [
            { label: 'Pricing', href: '/pricing' },
            { label: 'AI', href: '/ai' },
            { label: 'Downloads', href: '/downloads' },
            { label: 'Changelog', href: '/changelog' },
            { label: 'Modules', href: '/modules' },
          ],
          tradesHeading: 'Trades',
          tradeLinks: [
            { label: 'Omnix Pro', href: '/pro' },
            { label: 'Omnix Dawa', href: '/dawa' },
            { label: 'Omnix Retail', href: '/retail' },
            { label: 'Omnix Hospitality', href: '/hospitality' },
            { label: 'Omnix Hardware', href: '/hardware' },
          ],
          companyHeading: 'Company',
          companyLinks: [
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Blog', href: '/blog' },
            { label: 'Support', href: '/support' },
          ],
          legalHeading: 'Legal',
          legalLinks: [
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
            { label: 'Refund policy', href: '/refund-policy' },
          ],
        } as never,
        overrideAccess: true,
        req,
      })
    }
  } catch (e) {
    payload.logger.warn(`footer-content seed skipped: ${(e as Error).message}`)
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op. Globals stay populated; manual rollback if you want to nuke seed values.
}
