/**
 * Paystack API client wrapper — single source of truth.
 *
 * Reads PAYSTACK_SECRET_KEY from env directly (was Payload-CMS-resolved
 * pre-v0.8.x). Provides verify() + newReference() helpers consumed by
 * the /api/paystack/* route handlers.
 */

const PAYSTACK_BASE = 'https://api.paystack.co'

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not set')
  }
  return key
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** Verify a transaction by reference. Defense-in-depth on webhook + polling. */
export async function verify(reference: string): Promise<{
  status: 'success' | 'failed' | 'pending'
  amountSmallestUnit: number
  currency: string
  raw: Record<string, unknown>
}> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET', headers: authHeaders() },
  )
  const json = (await res.json()) as { status?: boolean; data?: Record<string, unknown> }
  if (!res.ok || !json.status) {
    throw new Error(`Paystack /transaction/verify failed: ${res.status}`)
  }
  const data = json.data ?? {}
  const pStatus = data.status as string
  return {
    status:
      pStatus === 'success'
        ? 'success'
        : pStatus === 'failed' || pStatus === 'abandoned' || pStatus === 'reversed'
          ? 'failed'
          : 'pending',
    amountSmallestUnit: (data.amount as number) ?? 0,
    currency: (data.currency as string) ?? 'KES',
    raw: data,
  }
}

/** Generate an opaque reference for a new init call. */
export function newReference(prefix = 'OMNIX'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

/** Initialise a transaction (Paystack Inline opens the popup with this). */
export async function initTransaction(input: {
  email: string
  amountSmallestUnit: number
  currency: string
  reference: string
  metadata?: Record<string, unknown>
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: input.amountSmallestUnit,
      currency: input.currency,
      reference: input.reference,
      metadata: input.metadata,
    }),
  })
  const json = (await res.json()) as {
    status?: boolean
    data?: { authorization_url: string; access_code: string; reference: string }
  }
  if (!res.ok || !json.status || !json.data) {
    throw new Error(`Paystack /transaction/initialize failed: ${res.status}`)
  }
  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  }
}
