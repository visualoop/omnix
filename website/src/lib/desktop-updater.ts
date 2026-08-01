export const DESKTOP_VARIANTS = [
  'pro',
  'dawa',
  'retail',
  'hospitality',
  'hardware',
  'salon',
] as const

export type DesktopVariant = (typeof DESKTOP_VARIANTS)[number]

export interface DesktopVariantAssets {
  exe?: string
  msi?: string
  signature?: string
}

export interface DesktopRelease {
  version: string
  notes: string | null
  publishedAt: Date
  metadata: unknown
}

export type DesktopUpdateResolution =
  | { status: 'up-to-date' }
  | { status: 'missing-assets'; missing: Array<'installer' | 'signature'> }
  | {
      status: 'update'
      manifest: {
        version: string
        notes: string
        pub_date: string
        platforms: {
          'windows-x86_64': { signature: string; url: string }
        }
      }
    }

export function isDesktopVariant(value: string): value is DesktopVariant {
  return DESKTOP_VARIANTS.some((variant) => variant === value)
}

/** Semver comparison for the stable MAJOR.MINOR.PATCH versions used by CI. */
export function compareDesktopVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const difference = (pa[index] ?? 0) - (pb[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function variantAssets(metadata: unknown, variant: DesktopVariant): DesktopVariantAssets {
  if (!metadata || typeof metadata !== 'object') return {}
  const variants = (metadata as { variants?: unknown }).variants
  if (!variants || typeof variants !== 'object') return {}
  const assets = (variants as Partial<Record<DesktopVariant, unknown>>)[variant]
  if (!assets || typeof assets !== 'object') return {}

  const candidate = assets as Record<string, unknown>
  return {
    exe: typeof candidate.exe === 'string' && candidate.exe.trim() ? candidate.exe.trim() : undefined,
    msi: typeof candidate.msi === 'string' && candidate.msi.trim() ? candidate.msi.trim() : undefined,
    signature:
      typeof candidate.signature === 'string' && candidate.signature.trim()
        ? candidate.signature.trim()
        : undefined,
  }
}

/**
 * Resolve an update without ever crossing variant boundaries. A missing URL or
 * signature is an operational error, not "no update"; only an up-to-date
 * client receives 204 from the route.
 */
export function resolveDesktopUpdate(
  release: DesktopRelease,
  variant: DesktopVariant,
  currentVersion: string,
): DesktopUpdateResolution {
  if (currentVersion && compareDesktopVersions(currentVersion, release.version) >= 0) {
    return { status: 'up-to-date' }
  }

  const assets = variantAssets(release.metadata, variant)
  const installer = assets.exe ?? assets.msi
  const missing: Array<'installer' | 'signature'> = []
  if (!installer) missing.push('installer')
  if (!assets.signature) missing.push('signature')
  if (!installer || !assets.signature) return { status: 'missing-assets', missing }

  return {
    status: 'update',
    manifest: {
      version: release.version,
      notes: release.notes ?? `Omnix ${release.version}`,
      pub_date: release.publishedAt.toISOString(),
      platforms: {
        'windows-x86_64': {
          signature: assets.signature,
          url: encodeURI(installer),
        },
      },
    },
  }
}
