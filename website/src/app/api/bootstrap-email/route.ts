import { auth } from '@/lib/auth'
import { sendTestEmail, sendMagicLinkEmail } from '@/lib/email'
import { resendConfig } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

/**
 * Diagnostic + manual magic-link trigger, gated by Bearer BOOTSTRAP_TOKEN.
 *
 *   POST { type: 'env-check' }
 *     Returns whether resend.api_key is reachable and from which source.
 *
 *   POST { type: 'send-test', email: 'me@example.com' }
 *     Sends a diagnostic email via the configured Resend account.
 *
 *   POST { type: 'send-magic-link', email: 'me@example.com' }
 *     Calls Better Auth's signInMagicLink directly. Bypasses the form
 *     so we can verify the full flow from CLI.
 *
 *   POST { type: 'render-template', template: 'magic-link' }
 *     Returns the rendered HTML for previewing without sending.
 */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token !== process.env.BOOTSTRAP_TOKEN) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    type?: string
    email?: string
    template?: string
  } | null
  if (!body?.type) return Response.json({ error: 'type required' }, { status: 400 })

  switch (body.type) {
    case 'env-check': {
      const cfg = await resendConfig()
      return Response.json({
        ok: Boolean(cfg.apiKey),
        apiKeySet: Boolean(cfg.apiKey),
        apiKeyPreview: cfg.apiKey ? `${cfg.apiKey.slice(0, 7)}...${cfg.apiKey.slice(-4)}` : null,
        from: cfg.from,
        replyTo: cfg.replyTo,
        envValues: {
          RESEND_API_KEY: process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.slice(0, 7)}...` : null,
          RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? null,
          RESEND_REPLY_TO: process.env.RESEND_REPLY_TO ?? null,
          BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? null,
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
        },
      })
    }
    case 'send-test': {
      const to = body.email?.trim()
      if (!to) return Response.json({ error: 'email required' }, { status: 400 })
      const r = await sendTestEmail(to)
      return Response.json(r)
    }
    case 'send-magic-link': {
      const email = body.email?.trim()
      if (!email) return Response.json({ error: 'email required' }, { status: 400 })

      // Trigger the Better Auth flow directly — same as POST /api/auth/sign-in/magic-link
      try {
        await auth.api.signInMagicLink({
          body: {
            email,
            callbackURL: '/admin',
          },
          headers: req.headers,
        })
        return Response.json({ ok: true, sent: true, email, callbackURL: '/admin' })
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    case 'render-only': {
      // Smoke-test the template renders without sending.
      try {
        const { render } = await import('@react-email/render')
        const { MagicLinkEmail } = await import('@/emails/templates')
        const { emailBranding } = await import('@/lib/platform-settings')
        const brand = await emailBranding()
        const html = await render(MagicLinkEmail({
          url: 'https://omnix.co.ke/api/auth/magic-link/verify?token=preview',
          brand,
        }))
        return new Response(html, { headers: { 'Content-Type': 'text/html' } })
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    default:
      return Response.json({ error: `unknown type: ${body.type}` }, { status: 400 })
  }
}
