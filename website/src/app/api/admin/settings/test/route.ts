import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email'
import { paystackKeys, getSetting } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { ok: false as const, status: 401 }
  if (session.user.role !== 'platform_admin') return { ok: false as const, status: 403 }
  return { ok: true as const, session }
}

/**
 * Run a connectivity test against an integration the admin just configured.
 *   POST { type: 'email', email: 'me@example.com' }
 *   POST { type: 'paystack' }
 *   POST { type: 'oauth' }
 *   POST { type: 's3' }
 */
export async function POST(req: Request) {
  const a = await requireAdmin()
  if (!a.ok) return Response.json({ error: a.status === 401 ? 'unauthenticated' : 'forbidden' }, { status: a.status })

  const body = (await req.json().catch(() => null)) as { type?: string; email?: string } | null
  if (!body?.type) return Response.json({ error: 'type required' }, { status: 400 })

  switch (body.type) {
    case 'email': {
      const to = body.email?.trim() || a.session.user.email
      const r = await sendTestEmail(to)
      return Response.json({ ok: r.ok, error: r.error, sentTo: to })
    }
    case 'paystack': {
      const keys = await paystackKeys()
      if (!keys.secret) return Response.json({ ok: false, error: 'paystack.secret_key not set' })
      try {
        // Hit /transaction/totals — cheap auth-required endpoint.
        const res = await fetch('https://api.paystack.co/transaction/totals', {
          headers: { Authorization: `Bearer ${keys.secret}`, Accept: 'application/json' },
        })
        const json = (await res.json()) as { status?: boolean; message?: string }
        return Response.json({
          ok: res.ok && json.status === true,
          status: res.status,
          message: json.message,
          publicKeyPreview: keys.public ? keys.public.slice(0, 12) + '…' : null,
          webhookSet: Boolean(keys.webhook),
        })
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    case 'oauth': {
      const id = await getSetting('google.client_id')
      const sec = await getSetting('google.client_secret')
      return Response.json({
        ok: Boolean(id && sec),
        clientIdSet: Boolean(id),
        clientSecretSet: Boolean(sec),
        callbackUrl: `${process.env.BETTER_AUTH_URL ?? 'https://omnix.co.ke'}/api/auth/callback/google`,
        note: id && sec ? 'Open /login and click "Continue with Google" to verify the round-trip.' : 'Set the client ID + secret first.',
      })
    }
    case 's3': {
      const [endpoint, ak, sk, bucket] = await Promise.all([
        getSetting('s3.endpoint'),
        getSetting('s3.access_key_id'),
        getSetting('s3.secret_access_key'),
        getSetting('s3.bucket'),
      ])
      if (!endpoint || !ak || !sk) {
        return Response.json({ ok: false, error: 'endpoint / access_key_id / secret_access_key not all set' })
      }
      try {
        const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
          region: 'auto',
          endpoint,
          credentials: { accessKeyId: ak, secretAccessKey: sk },
          forcePathStyle: true,
        })
        const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket ?? 'omnix-backups', MaxKeys: 1 }))
        return Response.json({ ok: true, bucket: bucket ?? 'omnix-backups', objectCount: out.KeyCount ?? 0 })
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    default:
      return Response.json({ error: `unknown type: ${body.type}` }, { status: 400 })
  }
}
