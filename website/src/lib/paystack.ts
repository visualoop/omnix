/**
 * Paystack API client wrapper — single source of truth.
 *
 * Reads paystack.secret_key + paystack.webhook_secret from
 * platform_settings (admin-editable) with env fallback.
 */
import { getSetting } from '@/lib/platform-settings'

const PAYSTACK_BASE = 'https://api.paystack.co'

async function getSecretKey(): Promise<string> {
  const key = await getSetting('paystack.secret_key')
  if (!key) {
    throw new Error('paystack.secret_key is not configured (set in /admin/settings or PAYSTACK_SECRET_KEY env)')
  }
  return key
}

async function authHeaders(): Promise<HeadersInit> {
  const key = await getSecretKey()
  return {
    Authorization: `Bearer ${key}`,
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
    { method: 'GET', headers: await authHeaders() },
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
    headers: await authHeaders(),
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
