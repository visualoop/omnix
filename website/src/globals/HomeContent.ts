import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * HomeContent — every section of the homepage that should be editable
 * without a code change. Sections sit in tabs so the admin sees a
 * compact UI instead of an endless scroll.
 */
export const HomeContent: GlobalConfig = {
  slug: 'home-content',
  admin: {
    description: 'Homepage copy. Each tab maps to a section on omnix.co.ke.',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero',
          description: 'Top-of-page headline + CTAs.',
          fields: [
            { name: 'heroEyebrow', type: 'text', localized: true, defaultValue: 'For Kenyan SMEs' },
            { name: 'heroTitle', type: 'textarea', localized: true, required: true },
            { name: 'heroSubtitle', type: 'textarea', localized: true },
            {
              name: 'heroPrimaryCta',
              type: 'group',
              fields: [
                { name: 'label', type: 'text', localized: true, defaultValue: 'Start free trial' },
                { name: 'href', type: 'text', defaultValue: '/signup' },
              ],
            },
            {
              name: 'heroSecondaryCta',
              type: 'group',
              fields: [
                { name: 'label', type: 'text', localized: true, defaultValue: 'See pricing' },
                { name: 'href', type: 'text', defaultValue: '/pricing' },
              ],
            },
          ],
        },
        {
          label: 'Founder note',
          description: 'Personal note section with founder photo + quote.',
          fields: [
            { name: 'founderHeading', type: 'text', localized: true, defaultValue: 'Built by an operator, not a software shop.' },
            { name: 'founderName', type: 'text', localized: true, defaultValue: 'Justine Gachuru' },
            { name: 'founderRole', type: 'text', localized: true, defaultValue: 'Founder, Omnix' },
            { name: 'founderPhoto', type: 'upload', relationTo: 'media' },
            { name: 'founderQuote', type: 'textarea', localized: true },
            { name: 'founderBody', type: 'richText', localized: true },
          ],
        },
        {
          label: 'AI section',
          description: 'AI assistant teaser block on the homepage.',
          fields: [
            { name: 'aiEyebrow', type: 'text', localized: true, defaultValue: 'New' },
            { name: 'aiHeading', type: 'text', localized: true, defaultValue: 'Ask your business anything.' },
            { name: 'aiSubheading', type: 'textarea', localized: true },
            {
              name: 'aiSamples',
              type: 'array',
              admin: { description: 'Sample prompts shown rotating in the hero card.' },
              fields: [{ name: 'prompt', type: 'text', localized: true }],
            },
            {
              name: 'aiCta',
              type: 'group',
              fields: [
                { name: 'label', type: 'text', localized: true, defaultValue: 'See AI in action' },
                { name: 'href', type: 'text', defaultValue: '/ai' },
              ],
            },
          ],
        },
        {
          label: 'Modules rows',
          description: 'Trade rows. Each row corresponds to one trade variant on the homepage.',
          fields: [
            {
              name: 'moduleRows',
              type: 'array',
              fields: [
                { name: 'variant', type: 'select', required: true, options: ['dawa', 'retail', 'hospitality', 'hardware'] },
                { name: 'title', type: 'text', localized: true },
                { name: 'body', type: 'textarea', localized: true },
                { name: 'ctaLabel', type: 'text', localized: true },
                { name: 'ctaHref', type: 'text' },
              ],
            },
          ],
        },
        {
          label: 'Deploy',
          description: 'Why-Omnix / how-it-deploys section.',
          fields: [
            { name: 'deployHeading', type: 'text', localized: true, defaultValue: 'Built to run on a single Windows PC.' },
            { name: 'deploySubheading', type: 'textarea', localized: true },
            {
              name: 'deployBullets',
              type: 'array',
              fields: [
                { name: 'title', type: 'text', localized: true },
                { name: 'body', type: 'textarea', localized: true },
              ],
            },
          ],
        },
        {
          label: 'Closing CTA',
          description: 'Bottom-of-page call-to-action band.',
          fields: [
            { name: 'closingHeading', type: 'textarea', localized: true },
            { name: 'closingBody', type: 'textarea', localized: true },
            {
              name: 'closingPrimaryCta',
              type: 'group',
              fields: [
                { name: 'label', type: 'text', localized: true, defaultValue: 'Start free trial' },
                { name: 'href', type: 'text', defaultValue: '/signup' },
              ],
            },
            {
              name: 'closingWhatsappPrompt',
              type: 'text',
              defaultValue: "or talk to us on WhatsApp",
              admin: { description: 'Text next to the WhatsApp link. Number itself comes from Settings → Contact.' },
            },
          ],
        },
      ],
    },
  ],
}
