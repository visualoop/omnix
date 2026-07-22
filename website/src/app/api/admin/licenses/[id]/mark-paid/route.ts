/**
 * POST /api/admin/licenses/[id]/mark-paid
 *
 * A platform admin records a payment taken OUTSIDE Paystack — a customer paid
 * an M-Pesa Paybill/Till directly, or paid cash. It creates a `payments` row
 * that downstream reporting (revenue, VAT, licence.status) treats identically
 * to a settled Paystack charge, and applies the SAME purpose-specific licence
 * entitlement the Paystack webhook applies.
 *
 * Hardening (parity with the webhook's settlement contract):
 *   - platform_admin only (session role), 401/403 like every /api/admin route.
 *   - `purpose` + `currency` are strict allowlists; the recorded `amount` is
 *     the server-authoritative price derived from src/config/pricing.ts for
 *     that purpose/currency. A client-supplied amount is only accepted if it
 *     matches exactly — never trusted as the source of truth.
 *   - An optional external reference (the M-Pesa code) is normalised and
 *     validated, then folded into a DETERMINISTIC `paystack_reference`
 *     (`manual:<CODE>`). Because that column is UNIQUE, re-recording the same
 *     code is caught as a conflict and returned as 409 — no duplicate row.
 *     With no external reference we mint a random opaque one instead.
 *   - The payment insert, the licence entitlement mutation, and the audit row
 *     all happen inside ONE `withDbTransaction`, with the licence row locked
 *     `FOR UPDATE`. A payment `success` can therefore never commit unless its
 *     entitlement and audit committed too; any failure rolls the whole thing
 *     back. The unique conflict is caught safely.
 *   - The response never returns the licence key or any secret.
 *
 * Body: {
 *   currency?: SupportedCurrency,          // defaults to the licence currency, else KES
 *   purpose?: <allowlisted purpose>,       // defaults to license_fee
 *   amount?: number,                       // optional; must equal the authoritative price
 *   reference?: string,                    // M-Pesa code the admin captured
 *   note?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db, withDbTransaction, type DbTx, licenses, payments, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'
import { pricing, type SupportedCurrency } from '@/config/pricing'
import { isValidPaystackReference } from '@/lib/checkout-status'

export const runtime = 'nodejs'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = ['KES', 'USD', 'NGN', 'GHS', 'ZAR']

type Purpose =
  | 'license_fee'
  | 'maintenance_renewal'
  | 'major_upgrade'
  | 'cloud_backup'
  | 'extra_branch'
  | 'extra_machine'

const PURPOSES: readonly Purpose[] = [
  'license_fee',
  'maintenance_renewal',
  'major_upgrade',
  'cloud_backup',
  'extra_branch',
  'extra_machine',
]

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

interface Body {
  amount?: number
  currency?: string
  purpose?: string
  reference?: string
  note?: string
}

/**
 * The single authoritative price (major units) for a purpose/currency, read
 * straight from the pricing config. Mirrors the checkout `computeAmount`
 * starter path — a manual record is always the starter-tier entitlement, the
 * same tier the webhook writes on settlement.
 */
function authoritativeAmount(purpose: Purpose, currency: SupportedCurrency): number {
  switch (purpose) {
    case 'license_fee':
      return pricing.starter.oneTimeFee[currency]
    case 'maintenance_renewal':
      return pricing.starter.maintenanceYearly[currency]
    case 'major_upgrade':
      return Math.round(pricing.starter.oneTimeFee[currency] * (1 - pricing.majorUpgradeDiscount / 100))
    case 'cloud_backup':
      return pricing.cloudBackupMonthly[currency]
    case 'extra_branch':
      return pricing.extraBranchOneTime[currency]
    case 'extra_machine':
      return pricing.extraMachineOneTime[currency]
  }
}

/** True for a Postgres unique-violation (23505) surfaced through the driver. */
function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; cause?: { code?: string }; message?: string }
  if (err.code === '23505') return true
  if (err.cause && err.cause.code === '23505') return true
  return typeof err.message === 'string' && /duplicate key value|unique constraint/i.test(err.message)
}

type LicenseRow = typeof licenses.$inferSelect

/**
 * Apply the purpose-specific entitlement inside the settlement transaction —
 * identical semantics to the Paystack webhook's applyLicenseMutation.
 */
