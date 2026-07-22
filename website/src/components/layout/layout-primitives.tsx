import * as React from 'react'

import { Container } from '@/components/ui/section'
import { cn } from '@/lib/cn'

export type PageWidth = 'narrow' | 'text' | 'default' | 'wide' | 'bleed'

type DivProps = React.ComponentProps<'div'>

export interface PageContainerProps extends DivProps {
  width?: PageWidth
}

/** Consistent max-width and fluid document gutters for every route group. */
export function PageContainer({
  width = 'default',
  className,
  ...props
}: PageContainerProps) {
  return <Container width={width} className={cn('w-full min-w-0', className)} {...props} />
}

export interface PageStackProps extends DivProps {
  gap?: 'sm' | 'md' | 'lg' | 'xl'
}

/** Vertical page rhythm without route-specific space-y values. */
export function PageStack({ gap = 'lg', className, ...props }: PageStackProps) {
  const gaps = {
    sm: 'gap-3',
    md: 'gap-5',
    lg: 'gap-8 sm:gap-10',
    xl: 'gap-12 sm:gap-16',
  } as const

  return <div className={cn('flex min-w-0 flex-col', gaps[gap], className)} {...props} />
}

export interface ClusterProps extends DivProps {
  align?: 'start' | 'center' | 'end'
  justify?: 'start' | 'between' | 'end'
}

/** Wrapping action/filter row that remains usable at 320px. */
export function Cluster({
  align = 'center',
  justify = 'start',
  className,
  ...props
}: ClusterProps) {
  const alignments = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
  } as const
  const justifications = {
    start: 'justify-start',
    between: 'justify-between',
    end: 'justify-end',
  } as const

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap gap-2 sm:gap-3',
        alignments[align],
        justifications[justify],
        className,
      )}
      {...props}
    />
  )
}

export interface SplitLayoutProps extends DivProps {
  asideWidth?: 'sm' | 'md' | 'lg'
  reverse?: boolean
}

/** Content/aside layout that collapses naturally instead of squeezing either column. */
export function SplitLayout({
  asideWidth = 'md',
  reverse = false,
  className,
  ...props
}: SplitLayoutProps) {
  const columns = {
    sm: 'lg:grid-cols-[minmax(0,1fr)_14rem]',
    md: 'lg:grid-cols-[minmax(0,1fr)_18rem]',
    lg: 'lg:grid-cols-[minmax(0,1fr)_22rem]',
  } as const

  return (
    <div
      data-reverse={reverse || undefined}
      className={cn(
        'grid min-w-0 grid-cols-1 items-start gap-8 lg:gap-12',
        columns[asideWidth],
        reverse && 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1',
        className,
      )}
      {...props}
    />
  )
}

export interface AppPageProps extends React.ComponentProps<'main'> {
  width?: PageWidth
  density?: 'compact' | 'default' | 'relaxed'
}

/** Main content viewport for dashboard/admin shells. */
export function AppPage({
  width = 'bleed',
  density = 'default',
  className,
  children,
  ...props
}: AppPageProps) {
  const padding = {
    compact: 'py-5 sm:py-6 lg:py-8',
    default: 'py-6 sm:py-8 lg:py-10',
    relaxed: 'py-8 sm:py-10 lg:py-12',
  } as const

  return (
    <main className={cn('min-w-0 flex-1', padding[density], className)} {...props}>
      <PageContainer width={width}>{children}</PageContainer>
    </main>
  )
}

export interface CenteredShellProps extends React.ComponentProps<'main'> {
  width?: Extract<PageWidth, 'narrow' | 'text' | 'default'>
}

/** Viewport-safe centred shell for auth, onboarding, and compact purchase states. */
export function CenteredShell({
  width = 'narrow',
  className,
  children,
  ...props
}: CenteredShellProps) {
  return (
    <main
      className={cn(
        'grid min-h-[calc(100dvh-8rem)] min-w-0 place-items-center py-10 sm:py-14',
        className,
      )}
      {...props}
    >
      <PageContainer width={width}>{children}</PageContainer>
    </main>
  )
}
