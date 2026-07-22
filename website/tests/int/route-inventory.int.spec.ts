import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  APP_API_ROUTES,
  APP_PAGE_ROUTES,
  API_ROUTE_GROUPS,
  PAGE_ROUTE_GROUPS,
} from '@/config/route-inventory'

const APP_ROOT = join(process.cwd(), 'src', 'app')

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function appRouteFromFile(filePath: string): string {
  const directory = relative(APP_ROOT, join(filePath, '..'))
  const segments = directory
    .split(sep)
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))

  return `/${segments.join('/')}`.replace(/\/$/, '') || '/'
}

function discoveredRoutes(fileName: 'page.tsx' | 'route.ts' | 'route.tsx'): string[] {
  return walk(APP_ROOT)
    .filter((filePath) => filePath.endsWith(`${sep}${fileName}`))
    .map(appRouteFromFile)
    .sort()
}

function flatten(groups: Record<string, readonly string[]>): string[] {
  return Object.values(groups).flat().sort()
}

describe('website route inventory', () => {
  it('accounts for every App Router page', () => {
    expect(APP_PAGE_ROUTES).toEqual(flatten(PAGE_ROUTE_GROUPS))
    expect(APP_PAGE_ROUTES).toEqual(discoveredRoutes('page.tsx'))
    expect(APP_PAGE_ROUTES).toHaveLength(90)
  })

  it('accounts for every App Router API/metadata route', () => {
    const discovered = [
      ...discoveredRoutes('route.ts'),
      ...discoveredRoutes('route.tsx'),
    ].sort()

    expect(APP_API_ROUTES).toEqual(flatten(API_ROUTE_GROUPS))
    expect(APP_API_ROUTES).toEqual(discovered)
    expect(APP_API_ROUTES).toHaveLength(54)
  })

  it('contains no duplicate page or API routes', () => {
    expect(new Set(APP_PAGE_ROUTES).size).toBe(APP_PAGE_ROUTES.length)
    expect(new Set(APP_API_ROUTES).size).toBe(APP_API_ROUTES.length)
  })
})
