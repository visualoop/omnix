import type { GlobalConfig, Field } from 'payload'
import { ownerOnly } from '../access'

/**
 * Per-variant landing page copy. One tab per trade variant — Pro, Dawa,
 * Retail, Hospitality, Hardware. Owners edit headlines, who-for bullets,
 * feature cards, compliance bullets, pricing note, CTA URLs without
 * touching code.
 *
 * Hero title is split into prefix + emphasis + suffix so the admin can
 * pick exactly which word renders in italic <em> without having to
 * write JSX.
 */

const variantFields = (variant: string): Field[] => [
  {
    name: 'productName',
    type: 'text',
    required: true,
    admin: { description: `e.g. "Omnix ${variant.charAt(0).toUpperCase() + variant.slice(1)}"` },
  },
  { name: 'tagline', type: 'text', localized: true, admin: { description: 'One-liner shown in metadata + hero subtitle.' } },
  { name: 'metaTitle', type: 'text' },
  { name: 'metaDescription', type: 'textarea' },

  {
    name: 'hero',
    type: 'group',
    fields: [
      { name: 'eyebrow', type: 'text', localized: true },
      {
        name: 'titlePrefix',
        type: 'text',
        admin: { description: 'First part of headline. Plain text.' },
      },
      {
        name: 'titleEmphasis',
        type: 'text',
        admin: {
          description: 'Word(s) to render in italic <em>. Optional.',
        },
      },
      {
        name: 'titleSuffix',
        type: 'text',
        admin: { description: 'Tail of headline after the italic part. Plain text.' },
      },
      { name: 'description', type: 'textarea', localized: true },
    ],
  },

  {
    name: 'whoFor',
    type: 'group',
    fields: [
      { name: 'eyebrow', type: 'text', localized: true, defaultValue: 'Built for' },
      {
        name: 'items',
        type: 'array',
        fields: [{ name: 'label', type: 'text', localized: true, required: true }],
      },
    ],
  },

  {
    name: 'signatureFeatures',
    type: 'array',
    admin: { description: 'Up to ~7 feature cards. Each is title + description.' },
    fields: [
      { name: 'title', type: 'text', localized: true, required: true },
      { name: 'description', type: 'textarea', localized: true, required: true },
    ],
  },

  {
    name: 'compliance',
    type: 'array',
    admin: { description: 'Compliance + trust-signal bullet list.' },
    fields: [{ name: 'item', type: 'text', localized: true, required: true }],
  },

  { name: 'pricingNote', type: 'textarea', localized: true },

  {
    name: 'cta',
    type: 'group',
    fields: [
      { name: 'buyHref', type: 'text', defaultValue: `/buy?variant=${variant}` },
      { name: 'downloadHref', type: 'text', defaultValue: `/signup?variant=${variant}` },
      { name: 'buyLabel', type: 'text', localized: true, defaultValue: 'Buy now' },
      { name: 'trialLabel', type: 'text', localized: true, defaultValue: 'Start 30-day free trial' },
    ],
  },
]

export const TradeLandings: GlobalConfig = {
  slug: 'trade-landings',
  admin: {
    description: 'Per-trade landing page copy. One tab per variant.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        { label: 'Pro', description: 'Multi-trade Pro variant. /pro', fields: [{ name: 'pro', type: 'group', fields: variantFields('pro') }] },
        { label: 'Dawa', description: 'Pharmacy variant. /dawa', fields: [{ name: 'dawa', type: 'group', fields: variantFields('dawa') }] },
        { label: 'Retail', description: 'Retail variant. /retail', fields: [{ name: 'retail', type: 'group', fields: variantFields('retail') }] },
        { label: 'Hospitality', description: 'Hospitality variant. /hospitality', fields: [{ name: 'hospitality', type: 'group', fields: variantFields('hospitality') }] },
        { label: 'Hardware', description: 'Hardware variant. /hardware', fields: [{ name: 'hardware', type: 'group', fields: variantFields('hardware') }] },
      ],
    },
  ],
}
