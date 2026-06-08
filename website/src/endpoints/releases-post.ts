import type { Endpoint } from 'payload'
import { errorResponse, isSystem, jsonResponse, readJson } from './_auth'

/**
 * POST /api/releases — system-only
 *
 * Called by the CircleCI `notify-payload` job after the Windows installer
 * has been signed, uploaded to Cloudflare R2, and the URLs are known.
 *
 * Payload creates a Release doc with status='draft' so the owner can
 * review highlights and changelog before clicking "Publish". If the
 * Settings global has flags.autoPublishReleases=true, status flips to
 * 'published' immediately.
 *
 * Body shape:
 * {
 *   version: "0.2.0",
 *   majorVersion: 0,
 *   channel: "stable" | "beta",
 *   gitTag: "v0.2.0",
 *   windowsMsiUrl: "https://r2.omnix.co.ke/stable/v0.2.0/Omnix_0.2.0_x64.msi",
 *   windowsNsisUrl: "https://r2.omnix.co.ke/stable/v0.2.0/Omnix_0.2.0_x64-setup.exe",
 *   windowsMsiSize: 54928384,
 *   windowsNsisSize: 50673664,
 *   sha256Msi: "a8f4...",
 *   sha256Nsis: "b3e1...",
 *   updaterSignature: "<tauri sig>",
 *   summary: "Banking & Recurring Invoices",
 *   changelog: { ... lexical rich text ... } | string
 * }
 */
export const releasesPostEndpoint: Endpoint = {
  path: '/releases-sync',
  method: 'post',
  handler: async (req) => {
    if (!isSystem(req)) {
      return errorResponse('Unauthorized — X-System-Token required', 401)
    }

    const body = await readJson<{
      version?: string
      majorVersion?: number
      channel?: 'stable' | 'beta' | 'alpha'
      variant?: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
      gitTag?: string
      windowsMsiUrl?: string
      windowsNsisUrl?: string
      windowsMsiSize?: number
      windowsNsisSize?: number
      sha256Msi?: string
      sha256Nsis?: string
      updaterSignature?: string
      title?: string
      summary?: string
      changelog?: unknown
      requiresMigration?: boolean
      migrationNotes?: string
      requiresPaidLicense?: boolean
      forcePublish?: boolean
      publishedAt?: string
    }>(req)

    if (!body || !body.version) {
      return errorResponse('Missing required field: version', 400)
    }

    const variant = body.variant ?? 'pro'

    // Derive majorVersion from semver if not provided
    const majorVersion =
      typeof body.majorVersion === 'number'
        ? body.majorVersion
        : parseInt(body.version.split('.')[0] ?? '0', 10)

    // Idempotency: if a release with this (version, variant) already exists, update it.
    // CI publishes one row per variant per version, so version alone is no longer unique.
    const existing = await req.payload.find({
      collection: 'releases',
      where: {
        and: [
          { version: { equals: body.version } },
          { variant: { equals: variant } },
        ],
      },
      limit: 1,
    })

    // Read settings to check auto-publish flag (CI body's forcePublish overrides).
    const settings = (await req.payload.findGlobal({ slug: 'settings' })) as unknown as {
      flags?: { autoPublishReleases?: boolean }
    }
    const autoPublish =
      body.forcePublish === true ||
      Boolean(settings?.flags?.autoPublishReleases)

    const status: 'draft' | 'published' = autoPublish ? 'published' : 'draft'

    // Validate: cannot auto-publish without download URLs and updater signature
    const nsisUrl = body.windowsNsisUrl?.trim()
    const updaterSig = body.updaterSignature?.trim()
    if (status === 'published') {
      if (!nsisUrl) {
        return errorResponse('Cannot auto-publish: missing windowsNsisUrl', 400)
      }
      if (!updaterSig) {
        return errorResponse('Cannot auto-publish: missing updaterSignature', 400)
      }
    }

    const data = {
      version: body.version,
      variant,
      majorVersion,
      channel: body.channel ?? 'stable',
      gitTag: body.gitTag,
      status,
      windowsMsiUrl: body.windowsMsiUrl,
      windowsNsisUrl: body.windowsNsisUrl,
      windowsMsiSize: body.windowsMsiSize,
      windowsNsisSize: body.windowsNsisSize,
      sha256Msi: body.sha256Msi,
      sha256Nsis: body.sha256Nsis,
      updaterSignature: body.updaterSignature,
      title: body.title ?? `v${body.version}`,
      summary: body.summary,
      changelog: body.changelog as never,
      requiresMigration: Boolean(body.requiresMigration),
      migrationNotes: body.migrationNotes,
      requiresPaidLicense: Boolean(body.requiresPaidLicense),
      publishedAt: autoPublish ? body.publishedAt ?? new Date().toISOString() : undefined,
    }

    let release
    if (existing.docs[0]) {
      release = await req.payload.update({
        collection: 'releases',
        id: (existing.docs[0] as { id: string | number }).id,
        data,
        overrideAccess: true,
      })
    } else {
      release = await req.payload.create({
        collection: 'releases',
        data,
        overrideAccess: true,
      })
    }

    return jsonResponse({
      ok: true,
      action: existing.docs[0] ? 'updated' : 'created',
      release: {
        id: (release as { id: string | number }).id,
        version: body.version,
        status,
      },
    })
  },
}
