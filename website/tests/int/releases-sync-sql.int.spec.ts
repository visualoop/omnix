import { PgDialect } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { describe, expect, it } from 'vitest'
import { releases } from '@/db/schema/releases'
import { buildDesktopMetadataMergeSql } from '@/lib/release-metadata-sql'

describe('release metadata conflict-update SQL', () => {
  it('casts every parameter used as a JSON object key or -> right-hand operand', () => {
    const metadata = buildDesktopMetadataMergeSql({
      variant: 'dawa',
      variantAssets: {
        exe: 'https://media.omnix.co.ke/releases/v0.74.1/dawa/Omnix.Dawa_0.74.1_x64-setup.exe',
        signature: 'tauri-signature',
        sha256: { exe: 'a'.repeat(64) },
      },
      syncMetadata: {
        source: 'ci-notify',
        syncedAt: '2026-08-01T19:37:54.954Z',
      },
    })
    const db = drizzle(async () => ({ rows: [] }))
    const statement = db
      .insert(releases)
      .values({
        id: 'rel_0.74.1_stable',
        version: '0.74.1',
        metadata: { variants: {} },
      })
      .onConflictDoUpdate({
        target: releases.version,
        set: { metadata },
      })
    const rendered = new PgDialect().sqlToQuery(statement.getSQL())

    expect(rendered.sql).toContain('on conflict ("version") do update set "metadata" =')
    expect(rendered.sql).not.toContain("'{sha256}'")

    const parameterizedJsonPositions = [
      ...rendered.sql.matchAll(/(?:jsonb_build_object\(\s*|->\s*)(\$\d+)(?:::text)?/g),
    ].map((match) => match[0])
    expect(parameterizedJsonPositions).toHaveLength(2)
    expect(parameterizedJsonPositions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/jsonb_build_object\(\s*\$\d+::text/),
        expect.stringMatching(/->\s*\$\d+::text/),
      ]),
    )
    expect(
      parameterizedJsonPositions.filter((position) => !/\$\d+::text/.test(position)),
    ).toEqual([])
  })
})
