import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse } from './_auth'

/**
 * GET /api/releases/latest — public, license-aware
 *
 * Used by:
 *   1. The Tauri desktop auto-updater. Returns the Tauri-spec JSON shape:
 *      { version, pub_date, notes, platforms: { "windows-x86_64": { signature, url } } }
 *   2. The /downloads page. Just reads the same data.
 *
 * Query params:
 *   - license   (optional) — current license key. Filters by majorVersionCap.
 *   - current   (optional) — current version on the machine. For diagnostics.
 *   - channel   (optional) — "stable" (default) | "beta" — for testers.
 */
export const releasesLatestEndpoint: Endpoint = {
  path: '/releases/latest',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const licenseKey = url.searchParams.get('license')
    const channel = url.searchParams.get('channel') ?? 'stable'

    // Resolve license if provided
    let majorCap = 99
    let licenseStatus: string | null = null
    if (licenseKey) {
      const lic = await req.payload.find({
        collection: 'licenses',
        where: { licenseKey: { equals: licenseKey } },
        limit: 1,
        depth: 0,
      })
      if (lic.docs[0]) {
        const l = lic.docs[0] as unknown as { majorVersionCap?: number; status?: string }
        majorCap = l.majorVersionCap ?? 1
        licenseStatus = l.status ?? null
      }
    }

    // Find latest published Release in channel that matches the major-version cap
    const result = await req.payload.find({
      collection: 'releases',
      where: {
        and: [
          { status: { equals: 'published' } },
          { channel: { equals: channel } },
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

    return jsonResponse({
      version: release.version,
      pub_date: release.publishedAt,
      notes: release.summary ?? '',
      platforms: {
        'windows-x86_64': {
          signature: release.updaterSignature ?? '',
          url: release.windowsNsisUrl ?? '',
        },
      },
      // Extra metadata for Duka client
      must_upgrade: (release.minMajorVersionToUpgrade ?? 0) > majorCap,
      requires_paid_license: Boolean(release.requiresPaidLicense),
      caller_license_status: licenseStatus,
    })
  },
}
