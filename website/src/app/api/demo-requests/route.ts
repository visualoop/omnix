import { NextResponse, type NextRequest } from 'next/server'
import { DemoRequestBody } from '@/lib/demo-request-schema'
import { db, demoRequests } from '@/db'
import { sendDemoRequest } from '@/lib/email'
import { createId } from '@/lib/ids'

const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX = 5
const buckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string): boolean {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (current.count >= RATE_MAX) return false
  current.count += 1
  return true
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ ok: false, error: 'unsupported_media_type' }, { status: 415 })
  }

  const clientKey = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  if (!rateLimit(clientKey)) {
    return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const result = DemoRequestBody.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', fields: result.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const parsed = result.data
  if (parsed.website?.trim()) {
    return NextResponse.json({ ok: true, reference: 'received' })
  }

  const id = createId()
  const reference = `DM-${id.slice(0, 8).toUpperCase()}`

  try {
    await db.insert(demoRequests).values({
      id,
      status: 'new',
      fullName: parsed.fullName,
      workEmail: parsed.workEmail.toLowerCase(),
      phone: parsed.phone,
      businessName: parsed.businessName,
      product: parsed.product,
      locationCount: parsed.locationCount,
      currentSystem: parsed.currentSystem || null,
      priorities: parsed.priorities,
      notes: parsed.notes || null,
      preferredChannel: parsed.preferredChannel,
      preferredWindow: parsed.preferredWindow,
      locale: parsed.locale,
      sourcePath: parsed.sourcePath,
      referrer: parsed.referrer || null,
      attribution: parsed.attribution,
      marketingOptIn: parsed.marketingOptIn,
    })
  } catch (error) {
    // Log a stable code + the error class only. The raw error can echo bound
    // column values (email, phone, business name), so it is never logged.
    console.error('[demo-requests] persistence failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, error: 'temporarily_unavailable' }, { status: 503 })
  }

  try {
    await sendDemoRequest({
      reference,
      fullName: parsed.fullName,
      businessName: parsed.businessName,
      workEmail: parsed.workEmail.toLowerCase(),
      phone: parsed.phone,
      product: parsed.product,
      locationCount: parsed.locationCount,
      currentSystem: parsed.currentSystem,
      priorities: parsed.priorities,
      notes: parsed.notes,
      preferredChannel: parsed.preferredChannel,
      preferredWindow: parsed.preferredWindow,
    })
  } catch (error) {
    // The request is already durable. Surface delivery trouble to operators
    // without logging the demo reference or the raw error (either may carry
    // PII); the request is still returned to the buyer as a success.
    console.error('[demo-requests] notification failed:', error instanceof Error ? error.name : 'unknown')
  }

  return NextResponse.json({ ok: true, reference }, { status: 201 })
}
