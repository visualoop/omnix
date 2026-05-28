import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * LandingPage — fully editable hero + sections of the homepage.
 *
 * Component code reads from this global so the owner can rewrite copy,
 * swap screenshots, edit testimonials, etc., without redeploying.
 */
export const LandingPage: GlobalConfig = {
  slug: 'landing-page',
  admin: {
    description: 'The /  landing page. Hero, modules teaser, feature spotlights, testimonials, closing CTA.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    // ── Hero ────────────────────────────────────────────────────
    {
      name: 'hero',
      type: 'group',
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: 'NEW · v0.2.0 — Banking & Recurring Invoices',
          admin: { description: 'Pill above the headline. Often links to /changelog.' },
        },
        {
          name: 'headline',
          type: 'text',
          required: true,
          defaultValue: 'Run your duka. Pay yourself.',
        },
        {
          name: 'subheadline',
          type: 'textarea',
          defaultValue:
            'All-in-one ERP for Kenyan pharmacies, mini-marts, salons, and shops. Works offline. Costs less than your rent. No subscription forever.',
        },
        { name: 'primaryCtaLabel', type: 'text', defaultValue: 'Download free trial' },
        { name: 'primaryCtaHref', type: 'text', defaultValue: '/downloads' },
        { name: 'secondaryCtaLabel', type: 'text', defaultValue: 'See it in action' },
        { name: 'secondaryCtaHref', type: 'text', defaultValue: '/modules' },
        {
          name: 'screenshotPosition',
          type: 'select',
          defaultValue: 'below',
          options: [
            { label: 'Below text', value: 'below' },
            { label: 'Right of text', value: 'right' },
            { label: 'Bento grid', value: 'bento' },
          ],
        },
        { name: 'screenshot', type: 'upload', relationTo: 'media' },
      ],
    },

    // ── Logo cloud ─────────────────────────────────────────────
    {
      name: 'logoCloud',
      type: 'array',
      labels: { singular: 'Logo', plural: 'Logos' },
      admin: { description: 'Customer logos. Leave empty until we have real customers — then the section auto-hides.' },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'logo', type: 'upload', relationTo: 'media' },
      ],
    },

    // ── Modules section header ─────────────────────────────────
    {
      name: 'modulesSection',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text', defaultValue: 'Built for your trade' },
        { name: 'headline', type: 'text', defaultValue: 'One installer. Every kind of business.' },
        {
          name: 'description',
          type: 'textarea',
          defaultValue:
            'Pick the module that fits your trade. Every Duka licence includes Core ERP plus the modules you choose.',
        },
      ],
    },

    // ── Feature bento ──────────────────────────────────────────
    {
      name: 'featuresBento',
      type: 'array',
      labels: { singular: 'Bento card', plural: 'Bento cards' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image', type: 'upload', relationTo: 'media' },
        {
          name: 'span',
          type: 'select',
          defaultValue: '1',
          options: [
            { label: '1 column', value: '1' },
            { label: '2 columns', value: '2' },
            { label: '3 columns', value: '3' },
          ],
        },
      ],
    },

    // ── Testimonials ───────────────────────────────────────────
    {
      name: 'testimonials',
      type: 'array',
      fields: [
        { name: 'quote', type: 'textarea' },
        { name: 'name', type: 'text' },
        { name: 'role', type: 'text' },
        { name: 'businessName', type: 'text' },
        { name: 'photo', type: 'upload', relationTo: 'media' },
      ],
    },

    // ── Closing CTA ────────────────────────────────────────────
    {
      name: 'closingCta',
      type: 'group',
      fields: [
        {
          name: 'headline',
          type: 'text',
          defaultValue: 'Stop juggling spreadsheets.',
        },
        {
          name: 'subheadline',
          type: 'text',
          defaultValue: 'Run your duka properly.',
        },
      ],
    },
  ],
}
