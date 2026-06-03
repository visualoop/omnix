import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'
import { BRAND_NAME, BRAND_TAGLINE } from '../lib/brand'

/**
 * Settings — site-wide configuration.
 *
 * Brand name + tagline are seeded from src/lib/brand.ts so the constant
 * stays the canonical source. Owner can edit other contact details live.
 */
export const Settings: GlobalConfig = {
  slug: 'settings',
  admin: {
    description: 'Site settings, contact channels, social links, feature flags.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    // ── Brand ──────────────────────────────────────────────────
    {
      name: 'brandName',
      type: 'text',
      defaultValue: BRAND_NAME,
      admin: {
        readOnly: true,
        description: 'Read-only — set in code via src/lib/brand.ts.',
      },
    },
    {
      name: 'tagline',
      type: 'text',
      defaultValue: BRAND_TAGLINE,
    },

    // ── Contact ────────────────────────────────────────────────
    { name: 'supportEmail', type: 'email', defaultValue: 'support@omnix.co.ke' },
    { name: 'salesEmail', type: 'email' },
    {
      name: 'whatsappNumber',
      type: 'text',
      admin: { description: 'Full international format, e.g. +254712345678. Used in wa.me links.' },
    },
    { name: 'phoneNumber', type: 'text' },

    {
      name: 'office',
      type: 'group',
      fields: [
        { name: 'address', type: 'textarea' },
        { name: 'mapEmbedUrl', type: 'text' },
        { name: 'workingHours', type: 'text' },
      ],
    },

    // ── Social ─────────────────────────────────────────────────
    {
      name: 'social',
      type: 'group',
      fields: [
        { name: 'twitter', type: 'text' },
        { name: 'linkedin', type: 'text' },
        { name: 'youtube', type: 'text' },
        { name: 'github', type: 'text' },
      ],
    },

    // ── SEO defaults ───────────────────────────────────────────
    { name: 'defaultMetaTitle', type: 'text' },
    { name: 'defaultMetaDescription', type: 'textarea' },
    { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },

    // ── Footer ─────────────────────────────────────────────────
    { name: 'footerCopy', type: 'richText' },
    { name: 'kraPin', type: 'text', admin: { description: 'Shown in footer for trust signal.' } },

    // ── Feature flags ──────────────────────────────────────────
    {
      name: 'flags',
      type: 'group',
      fields: [
        { name: 'allowSelfSignup', type: 'checkbox', defaultValue: true },
        { name: 'allowSelfServeCheckout', type: 'checkbox', defaultValue: true },
        { name: 'showBetaModules', type: 'checkbox', defaultValue: false },
        { name: 'showPricing', type: 'checkbox', defaultValue: true },
        { name: 'maintenanceMode', type: 'checkbox', defaultValue: false },
        {
          name: 'autoPublishReleases',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'When on, CI-created releases skip "draft" and publish immediately. Default ON.' },
        },
      ],
    },

    // ── Trial behaviour ────────────────────────────────────────
    {
      name: 'trialLockoutMode',
      type: 'select',
      defaultValue: 'soft',
      options: [
        { label: 'Soft — POS stops, existing data viewable', value: 'soft' },
        { label: 'Read-only — full app browsable, no new entries', value: 'readonly' },
        { label: 'Hard — splash screen only', value: 'hard' },
      ],
    },

    // ── Integrations (runtime secrets) ─────────────────────────
    // Owner-only read+write on the secret fields. The runtime resolver
    // (src/lib/settings.ts) reads from here first, falls back to env.
    // Keeps secrets in one place that owners can rotate without redeploys.
    {
      name: 'integrations',
      type: 'group',
      admin: {
        description: 'API keys and integration toggles. Secrets here override env vars at runtime.',
      },
      fields: [
        // ── Paystack ────────────────────────────────────────────
        {
          name: 'paystackPublicKey',
          type: 'text',
          admin: { description: 'pk_live_… or pk_test_… — safe to expose to client.' },
        },
        {
          name: 'paystackSecretKey',
          type: 'text',
          admin: {
            description: 'sk_live_… or sk_test_… — server-only. Owner can read, support can\'t.',
          },
          access: {
            // Hide the secret value from non-owners even when reading the global.
            read: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
            update: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
          },
        },
        {
          name: 'paystackWebhookSecret',
          type: 'text',
          admin: {
            description: 'Optional. If set, used for webhook HMAC verify; otherwise paystackSecretKey is used.',
          },
          access: {
            read: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
            update: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
          },
        },

        // ── Email (Resend) ──────────────────────────────────────
        {
          name: 'resendApiKey',
          type: 'text',
          admin: { description: 're_… — for transactional emails (receipts, password resets).' },
          access: {
            read: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
            update: ({ req }) => req.user?.collection === 'users' && req.user?.role === 'owner',
          },
        },
        {
          name: 'resendFromEmail',
          type: 'email',
          admin: { description: 'e.g. "Omnix <noreply@omnix.co.ke>".' },
        },

        // ── Analytics ──────────────────────────────────────────
        {
          name: 'googleAnalyticsId',
          type: 'text',
          admin: { description: 'G-XXXXXXXXXX. Set to inject the GA tag in the public layout.' },
        },

        // ── Cloud backup ──────────────────────────────────────
        {
          name: 'cloudBackupEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Master switch. When off, paid customers see backup as "coming soon".' },
        },
        {
          name: 'cloudBackupPriceMonthly',
          type: 'number',
          defaultValue: 500,
          admin: { description: 'KES per device per month.' },
        },
        {
          name: 'cloudBackupRetentionDays',
          type: 'number',
          defaultValue: 30,
          admin: { description: 'How long to keep backups before pruning. Min 14.' },
        },
      ],
    },
  ],
}