async function applyLicenseEntitlement(
  tx: DbTx,
  lic: LicenseRow,
  purpose: Purpose,
  amount: number,
  currency: SupportedCurrency,
  now: Date,
): Promise<LicenseRow | null> {
  if (purpose === 'license_fee') {
    const [r] = await tx
      .update(licenses)
      .set({
        status: 'active',
        tier: 'starter',
        paidAt: now,
        maintenanceUntil: new Date(now.getTime() + YEAR_MS),
        priceFeePaid: amount,
        currency,
        updatedAt: now,
      })
      .where(eq(licenses.id, lic.id))
      .returning()
    return r ?? null
  }
  if (purpose === 'maintenance_renewal') {
    const base = lic.maintenanceUntil && lic.maintenanceUntil > now ? lic.maintenanceUntil : now
    const [r] = await tx
      .update(licenses)
      .set({ maintenanceUntil: new Date(base.getTime() + YEAR_MS), updatedAt: now })
      .where(eq(licenses.id, lic.id))
      .returning()
    return r ?? null
  }
  if (purpose === 'cloud_backup') {
    const base = lic.cloudBackupExpiresAt && lic.cloudBackupExpiresAt > now ? lic.cloudBackupExpiresAt : now
    const [r] = await tx
      .update(licenses)
      .set({ cloudBackupEnabled: true, cloudBackupExpiresAt: new Date(base.getTime() + MONTH_MS), updatedAt: now })
      .where(eq(licenses.id, lic.id))
      .returning()
    return r ?? null
  }
  if (purpose === 'major_upgrade') {
    const [r] = await tx
      .update(licenses)
      .set({ majorVersionCap: 2, updatedAt: now })
      .where(eq(licenses.id, lic.id))
      .returning()
    return r ?? null
  }
  if (purpose === 'extra_branch') {
    const [r] = await tx
      .update(licenses)
      .set({ maxBranches: lic.maxBranches + 1, updatedAt: now })
      .where(eq(licenses.id, lic.id))
      .returning()
    return r ?? null
  }
  // extra_machine
  const [r] = await tx
    .update(licenses)
    .set({ maxMachines: lic.maxMachines + 1, updatedAt: now })
    .where(eq(licenses.id, lic.id))
    .returning()
  return r ?? null
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const session = a.session!

  const { id: licenseId } = await ctx.params
  const body = (await req.json().catch(() => null)) as Body | null

  // ── Purpose allowlist ───────────────────────────────────────────
  const purpose = (body?.purpose ?? 'license_fee') as Purpose
  if (!PURPOSES.includes(purpose)) {
    return Response.json({ error: 'unsupported purpose' }, { status: 400 })
  }

  // Pre-read the licence for a clean 404 + to resolve its default currency.
  const [lic] = await db.select().from(licenses).where(eq(licenses.id, licenseId)).limit(1)
  if (!lic) {
    return Response.json({ error: 'Licence not found' }, { status: 404 })
  }

  // ── Currency allowlist ──────────────────────────────────────────
  const currency = (body?.currency ?? lic.currency ?? 'KES') as SupportedCurrency
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return Response.json({ error: 'unsupported currency' }, { status: 400 })
  }

  // ── Server-authoritative amount ─────────────────────────────────
  const amount = authoritativeAmount(purpose, currency)
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'no authoritative price for this purpose/currency' }, { status: 400 })
  }
  // A client-supplied amount is only ever a cross-check — reject a mismatch.
  if (body?.amount !== undefined && body?.amount !== null) {
    const clientAmount = Number(body.amount)
    if (!Number.isFinite(clientAmount) || Math.round(clientAmount) !== Math.round(amount)) {
      return Response.json(
        { error: 'amount does not match the authoritative price for this purpose/currency' },
        { status: 400 },
      )
    }
  }

  // ── Optional external reference → deterministic unique reference ─
  const rawRef = typeof body?.reference === 'string' ? body.reference.trim().toUpperCase() : ''
  const externalRef = rawRef.length > 0 ? rawRef : null
  if (externalRef && !isValidPaystackReference(externalRef)) {
    return Response.json({ error: 'invalid reference' }, { status: 400 })
  }
  // Deterministic for a supplied code (repeat → UNIQUE conflict → 409); random
  // opaque reference when the admin captured no external code.
  const paystackReference = externalRef
    ? `manual:${externalRef}`
    : `manual:${crypto.randomBytes(12).toString('hex')}`

  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null
  const paymentId = createId()
  const now = new Date()

  // ── Atomic settlement ───────────────────────────────────────────
  // Lock the licence FOR UPDATE, insert the success payment, apply the
  // purpose-specific entitlement, and write the audit row — all or nothing.
  let result: { ok: true; license: LicenseRow } | { ok: false; reason: 'not_found' }
  try {
    result = await withDbTransaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(licenses)
        .where(eq(licenses.id, licenseId))
        .for('update')
        .limit(1)
      if (!locked) return { ok: false as const, reason: 'not_found' as const }

      await tx.insert(payments).values({
        id: paymentId,
        userId: locked.userId,
        organizationId: locked.organizationId,
        licenseId: locked.id,
        paystackReference,
        purpose,
        amount,
        currency,
        status: 'success',
        paidAt: now,
        metadata: {
          source: 'admin_manual',
          adminActorId: session.user.id,
          reference: externalRef,
          note,
        },
      })

      const updated = await applyLicenseEntitlement(tx, locked, purpose, amount, currency, now)

      await tx.insert(auditLog).values({
        id: createId(),
        actorId: session.user.id,
        action: 'payment.manual_record',
        resource: `payment:${paymentId}`,
        metadata: {
          licenseId: locked.id,
          variant: locked.variant,
          amount,
          currency,
          purpose,
          reference: externalRef,
          note,
        },
      })

      return { ok: true as const, license: updated ?? locked }
    })
  } catch (e) {
    // A repeat of the same external reference collides on the UNIQUE column.
    if (isUniqueViolation(e)) {
      return Response.json({ error: 'This reference has already been recorded' }, { status: 409 })
    }
    // Any other failure rolled the whole transaction back — no half-settled
    // payment. Do not leak internal detail.
    console.error('[mark-paid] manual payment settlement failed')
    return Response.json({ error: 'Could not record payment' }, { status: 500 })
  }

  if (!result.ok) {
    return Response.json({ error: 'Licence not found' }, { status: 404 })
  }

  const finalLic = result.license
  return Response.json({
    ok: true,
    payment: { id: paymentId, amount, currency, purpose, reference: externalRef, status: 'success' },
    license: { id: finalLic.id, status: finalLic.status, tier: finalLic.tier },
  })
}
