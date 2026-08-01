import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AndroidDownloadSection } from '@/components/dashboard/AndroidDownloadSection'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const dashboardSource = read('src/app/(dashboard)/dashboard/downloads/page.tsx')
const componentSource = read('src/components/dashboard/AndroidDownloadSection.tsx')
const releaseHelperSource = read('src/lib/android-release.ts')

const SHA256 = '8b1a9953c4611296a827abf8c47804d7f8a5f45c8e2b53d658f6c3f9f5d9b621'

afterEach(() => cleanup())
const APK_URL = 'https://media.omnix.co.ke/releases/omnix-android-1.4.2.apk'

describe('dashboard Android download', () => {
  it('renders the APK URL, version, size, and full SHA-256 from the release record', () => {
    render(
      <AndroidDownloadSection
        release={{
          version: '1.4.2',
          apkUrl: APK_URL,
          apkSize: 73_400_320,
          sha256: SHA256,
        }}
      />,
    )

    expect(screen.getByText(/v1\.4\.2/)).not.toBeNull()
    expect(screen.getByText(/70\.0 MB/)).not.toBeNull()
    expect(screen.getByText(SHA256)).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Download Android APK' }).getAttribute('href')).toBe(APK_URL)
    expect(screen.getByRole('link', { name: /Android installation guide/ }).getAttribute('href')).toBe(
      '/ke/docs/android-app',
    )
    expect(screen.getByText(/Google Play distribution is not live/)).not.toBeNull()
    expect(screen.getByText(/iOS is not available/)).not.toBeNull()
    expect(screen.queryByText(/AAB/i)).toBeNull()
  })

  it('shows an honest empty state without a dead APK link when no release record exists', () => {
    render(<AndroidDownloadSection release={undefined} />)

    expect(screen.getByText('No signed Android release is available yet')).not.toBeNull()
    expect(screen.getByText(/when the signed APK is published/)).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Download Android APK' })).toBeNull()
  })

  it('wires the protected dashboard to the shared stable release-record query without exposing AAB', () => {
    expect(dashboardSource).toContain("import { getLatestAndroidRelease } from '@/lib/android-release'")
    expect(dashboardSource).toContain('<AndroidDownloadSection release={androidRelease} />')
    expect(releaseHelperSource).toContain('releases.androidApkUrl')
    expect(releaseHelperSource).toContain('releases.androidApkSize')
    expect(releaseHelperSource).toContain('releases.sha256Apk')
    expect(releaseHelperSource).toContain("eq(releases.channel, 'stable')")

    const authGate = dashboardSource.indexOf("redirect('/login?next=/dashboard/downloads')")
    const androidLookup = dashboardSource.indexOf('getLatestAndroidRelease(),')
    expect(authGate).toBeGreaterThan(-1)
    expect(androidLookup).toBeGreaterThan(authGate)
    expect(componentSource).not.toMatch(/androidAab|\.aab|AAB/)
  })
})
