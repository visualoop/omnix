import Link from 'next/link'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EmptyState,
  FilteredEmptyState,
  NotFoundState,
  PermissionState,
  StateView,
} from '@/components/ui/state-view'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState, SkeletonList } from '@/components/ui/loading-skeleton'

afterEach(cleanup)

describe('Task 27 · StateView primitive', () => {
  it('renders a quiet, labelled block with a stable data-state hook', () => {
    render(<StateView title="Nothing here yet" description="A quiet body." dataState="empty" />)
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeTruthy()
    expect(screen.getByText('A quiet body.')).toBeTruthy()
    expect(document.querySelector('[data-state="empty"]')).toBeTruthy()
  })

  it('never emits emoji or gradient utility classes', () => {
    const { container } = render(<StateView title="Plain" code="404" tone="accent" />)
    const html = container.innerHTML
    expect(html).not.toMatch(/bg-gradient|from-\[/)
    // No emoji code points.
    expect(/\p{Extended_Pictographic}/u.test(html)).toBe(false)
  })
})

describe('Task 27 · EmptyState is procedural', () => {
  it('renders a real next-action when given one', () => {
    render(
      <EmptyState
        title="No licences yet"
        description="Buy a licence to see it here."
        action={<Link href="/pricing">See pricing</Link>}
      />,
    )
    const cta = screen.getByRole('link', { name: 'See pricing' })
    expect(cta.getAttribute('href')).toBe('/pricing')
    expect(document.querySelector('[data-state="empty"]')).toBeTruthy()
  })
})

describe('Task 27 · FilteredEmptyState always clears filters', () => {
  it('links back to the unfiltered list', () => {
    render(<FilteredEmptyState query="acme" clearHref="/admin/users" entityLabel="users" />)
    const clear = screen.getByRole('link', { name: /clear filters/i })
    expect(clear.getAttribute('href')).toBe('/admin/users')
    expect(screen.getByText(/acme/)).toBeTruthy()
    expect(document.querySelector('[data-state="filtered-empty"]')).toBeTruthy()
  })
})

describe('Task 27 · PermissionState', () => {
  it('names the required role only when explicitly given', () => {
    const { rerender } = render(<PermissionState />)
    // Default copy must not leak a specific role.
    expect(screen.queryByText(/platform admin/i)).toBeNull()
    expect(document.querySelector('[data-state="permission-denied"]')).toBeTruthy()

    rerender(<PermissionState requiredRole="platform admin" />)
    expect(screen.getByText(/platform admin/i)).toBeTruthy()
  })
})

describe('Task 27 · NotFoundState is generic', () => {
  it('does not reference a specific id/slug', () => {
    render(<NotFoundState />)
    expect(screen.getByText('404')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy()
  })
})

describe('Task 27 · LoadingState accessibility', () => {
  it('exposes aria-busy status with a screen-reader label and structural skeletons', () => {
    render(
      <LoadingState label="Loading licences…">
        <SkeletonList rows={3} />
      </LoadingState>,
    )
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Loading licences…')).toBeTruthy()
    // Skeleton bars are decorative (aria-hidden), never fake content.
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})

describe('Task 27 · ErrorState behaviour', () => {
  const originalError = console.error

  afterEach(() => {
    console.error = originalError
  })

  it('logs for operators, shows only the digest, and never renders error.message', () => {
    console.error = vi.fn()
    const reset = vi.fn()
    const error = Object.assign(new Error('secret db string user@example.com'), { digest: 'abc123' })
    render(<ErrorState error={error} reset={reset} scope="dashboard" />)

    // Operator log fired…
    expect(console.error).toHaveBeenCalled()
    // …but the sensitive message is not in the DOM.
    expect(screen.queryByText(/secret db string/)).toBeNull()
    expect(screen.queryByText(/user@example.com/)).toBeNull()
    // The opaque digest reference is shown.
    expect(screen.getByText(/abc123/)).toBeTruthy()
    // It is an assertive alert region.
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('offers a retry that calls reset()', () => {
    console.error = vi.fn()
    const reset = vi.fn()
    render(<ErrorState error={new Error('boom')} reset={reset} scope="page" />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('shows offline copy when the browser reports it is offline', () => {
    console.error = vi.fn()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    render(<ErrorState error={new Error('Failed to fetch')} reset={vi.fn()} scope="page" />)
    expect(screen.getByRole('heading', { name: /offline/i })).toBeTruthy()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true })
  })
})
