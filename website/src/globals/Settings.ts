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
          defaultValue: false,
          admin: { description: 'When on, CI-created releases skip "draft" and publish immediately.' },
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
  ],
}
