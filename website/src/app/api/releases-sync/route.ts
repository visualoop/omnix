/**
 * POST /api/releases-sync
 *
 * CI calls this on every successful build — see
 * .github/workflows/ci.yml step 'Notify Payload'. The path was named
 * back when Payload CMS owned the releases collection; we kept the
 * same URL after migrating to Drizzle so CI didn't need a change.
 *
 * Body (legacy Payload shape — fields ignored when the new schema
 * doesn't have a column for them):
 *   {
 *     version: "0.7.16",                      // required, semver
 *     variant: "pro" | "dawa" | ...,          // required for desktop;
 *                                              // stored under metadata.variants
 *     majorVersion: 0,                        // ignored
 *     channel: "stable" | "beta" | "nightly", // optional, default stable
 *     gitTag: "v0.7.16",                      // ignored
 *     windowsNsisUrl: "https://...",          // → exe_url
 *     windowsMsiUrl: "https://...",           // → msi_url
 *     windowsNsisSize: 53000000,              // ignored (no column)
 *     windowsMsiSize: 51000000,               // ignored
 *     sha256Nsis: "abc...",                   // → metadata.sha256.exe
 *     sha256Msi: "def...",                    // → metadata.sha256.msi
 *     updaterSignature: "...",                // → signature
 *     title: "Omnix v0.7.16",                 // → notes (first line)
 *     summary: "Bug fixes...",                // → notes (rest)
 *     forcePublish: true,                     // ignored — always publish
 *   }
 *
 * Android CI sends platform="android" plus package/version identity, APK/AAB
 * URLs, byte sizes, SHA-256 digests, and the signing certificate fingerprint.
 * Those fields are stored beside (not instead of) the desktop artifacts.
 *
 * Auth: header `x-system-token: $RELEASE_INGEST_TOKEN`. The CI secret
 * is named `PAYLOAD_SYSTEM_TOKEN` for backwards compat — read either
 * env var to make the cutover seamless. Constant-time compare to
 * dodge timing attacks.
 *
 * Idempotent: UPSERT keyed on `version` (the schema has a unique
 * constraint there). Re-running CI with the same tag overwrites
 * the row — safe.
 */

import { NextResponse } from 'next/server'
import { db, releases } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'

interface IngestBody {
  version?: unknown
  variant?: unknown
  channel?: unknown
  gitTag?: unknown
  windowsNsisUrl?: unknown
  windowsMsiUrl?: unknown
  sha256Nsis?: unknown
  sha256Msi?: unknown
  updaterSignature?: unknown
  platform?: unknown
  androidPackageId?: unknown
  androidVersionCode?: unknown
  androidApkUrl?: unknown
  androidAabUrl?: unknown
  androidApkSize?: unknown
  androidAabSize?: unknown
  sha256Apk?: unknown
  sha256Aab?: unknown
  androidSigningCertificateSha256?: unknown
  title?: unknown
  summary?: unknown
}

function checkToken(req: Request): { ok: true } | { ok: false; reason: string } {
  const expected =
    process.env.RELEASE_INGEST_TOKEN || process.env.PAYLOAD_SYSTEM_TOKEN
  if (!expected) {
    return {
      ok: false,
      reason:
        'server is missing RELEASE_INGEST_TOKEN (or legacy PAYLOAD_SYSTEM_TOKEN)',
    }
  }
  const got = req.headers.get('x-system-token') ?? ''
  if (got.length !== expected.length) {
    return { ok: false, reason: 'invalid token' }
  }
  // Constant-time compare prevents leaking the token length / prefix
  // through response timing.
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return { ok: false, reason: 'invalid token' }
  }
  return { ok: true }
}

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
}

function asPositiveInteger(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : undefined
}

function asSha256(v: unknown): string | undefined {
  const value = asString(v)?.toLowerCase()
  return value && /^[0-9a-f]{64}$/.test(value) ? value : undefined
}

