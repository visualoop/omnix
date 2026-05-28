import { cn } from '@/lib/cn'

/**
 * Standard hero used by every secondary page (/pricing, /modules, /about, etc.).
 *
 * Editorial composition matching the home hero:
 *   eyebrow with accent dot
 *   headline · Fraunces 300 · italic word emphasis (use <em>)
 *   lede · max 60ch
 *
 * Slot in `<em>...</em>` inside the title for inline italic emphasis.
 * Background defaults to a soft accent pool — same atmosphere across the site.
 */
interface PageHeroProps {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'left' | 'center'
  pattern?: 'glow' | 'grid' | 'none'
  children?: React.ReactNode
}

export function PageHero({
  eyebrow,
  title,
  description,
  align = 'center',
  pattern = 'glow',
  children,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)] pt-32 pb-20 sm:pt-40 sm:pb-28">
      {pattern === 'glow' ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[420px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent_72%)] blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_30%,var(--color-bg)_92%)]" />
        </div>
      ) : null}
      {pattern === 'grid' ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage:
              'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          }}
        />
      ) : null}

      <div
        className={cn(
          'container-default flex flex-col gap-7',
          align === 'center' ? 'mx-auto max-w-[44rem] items-center text-center' : 'max-w-[44rem]',
        )}
      >
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}

        <h1
          className={cn(
            'headline-hero',
            // Smaller than home hero — these are sub-pages
            'text-[clamp(44px,6.4vw,84px)] leading-[1.02] tracking-[-0.025em]',
            align === 'center' ? 'mx-auto' : '',
          )}
          style={{ maxWidth: '20ch' }}
        >
          {title}
        </h1>

        {description ? (
          <p
            className={cn(
              'lede text-balance',
              align === 'center' ? 'mx-auto' : '',
            )}
            style={{ maxWidth: '60ch' }}
          >
            {description}
          </p>
        ) : null}

        {children}
      </div>
    </section>
  )
}
