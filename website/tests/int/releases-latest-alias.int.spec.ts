import { describe, expect, it } from 'vitest'

import * as alias from '@/app/api/releases/latest/route'

/**
 * /api/releases/latest serves both the native Android manifest and desktop
 * updates. Its desktop half used to be a second copy of the resolver that
 * answered 400/404/503 with a JSON body, which Tauri reports to the customer as
 * "update server returned an unexpected json". It also read only the newest
 * release, so the Android-only v0.77.0 made it call every desktop variant
 * broken even though v0.76.1 had complete signed installers.
 */
describe('legacy updater path', () => {
  it('never answers a desktop updater request with a JSON error body', async () => {
    for (const query of [
      '', // no variant at all — the old copy replied 400 {error}
      '?variant=not-a-variant',
      '?variant=hardware',
    ]) {
      const res = await alias.GET(new Request(`https://omnix.co.ke/api/releases/latest${query}`))
      if (res.status === 200) {
        expect(await res.clone().json(), query).toHaveProperty('version')
      } else {
        expect(res.status, query).toBe(204)
        expect(res.headers.get('X-Omnix-Updater-Status'), query).toBeTruthy()
        expect(await res.text(), query).toBe('')
      }
    }
  })

  it('rejects a malformed Android version code without pretending there is an update', async () => {
    const res = await alias.GET(
      new Request('https://omnix.co.ke/api/releases/latest?platform=android&versionCode=-5'),
    )
    expect(res.status).toBe(400)
  })
})
