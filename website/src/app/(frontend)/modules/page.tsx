import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PageHero } from '@/components/marketing/page-hero'
import { ClosingCtaSection } from '@/components/landing/closing-cta-section'
import { MODULES_SEED } from '@/lib/modules-seed'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'Modules — trade-specific ERP',
  description: 'Four modules built for Kenyan trades. Pharmacy, retail, hardware, hospitality. One licence unlocks the trades you run.',
}

export default function ModulesPage() {
  return (
    <>
      <PageHero
        eyebrow="Modules"
        title={<>One licence. <em>Four trades.</em></>}
        description="Every Omnix install ships with the same Core. The trade-specific module decides what your screens look like the day you open it."
      />

      <section className="section">
        <div className="container-wide space-y-32 lg:space-y-44">
          {MODULES_SEED.filter(m => m.slug !== 'core').map((mod, i) => (
            <ModuleRow key={mod.slug} module={mod} reversed={i % 2 === 1} />
          ))}
        </div>
      </section>

      <ClosingCtaSection />
    </>
  )
}

function ModuleRow({ module, reversed }: { module: typeof MODULES_SEED[0]; reversed: boolean }) {
  return (
    <div className={cn('grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16', reversed ? 'lg:flex-row-reverse' : '')}>
      <div className={cn('lg:col-span-7', reversed ? 'lg:order-2 lg:col-start-6' : 'lg:order-1 lg:col-start-1')}>
        <ModulePlaceholder name={module.name} status={module.status} />
      </div>

      <div className={cn('lg:col-span-4', reversed ? 'lg:order-1 lg:col-start-1' : 'lg:order-2 lg:col-start-9')}>
        <div className="flex items-center gap-3">
          <span className="caption-mono">{module.for[0]}</span>
          {module.status === 'planned' && (
            <span className="rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Planned</span>
          )}
        </div>

        <h3 className="headline-sub mt-4">{module.name}</h3>
        <p className="font-[family-name:var(--font-display)] mt-3 text-[24px] italic font-light leading-tight text-[var(--color-fg-muted)]">{module.tagline}</p>
        <p className="mt-7 text-[16px] leading-[1.65] text-[var(--color-fg-muted)] max-w-[44ch]">{module.shortDescription}</p>

        {module.status === 'live' && (
          <Link href={`/${module.slug}`} className="font-[family-name:var(--font-ui)] mt-9 inline-flex items-center gap-2 border-b border-[var(--color-border-strong)] pb-1 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
            Read more <Icon.ArrowRight className="size-3.5" weight="bold" />
          </Link>
        )}
      </div>
    </div>
  )
}

function ModulePlaceholder({ name, status }: { name: string; status: string }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
      <div aria-hidden className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0px, transparent 18px, rgba(199, 123, 63, 0.08) 18px, rgba(199, 123, 63, 0.08) 19px)' }} />
      <div aria-hidden className="absolute -right-12 -top-16 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_70%)] blur-2xl" />
      <div className="absolute inset-4 rounded-md border border-[var(--color-border)]" />
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
        <div className="caption-mono">{name.toLowerCase().replace(/[^a-z]+/g, '-')} · screenshot<br /><span className="text-[var(--color-fg-subtle)]">1440×900</span></div>
        {status === 'live' && (
          <span className="rounded-full border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-2.5 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-positive)]">Shipping</span>
        )}
      </div>
    </div>
  )
}
