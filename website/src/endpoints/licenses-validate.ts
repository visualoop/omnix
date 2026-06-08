import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'

/**
 * POST /api/licenses/validate
 *
 * Called by the Tauri desktop app on every startup AND once per hour while
 * running. Returns the current state of the licence + lockout instructions
 * for the local app.
 *
 * Body: { licenseKey, machineId, currentVersion, variant }
 *   - `variant` is the binary's variant (pro|dawa|retail|hospitality|hardware).
 *     Required from v0.4.0+ desktop builds. Older clients omit it; we treat
 *     a missing variant as 'pro' for backward compat.
 *
 * Response:
 *   { status, lockoutMode, modules, maxBranches, maxMachines,
 *     trialEndsAt, maintenanceUntil, majorVersionCap, latestVersion,
 *     mustUpgrade, requestDiagnostic, variant, variantMismatch }
 */
export const licensesValidateEndpoint: Endpoint = {
  path: '/licenses/validate',
  method: 'post',
  handler: async (req) => {
    const body = await readJson<{
      licenseKey?: string
      machineId?: string
      currentVersion?: string
      variant?: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
    }>(req)
    if (!body || !body.licenseKey) {
      return errorResponse('Missing licenseKey', 400)
    }

    const licRes = await req.payload.find({
      collection: 'licenses',
      where: { licenseKey: { equals: body.licenseKey } },
      limit: 1,
      depth: 0,
    })
    const license = licRes.docs[0] as unknown as
      | undefined
      | {
          id: string | number
          status: string
          variant?: string
          modules?: string[]
          maxBranches?: number
          maxMachines?: number
          trialEndsAt?: string
          maintenanceUntil?: string
          majorVersionCap?: number
        }

    if (!license) {
      return jsonResponse({
        status: 'invalid',
        lockoutMode: 'hard',
        message: 'Licence key not recognised',
      })
    }

    // Variant gate: a Pro licence accepts any binary; a trade licence only
    // accepts its matching binary. v0.3.x clients omit `variant` — they are
    // assumed to be Pro (legacy). Reject mismatch with a friendly hint that
    // tells the operator which binary to download.
    const binaryVariant = body.variant ?? 'pro'
    const licenseVariant = license.variant ?? 'pro'
    if (licenseVariant !== 'pro' && licenseVariant !== binaryVariant) {
      return jsonResponse({
        status: 'invalid',
        lockoutMode: 'hard',
        variant: licenseVariant,
        binaryVariant,
        variantMismatch: true,
        message:
          `This is an Omnix ${licenseVariant.charAt(0).toUpperCase() + licenseVariant.slice(1)} ` +
          `licence — install Omnix ${licenseVariant.charAt(0).toUpperCase() + licenseVariant.slice(1)} ` +
          `from omnix.co.ke/${licenseVariant}, or upgrade to Omnix Pro to use multiple trades.`,
      })
    }

    // Latest published release
    const settings = (await req.payload.findGlobal({ slug: 'settings' })) as unknown as {
      trialLockoutMode?: 'soft' | 'readonly' | 'hard'
    }
    const lockoutMode =
      license.status === 'trial' || license.status === 'active'
        ? 'none'
        : settings?.trialLockoutMode ?? 'soft'

    const latestRes = await req.payload.find({
      collection: 'releases',
      where: {
        and: [
          { status: { equals: 'published' } },
          { channel: { equals: 'stable' } },
          { majorVersion: { less_than_equal: license.majorVersionCap ?? 1 } },
        ],
      },
      sort: '-publishedAt',
      limit: 1,
    })
    const latestVersion = (latestRes.docs[0] as unknown as { version?: string } | undefined)?.version

    // Update lastSeenAt on the machine if we know it
    if (body.machineId) {
      const machineRes = await req.payload.find({
        collection: 'machines',
        where: { machineId: { equals: body.machineId } },
        limit: 1,
        depth: 0,
      })
      const machine = machineRes.docs[0] as unknown as
        | undefined
        | { id: string | number; requestDiagnostic?: boolean }
      if (machine) {
        await req.payload.update({
          collection: 'machines',
          id: machine.id,
          data: {
            lastSeenAt: new Date().toISOString(),
            currentVersion: body.currentVersion,
            status: 'active',
          },
          overrideAccess: true,
        })
      }
    }

    return jsonResponse({
      status: license.status,
      lockoutMode,
      variant: licenseVariant,
      modules: license.modules ?? [],
      maxBranches: license.maxBranches ?? 1,
      maxMachines: license.maxMachines ?? 3,
      trialEndsAt: license.trialEndsAt ?? null,
      maintenanceUntil: license.maintenanceUntil ?? null,
      majorVersionCap: license.majorVersionCap ?? 1,
      latestVersion,
      mustUpgrade: false,
      checkedAt: new Date().toISOString(),
    })
  },
}
