import { cn } from '@/lib/cn'

/**
 * Section container — uses the new max-width tokens (NOT max-w-[1180px]).
 * Pick width per content density: narrow=760, text=920, default=1180, wide=1320, bleed=1480.
 */
interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: 'narrow' | 'text' | 'default' | 'wide' | 'bleed'
}

export function Container({ width = 'default', className, ...rest }: ContainerProps) {
  const map = {
    narrow: 'container-narrow',
    text: 'container-text',
    default: 'container-default',
    wide: 'container-wide',
    bleed: 'container-bleed',
  } as const
  return <div className={cn(map[width], className)} {...rest} />
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div'
  pad?: 'tight' | 'default' | 'loose' | 'none'
  divide?: boolean
}

export function Section({
  as: Tag = 'section',
  pad = 'default',
  divide = false,
  className,
  children,
  ...rest
}: SectionProps) {
  const padMap = {
    none: '',
    tight: 'section-tight',
    default: 'section',
    loose: 'section-loose',
  } as const
  return (
    <Tag
      className={cn(
        'relative w-full',
        padMap[pad],
        divide ? 'border-t border-[var(--color-border)]' : '',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Small operational label above section headlines. */
export function Eyebrow({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('eyebrow', className)} {...rest} />
}

interface HeadingProps {
  level?: 1 | 2 | 3
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center'
}

export function Heading({ level = 2, children, className, align = 'left' }: HeadingProps) {
  const sizeMap = {
    1: 'text-[clamp(42px,6.5vw,88px)] leading-[0.96] tracking-[-0.05em]',
    2: 'text-[clamp(36px,4.6vw,64px)] leading-none tracking-[-0.045em]',
    3: 'text-[clamp(25px,2.6vw,38px)] leading-[1.08] tracking-[-0.035em]',
  } as const
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  return (
    <Tag
      className={cn(
        'font-display font-semibold text-balance text-[var(--color-fg)]',
        sizeMap[level],
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/** Compatibility helper: emphasis is colour and weight, never decorative italics. */
export function Italic({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-inherit font-semibold not-italic text-[var(--color-accent)]', className)}>
      {children}
    </span>
  )
}

interface SectionHeaderProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex max-w-3xl flex-col gap-5',
        align === 'center' ? 'mx-auto items-center text-center' : '',
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow>{eyebrow}</Eyebrow>
      ) : null}
      <Heading level={2} align={align}>
        {title}
      </Heading>
      {subtitle ? (
        <p className="max-w-2xl text-balance font-[family-name:var(--font-sans)] text-[17px] leading-[1.6] text-[var(--color-fg-muted)] sm:text-[19px]">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

/** Hairline 1-pixel divider with optional small accent dot at the centre. */
export function Hairline({ accent = false, className }: { accent?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-px flex-1 bg-[var(--color-border)]" />
      {accent ? <div className="size-1 rounded-full bg-[var(--color-accent)]" /> : null}
      <div className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  )
}
