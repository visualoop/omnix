import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse } from './_auth'

/**
 * GET /api/releases/latest — public, license-aware, variant-aware
 *
 * Used by:
 *   1. The Tauri desktop auto-updater. Returns the Tauri-spec JSON shape:
 *      { version, pub_date, notes, platforms: { "windows-x86_64": { signature, url } } }
 *   2. The /downloads page. Just reads the same data per variant tile.
 *
 * Query params:
 *   - variant   (optional) — pro|dawa|retail|hospitality|hardware. Defaults to 'pro'.
 *   - license   (optional) — current license key. Filters by majorVersionCap.
 *   - current   (optional) — current version on the machine. For diagnostics.
 *   - channel   (optional) — "stable" (default) | "beta" — for testers.
 */
export const releasesLatestEndpoint: Endpoint = {
  path: '/releases-latest',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const licenseKey = url.searchParams.get('license')
    const channel = url.searchParams.get('channel') ?? 'stable'
    const variantParam = (url.searchParams.get('variant') ?? 'pro').toLowerCase()
    const validVariants = ['pro', 'dawa', 'retail', 'hospitality', 'hardware']
    const variant = validVariants.includes(variantParam) ? variantParam : 'pro'

    // Resolve license if provided
    let majorCap = 99
    let licenseStatus: string | null = null
    let licenseVariant: string = 'pro'
    if (licenseKey) {
      const lic = await req.payload.find({
        collection: 'licenses',
        where: { licenseKey: { equals: licenseKey } },
        limit: 1,
        depth: 0,
      })
      if (lic.docs[0]) {
        const l = lic.docs[0] as unknown as { majorVersionCap?: number; status?: string; variant?: string }
        majorCap = l.majorVersionCap ?? 1
        licenseStatus = l.status ?? null
        licenseVariant = l.variant ?? 'pro'
      }
    }

    // Find latest published Release for this variant in channel that
    // matches the major-version cap.
    const result = await req.payload.find({
      collection: 'releases',
      where: {
        and: [
          { status: { equals: 'published' } },
          { channel: { equals: channel } },
          { variant: { equals: variant } },
          { majorVersion: { less_than_equal: majorCap } },
        ],
      },
      sort: '-publishedAt',
      limit: 1,
    })

    const release = result.docs[0] as unknown as {
      version?: string
      publishedAt?: string
      summary?: string
      windowsNsisUrl?: string
      updaterSignature?: string
      requiresPaidLicense?: boolean
      minMajorVersionToUpgrade?: number
    }

    if (!release) {
      return errorResponse('No release available', 404)
    }

    // Trial users blocked from paid-only releases
    const isTrial = licenseStatus === 'trial' || licenseStatus === 'lapsed'
    if (release.requiresPaidLicense && isTrial) {
      return errorResponse('This release requires a paid licence', 402)
    }

    // Build platform entry — Tauri NSIS bundles look for the -nsis suffix first
    const platformUrl = release.windowsNsisUrl ?? ''
    const platformSig = release.updaterSignature ?? ''

    return jsonResponse({
      version: release.version,
      pub_date: release.publishedAt,
      notes: release.summary ?? '',
      platforms: {
        'windows-x86_64-nsis': {
          signature: platformSig,
          url: platformUrl,
        },
        'windows-x86_64': {
          signature: platformSig,
          url: platformUrl,
        },
      },
      // Extra metadata for Omnix client
      must_upgrade: (release.minMajorVersionToUpgrade ?? 0) > majorCap,
      requires_paid_license: Boolean(release.requiresPaidLicense),
      caller_license_status: licenseStatus,
    })
  },
}
