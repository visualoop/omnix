import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'

export const ContactContent: GlobalConfig = {
  slug: 'contact-content',
  admin: {
    description: 'Copy for the /contact page. Methods + FAQ + closing CTA each in their own tab.',
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
          label: 'Header',
          fields: [
            { name: 'pageTitle', type: 'text', localized: true, defaultValue: 'Talk to a human.' },
            { name: 'pageSubtitle', type: 'textarea', localized: true },
          ],
        },
        {
          label: 'Methods',
          description: 'Channels rendered as cards. Phone numbers + emails come from Settings → Contact (single source of truth).',
          fields: [
            { name: 'methodsHeading', type: 'text', localized: true, defaultValue: 'Pick the fastest channel' },
            {
              name: 'methods',
              type: 'array',
              fields: [
                {
                  name: 'channel',
                  type: 'select',
                  required: true,
                  options: ['whatsapp', 'email-support', 'email-sales', 'phone', 'office'],
                  admin: {
                    description: 'Pulls live value from Settings → Contact for the corresponding channel.',
                  },
                },
                { name: 'label', type: 'text', localized: true, admin: { description: 'Override label (optional). Defaults to channel name.' } },
                { name: 'description', type: 'textarea', localized: true, admin: { description: 'Short note shown under the channel.' } },
              ],
            },
          ],
        },
        {
          label: 'FAQ',
          description: 'Up to ~6 frequently-asked questions shown below the methods grid.',
          fields: [
            { name: 'faqHeading', type: 'text', localized: true, defaultValue: 'Frequently asked' },
            {
              name: 'faq',
              type: 'array',
              fields: [
                { name: 'question', type: 'text', localized: true, required: true },
                { name: 'answer', type: 'textarea', localized: true, required: true },
              ],
            },
          ],
        },
        {
          label: 'Closing CTA',
          fields: [
            { name: 'ctaHeading', type: 'text', localized: true },
            { name: 'ctaBody', type: 'textarea', localized: true },
            { name: 'ctaPrimaryLabel', type: 'text', localized: true, defaultValue: 'Start free trial' },
            { name: 'ctaPrimaryHref', type: 'text', defaultValue: '/signup' },
          ],
        },
      ],
    },
  ],
}
