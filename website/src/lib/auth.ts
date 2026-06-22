/**
 * Better Auth instance — passwordless web auth.
 *
 * NO email + password sign-in: the website never asks for a password.
 * Daily auth on the desktop app uses local Argon2 hashes; the website
 * is a magic-link / Google sign-in surface for owners + platform staff.
 *
 * Plugins, in order (nextCookies MUST be last):
 *   magicLink · organization · admin · nextCookies
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

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-in-prod-32chars-min',

  // ── Email + password DISABLED ─────────────────────────────────
  // No password sign-in on the website. Sign in via Google or magic
  // link. Daily auth lives on the desktop app.
  emailAndPassword: { enabled: false },

  // ── Google OAuth ──────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
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
