import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('signed Android release publishing contract', () => {
  it('persists complete Android artifact identity without replacing desktop columns', () => {
    const schema = read('src/db/schema/releases.ts')
    const route = read('src/app/api/releases-sync/route.ts')

    for (const field of [
      'androidPlatform',
      'androidPackageId',
      'androidVersionCode',
      'androidApkUrl',
      'androidAabUrl',
      'androidApkSize',
      'androidAabSize',
      'sha256Apk',
      'sha256Aab',
      'androidSigningCertificateSha256',
    ]) {
      expect(schema, `${field} missing from release schema`).toContain(field)
      expect(route, `${field} missing from release ingest`).toContain(field)
    }

    expect(route).toContain("platform === 'android'")
    expect(route).toContain("url.hostname === 'media.omnix.co.ke'")
    expect(route).toContain("androidPackageId !== 'co.ke.omnix.app'")
    expect(route).toContain('.onConflictDoUpdate({')
    expect(route).toContain("platform: 'android'")
    expect(route).toContain('androidApkUrl,')
    expect(route).toContain('windowsNsisUrl')
    expect(route).toContain('windowsMsiUrl')
  })

  it('ships an additive standalone and inline migration', () => {
    const migration = read('drizzle/migrations/0008_android_release_artifacts.sql')
    const inline = read('src/db/migration-sql.ts')
    for (const column of [
      'android_platform',
      'android_package_id',
      'android_version_code',
      'android_apk_url',
      'android_aab_url',
      'android_apk_size',
      'android_aab_size',
      'sha256_apk',
      'sha256_aab',
      'android_signing_certificate_sha256',
    ]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
      expect(inline).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
  })

  it('shows Android downloads and verification data in release administration', () => {
    const entry = read('src/components/admin/release-entry.tsx')
    expect(entry).toContain('r.androidApkUrl')
    expect(entry).toContain('r.androidAabUrl')
    expect(entry).toContain('r.sha256Apk')
    expect(entry).toContain('r.androidSigningCertificateSha256')
    expect(entry).toContain('.apk')
    expect(entry).toContain('.aab')
  })
})
