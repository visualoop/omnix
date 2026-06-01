import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'

export const metadata: Metadata = {
  title: 'Documentation — learn Omnix',
  description: 'Step-by-step guides for every feature. Installation, POS, inventory, payroll, KRA filings.',
}

const DOCS = [
  { slug: 'getting-started', title: 'Getting started', category: 'Basics', icon: 'RocketLaunch' },
  { slug: 'pos', title: 'Point of sale', category: 'Core', icon: 'ShoppingCart' },
  { slug: 'inventory', title: 'Inventory management', category: 'Core', icon: 'Package' },
  { slug: 'banking', title: 'Banking & reconciliation', category: 'Core', icon: 'Bank' },
  { slug: 'payroll', title: 'Payroll & statutory', category: 'Core', icon: 'Users' },
  { slug: 'etims', title: 'KRA eTIMS setup', category: 'Integrations', icon: 'FileText' },
  { slug: 'mpesa', title: 'M-Pesa integration', category: 'Integrations', icon: 'CreditCard' },
  { slug: 'pharmacy', title: 'Pharmacy module', category: 'Modules', icon: 'FirstAid' },
  { slug: 'retail', title: 'Retail module', category: 'Modules', icon: 'Storefront' },
]

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title={<>Learn <em>Omnix.</em></>}
        description="Step-by-step guides for every feature. Installation, POS, inventory, payroll, KRA filings."
      />

      <section className="section">
        <div className="container-default">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOCS.map((doc) => (
              <Link key={doc.slug} href={`/docs/${doc.slug}`} className="group flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-accent)]">
                <Icon.BookOpen className="size-6 shrink-0 text-[var(--color-accent)]" weight="bold" />
                <div className="flex-1">
                  <div className="caption-mono mb-2">{doc.category}</div>
                  <h3 className="font-[family-name:var(--font-display)] text-[20px] font-normal text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">{doc.title}</h3>
                </div>
                <Icon.ArrowRight className="size-4 shrink-0 text-[var(--color-fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" weight="bold" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
