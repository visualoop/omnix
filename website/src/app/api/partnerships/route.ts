/**
 * POST /api/partnerships
 *
 * Public endpoint that receives partnership / reseller enquiries submitted
 * from the /partners page. Validates the payload with Zod, then hands off
 * to sendPartnershipInquiry which sends both an internal notification and
 * an acknowledgement to the submitter via Resend.
 *
 * Rate-limited per IP to keep the form from being abused as a spam relay.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sendPartnershipInquiry } from '@/lib/email';

const Body = z.object({
  fullName: z.string().min(2).max(120).trim(),
  organization: z.string().min(2).max(160).trim(),
  email: z.string().email().max(160).trim(),
  phone: z.string().min(6).max(40).trim(),
  country: z.string().min(2).max(80).trim(),
  interest: z.enum(['reseller', 'referral', 'oem', 'integration', 'other']),
  message: z.string().min(20).max(4000).trim(),
  // Honeypot — if any bot fills this, we silently 200 without sending.
  website: z.string().optional(),
});

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;
const bucket = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || entry.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'too_many_requests' },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    const raw = await req.json();
    parsed = Body.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', detail: (e as Error).message },
      { status: 400 },
    );
  }

  // Honeypot — silent success on bot fill.
  if (parsed.website && parsed.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await sendPartnershipInquiry({
      fullName: parsed.fullName,
      organization: parsed.organization,
      email: parsed.email,
      phone: parsed.phone,
      country: parsed.country,
      interest: parsed.interest,
      message: parsed.message,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[partnerships]', e);
    return NextResponse.json(
      { ok: false, error: 'send_failed' },
      { status: 500 },
    );
  }
}
