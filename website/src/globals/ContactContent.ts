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
            { name: 'pageTitle', type: 'text', defaultValue: 'Talk to a human.' },
            { name: 'pageSubtitle', type: 'textarea' },
          ],
        },
        {
          label: 'Methods',
          description: 'Channels rendered as cards. Phone numbers + emails come from Settings → Contact (single source of truth).',
          fields: [
            { name: 'methodsHeading', type: 'text', defaultValue: 'Pick the fastest channel' },
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
                { name: 'label', type: 'text', admin: { description: 'Override label (optional). Defaults to channel name.' } },
                { name: 'description', type: 'textarea', admin: { description: 'Short note shown under the channel.' } },
              ],
            },
          ],
        },
        {
          label: 'FAQ',
          description: 'Up to ~6 frequently-asked questions shown below the methods grid.',
          fields: [
            { name: 'faqHeading', type: 'text', defaultValue: 'Frequently asked' },
            {
              name: 'faq',
              type: 'array',
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
            },
          ],
        },
        {
          label: 'Closing CTA',
          fields: [
            { name: 'ctaHeading', type: 'text' },
            { name: 'ctaBody', type: 'textarea' },
            { name: 'ctaPrimaryLabel', type: 'text', defaultValue: 'Start free trial' },
            { name: 'ctaPrimaryHref', type: 'text', defaultValue: '/signup' },
          ],
        },
      ],
    },
  ],
}
