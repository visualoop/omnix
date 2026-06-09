import { randomBytes } from 'crypto'
import type { Endpoint } from 'payload'
import { errorResponse, hashToken, jsonResponse, logActivation, readJson } from './_auth'

type LicenseDoc = {
  id: string | number
  status: string
  variant?: string
  modules?: string[]
  maxMachines?: number
  maxBranches?: number
  maintenanceUntil?: string
  trialEndsAt?: string
  majorVersionCap?: number
}

/** Canonical entitlement payload returned to the desktop app on activate/validate. */
export function entitlementsOf(license: LicenseDoc) {
  return {
    modules: license.modules ?? [],
    variant: license.variant ?? 'pro',
    maxDevices: license.maxMachines ?? 1,
    maxBranches: license.maxBranches ?? 1,
    maintenanceUntil: license.maintenanceUntil ?? null,
    trialEndsAt: license.trialEndsAt ?? null,
    majorVersionCap: license.majorVersionCap ?? 1,
    status: license.status,
  }
}

/**
 * POST /api/licensing/activate
 *
 * One-time online activation. Validates the licence, enforces the seat cap,
 * registers the machine, and returns a machine-bound token + canonical
 * entitlements (modules, seats, maintenance) so the desktop can gate offline.
 *
 * Body: { licenseKey, machineId, hostname, os, osVersion, arch, currentVersion }
 * Response: { ok, authToken, action, entitlements }
 */
export const licensesActivateEndpoint: Endpoint = {
  path: '/licensing/activate',
  method: 'post',
  handler: async (req) => {
    const body = await readJson<{
      licenseKey?: string
      machineId?: string
      hostname?: string
      os?: 'windows' | 'linux' | 'macos'
      osVersion?: string
      arch?: 'x86_64' | 'aarch64'
      currentVersion?: string
      variant?: 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'
    }>(req)

    if (!body || !body.licenseKey || !body.machineId) {
      return errorResponse('Missing licenseKey or machineId', 400)
    }

    const licRes = await req.payload.find({
      collection: 'licenses',
      where: { licenseKey: { equals: body.licenseKey } },
      limit: 1,
      depth: 0,
    })
    const license = licRes.docs[0] as unknown as LicenseDoc | undefined
    if (!license) {
      await logActivation(req, {
        event: 'activate',
        outcome: 'rejected_invalid',
        machineId: body.machineId,
        detail: 'Licence key not recognised',
      })
      return errorResponse('Licence key not recognised', 404)
    }

    // Variant gate: a Pro licence accepts any binary; a trade licence only
    // accepts its matching binary. v0.3.x clients omit `variant` — they
    // become Pro (legacy). Reject mismatch with a friendly message.
    const binaryVariant = body.variant ?? 'pro'
    const licenseVariant = license.variant ?? 'pro'
    if (licenseVariant !== 'pro' && licenseVariant !== binaryVariant) {
      await logActivation(req, {
        event: 'activate',
        outcome: 'rejected_invalid',
        license: license.id,
        machineId: body.machineId,
        detail: `Variant mismatch: licence=${licenseVariant}, binary=${binaryVariant}`,
      })
      return errorResponse(
        `This is an Omnix ${licenseVariant.charAt(0).toUpperCase() + licenseVariant.slice(1)} licence. ` +
          `You're running Omnix ${binaryVariant.charAt(0).toUpperCase() + binaryVariant.slice(1)}. ` +
          `Install the matching variant from omnix.co.ke/${licenseVariant}, or upgrade to Pro.`,
        403,
      )
    }

    if (license.status === 'suspended' || license.status === 'cancelled') {
      await logActivation(req, {
        event: 'activate',
        outcome: 'rejected_revoked',
        license: license.id,
        machineId: body.machineId,
        detail: `Licence ${license.status}`,
      })
      return errorResponse('Licence is suspended', 403)
    }

    // Existing registration → idempotent re-activation (token rotates).
    const existingRes = await req.payload.find({
      collection: 'machines',
      where: { machineId: { equals: body.machineId } },
      limit: 1,
      depth: 0,
    })
    const existing = existingRes.docs[0] as unknown as
      | undefined
      | { id: string | number }

    if (existing) {
      const token = randomBytes(32).toString('hex')
      await req.payload.update({
        collection: 'machines',
        id: existing.id,
        data: {
          authToken: hashToken(token),
          license: license.id as never,
          status: 'active',
          deactivatedAt: undefined,
          lastSeenAt: new Date().toISOString(),
          currentVersion: body.currentVersion,
        },
        overrideAccess: true,
      })
      await logActivation(req, {
        event: 'activate',
        outcome: 'success',
        license: license.id,
        machine: existing.id,
        machineId: body.machineId,
        detail: 'reactivated',
      })
      return jsonResponse({
        ok: true,
        authToken: token,
        action: 'reactivated',
        entitlements: entitlementsOf(license),
      })
    }

    // Seat cap.
    const countRes = await req.payload.count({
      collection: 'machines',
      where: {
        and: [
          { license: { equals: license.id } },
          { status: { not_equals: 'deactivated' } },
        ],
      },
    })
    const cap = license.maxMachines ?? 1
    if (countRes.totalDocs >= cap) {
      await logActivation(req, {
        event: 'activate',
        outcome: 'rejected_seats',
        license: license.id,
        machineId: body.machineId,
        detail: `At seat cap (${cap})`,
      })
      return errorResponse(
        `Seat limit reached (${cap} of ${cap} used). Deactivate an existing machine from your dashboard or buy an extra seat.`,
        409,
      )
    }

    // Register new machine.
    const token = randomBytes(32).toString('hex')
    const created = await req.payload.create({
      collection: 'machines',
      data: {
        machineId: body.machineId,
        authToken: hashToken(token),
        license: license.id as never,
        hostname: body.hostname,
        os: (body.os as never) ?? 'windows',
        osVersion: body.osVersion,
        arch: (body.arch as never) ?? 'x86_64',
        currentVersion: body.currentVersion,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'active',
      },
      overrideAccess: true,
    })

    await logActivation(req, {
      event: 'activate',
      outcome: 'success',
      license: license.id,
      machine: (created as { id: string | number }).id,
      machineId: body.machineId,
      detail: 'registered',
    })

    return jsonResponse({
      ok: true,
      authToken: token,
      action: 'registered',
      entitlements: entitlementsOf(license),
    })
  },
}
