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
 *     variant: "pro" | "dawa" | ...,          // ignored — schema is
 *                                              //   single-installer
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
import { eq } from 'drizzle-orm'
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

  // Synthesise the markdown notes column from title + summary. The
  // /downloads page reads notes.split('\n')[0] as the headline.
  const notes = [title, summary].filter(Boolean).join('\n\n') || undefined

  // Stuff the legacy fields the new schema doesn't have a column for
  // into the metadata jsonb so they're available for future use
  // (sha256 verification, R2 size hints, variant tracking).
  const metadata = JSON.parse(
    JSON.stringify({
      variant: asString(body.variant),
      gitTag: asString(body.gitTag),
      sha256: {
        exe: asString(body.sha256Nsis),
        msi: asString(body.sha256Msi),
      },
    }),
  )

  // UPSERT on version (unique constraint).
  const id = `rel_${version}_${channel}`
  const existing = await db
    .select()
    .from(releases)
    .where(eq(releases.version, version))
    .limit(1)

  if (existing.length > 0) {
    const updateValues: Record<string, unknown> = {
      channel,
      ...(notes !== undefined ? { notes } : {}),
      ...(exeUrl !== undefined ? { exeUrl } : {}),
      ...(msiUrl !== undefined ? { msiUrl } : {}),
      ...(signature !== undefined ? { signature } : {}),
      metadata,
    }
    await db
      .update(releases)
      .set(updateValues)
      .where(eq(releases.version, version))
    return NextResponse.json(
      { ok: true, action: 'updated', version, channel },
      { status: 200 },
    )
  }

  await db.insert(releases).values({
    id,
    version,
    channel,
    notes,
    exeUrl,
    msiUrl,
    signature,
    metadata,
  })
  return NextResponse.json(
    { ok: true, action: 'created', version, channel },
    { status: 200 },
  )
}
