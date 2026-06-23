/**
 * Better Auth instance — passwordless web auth.
 *
 * NO email + password sign-in: the website never asks for a password.
 * Daily auth on the desktop app uses local Argon2 hashes; the website
 * is a magic-link / Google sign-in surface for owners + platform staff.
 *
 * Plugins, in order (nextCookies MUST be last):
 *   magicLink · organization · admin · nextCookies
 *
 * Config sources (resolved at module init / cold-start):
 *   1. platform_settings DB row    ← admin-editable in /admin/settings
 *   2. process.env (legacy)         ← fallback for Vercel env vars
 *
 * Updates to google.client_id / google.client_secret take effect on the
 * NEXT cold-start (5-15 min on Vercel) — Better Auth doesn't hot-reload
 * provider config. Magic-link templates + Resend credentials hot-reload
 * immediately because those are awaited per request.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink, organization, admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

import { db } from '@/db'
import { ac, owner, admin as orgAdmin, member } from '@/lib/permissions/org'
import {
  platformAc,
  platform_admin,
  support_agent,
  sales_rep,
} from '@/lib/permissions/platform'
import { sendMagicLinkEmail, sendInviteEmail } from '@/lib/email'
import { getSetting } from '@/lib/platform-settings'

// Pre-resolve DB-backed config with a hard timeout so a flaky DB
// at cold-start can't break /api/auth/* entirely.
async function resolveOnce<T>(p: Promise<T>, timeoutMs = 1500): Promise<T | undefined> {
  return Promise.race([
    p.catch(() => undefined as T | undefined),
    new Promise<undefined>((r) => setTimeout(() => r(undefined), timeoutMs)),
  ])
}

const [googleClientIdDb, googleClientSecretDb] = await Promise.all([
  resolveOnce(getSetting('google.client_id')),
  resolveOnce(getSetting('google.client_secret')),
])

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const secret = process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-in-prod-32chars-min'
const googleClientId = googleClientIdDb ?? process.env.GOOGLE_CLIENT_ID ?? ''
const googleClientSecret = googleClientSecretDb ?? process.env.GOOGLE_CLIENT_SECRET ?? ''

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL,
  secret,

  // ── Email + password DISABLED ─────────────────────────────────
  // No password sign-in on the website. Sign in via Google or magic
  // link. Daily auth lives on the desktop app.
  emailAndPassword: { enabled: false },

  // ── Google OAuth ──────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      mapProfileToUser: (profile) => ({
        emailVerified: profile.email_verified ?? false,
        name: profile.name,
        image: profile.picture,
      }),
    },
  },
  account: {
    accountLinking: {
      // Auto-link Google to existing email-only users on first sign-in.
      // Trusted because Google verifies the email.
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  user: {
    additionalFields: {
      phoneNumber:  { type: 'string', required: false, input: true },
      businessName: { type: 'string', required: false, input: true },
      country:      { type: 'string', required: false, defaultValue: 'KE' },
      currency:     { type: 'string', required: false, defaultValue: 'KES' },
      staffTeam:    { type: 'string', required: false },
    },
  },

  plugins: [
    // Magic link — the only email-based sign-in. Pasting an email + clicking
    // the link is the entire sign-in flow.
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ to: email, url })
      },
      expiresIn: 60 * 15, // 15 minutes
    }),

    organization({
      teams: { enabled: true, maximumTeams: 5 },
      sendInvitationEmail: async (data) => {
        const inviteLink =
          `${process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/accept-invitation/${data.id}`
        await sendInviteEmail({
          email: data.email,
          inviteLink,
          inviterName: data.inviter.user.name,
          orgName: data.organization.name,
        })
      },
      requireEmailVerificationOnInvitation: false, // magic-link inherently verifies
      ac,
      roles: { owner, admin: orgAdmin, member },
    }),

    admin({
      adminRoles: ['platform_admin'],
      ac: platformAc,
      roles: { platform_admin, support_agent, sales_rep },
      defaultRole: 'user',
      impersonationSessionDuration: 60 * 60,
    }),

    // MUST be last — auto-forwards Set-Cookie via Next.js cookies()
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