function asAndroidArtifactUrl(v: unknown): string | undefined {
  const value = asString(v)
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'media.omnix.co.ke'
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

export async function POST(req: Request) {
  const auth = checkToken(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  let body: IngestBody
  try {
    body = (await req.json()) as IngestBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const version = asString(body.version)
  if (!version || !SEMVER_RE.test(version)) {
    return NextResponse.json(
      { error: 'invalid `version` — expected semver like "0.7.16"' },
      { status: 400 },
    )
  }

  const channel = asString(body.channel) ?? 'stable'
  if (!['stable', 'beta', 'nightly'].includes(channel)) {
    return NextResponse.json(
      { error: `invalid channel "${channel}"` },
      { status: 400 },
    )
  }

  const exeUrl = asString(body.windowsNsisUrl)
  const msiUrl = asString(body.windowsMsiUrl)
  const signature = asString(body.updaterSignature)
  const title = asString(body.title)
  const summary = asString(body.summary)
  const variant = asString(body.variant)
  const platform = asString(body.platform)

  // Synthesise the markdown notes column from title + summary. The
  // /downloads page reads notes.split('\n')[0] as the headline.
  const notes = [title, summary].filter(Boolean).join('\n\n') || undefined

  // ── Per-variant merge logic ────────────────────────────────
  //
  // CI calls this endpoint once per matrix variant. Every call must merge its
  // signed installer into metadata.variants without replacing entries written
  // by another job. The atomic JSONB conflict update below performs that merge
  // against the row version locked by PostgreSQL.

  // UPSERT on version (unique constraint).
  const id = `rel_${version}_${channel}`
  const existing = (await db
    .select()
    .from(releases)
    .where(eq(releases.version, version))
    .limit(1))[0]

  if (platform === 'android') {
    const androidPackageId = asString(body.androidPackageId)
    const androidVersionCode = asPositiveInteger(body.androidVersionCode)
    const androidApkUrl = asAndroidArtifactUrl(body.androidApkUrl)
    const androidAabUrl = asAndroidArtifactUrl(body.androidAabUrl)
    const androidApkSize = asPositiveInteger(body.androidApkSize)
    const androidAabSize = asPositiveInteger(body.androidAabSize)
    const sha256Apk = asSha256(body.sha256Apk)
    const sha256Aab = asSha256(body.sha256Aab)
    const androidSigningCertificateSha256 = asSha256(
      body.androidSigningCertificateSha256,
    )

    if (
      androidPackageId !== 'co.ke.omnix.app' ||
      androidVersionCode === undefined ||
      androidApkUrl === undefined ||
      androidAabUrl === undefined ||
      androidApkSize === undefined ||
      androidAabSize === undefined ||
      sha256Apk === undefined ||
      sha256Aab === undefined ||
      androidSigningCertificateSha256 === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'invalid Android release metadata — require Omnix package identity, media.omnix.co.ke HTTPS URLs, positive sizes, and SHA-256 values',
        },
        { status: 400 },
      )
    }

    const androidValues = {
      channel,
      androidPlatform: 'android',
      androidPackageId,
      androidVersionCode,
      androidApkUrl,
      androidAabUrl,
      androidApkSize,
      androidAabSize,
      sha256Apk,
      sha256Aab,
      androidSigningCertificateSha256,
    } as const

    await db
      .insert(releases)
      .values({
        id,
        version,
        notes,
        ...androidValues,
      })
      .onConflictDoUpdate({
        target: releases.version,
        set: androidValues,
      })

    return NextResponse.json(
      {
        ok: true,
        action: existing ? 'updated' : 'created',
        version,
        channel,
        variant,
        platform: 'android',
        androidApkUrl,
      },
      { status: 200 },
    )
  }

  const desktopVariants = ['pro', 'dawa', 'retail', 'hospitality', 'hardware', 'salon'] as const
  if (!variant || !desktopVariants.some((candidate) => candidate === variant)) {
    return NextResponse.json(
      { error: 'invalid or missing desktop `variant`' },
      { status: 400 },
    )
  }
  if (!exeUrl || !signature) {
    return NextResponse.json(
      { error: 'desktop releases require an NSIS URL and updater signature' },
      { status: 400 },
    )
  }
  for (const [field, value] of [
    ['windowsNsisUrl', exeUrl],
    ['windowsMsiUrl', msiUrl],
  ] as const) {
    if (!value) continue
    try {
      if (new URL(value).protocol !== 'https:') throw new Error('not HTTPS')
    } catch {
      return NextResponse.json({ error: `invalid HTTPS ${field}` }, { status: 400 })
    }
  }

  const variantAssets = {
    exe: exeUrl,
    ...(msiUrl ? { msi: msiUrl } : {}),
    signature,
  }
  const sha256 = {
    ...(asString(body.sha256Nsis) ? { exe: asString(body.sha256Nsis) } : {}),
    ...(asString(body.sha256Msi) ? { msi: asString(body.sha256Msi) } : {}),
  }
  const syncMetadata = {
    source: 'ci-notify',
    syncedAt: new Date().toISOString(),
    ...(asString(body.gitTag) ? { gitTag: asString(body.gitTag) } : {}),
  }
  const initialMetadata = {
    variants: { [variant]: variantAssets },
    sha256,
    ...syncMetadata,
  }

  // Each matrix job writes a different key in metadata.variants. Perform the
  // nested JSONB merge in the conflict UPDATE itself so concurrent notifications
  // cannot overwrite variants read before another job committed.
  const mergedMetadata = sql`(
    jsonb_set(
      jsonb_set(
        coalesce(${releases.metadata}, '{}'::jsonb),
        '{variants}',
        coalesce(${releases.metadata}->'variants', '{}'::jsonb)
          || jsonb_build_object(
            ${variant},
            coalesce(${releases.metadata}->'variants'->${variant}, '{}'::jsonb)
              || ${JSON.stringify(variantAssets)}::jsonb
          )
      ),
      '{sha256}',
      coalesce(${releases.metadata}->'sha256', '{}'::jsonb)
        || ${JSON.stringify(sha256)}::jsonb
    ) || ${JSON.stringify(syncMetadata)}::jsonb
  )`

  const isCanonicalPro = variant === 'pro'
  await db
    .insert(releases)
    .values({
      id,
      version,
      channel,
      notes,
      exeUrl: isCanonicalPro ? exeUrl : undefined,
      msiUrl: isCanonicalPro ? msiUrl : undefined,
      signature: isCanonicalPro ? signature : undefined,
      metadata: initialMetadata,
    })
    .onConflictDoUpdate({
      target: releases.version,
      set: {
        channel,
        ...(notes !== undefined ? { notes } : {}),
        ...(isCanonicalPro ? { exeUrl, msiUrl, signature } : {}),
        metadata: mergedMetadata,
      },
    })

  return NextResponse.json(
    {
      ok: true,
      action: existing ? 'updated' : 'created',
      version,
      channel,
      variant,
      desktop: {
        exe: exeUrl,
        msi: msiUrl ?? null,
        signatureStored: true,
      },
    },
    { status: 200 },
  )
}
