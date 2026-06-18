import type { GlobalConfig } from 'payload'
import { ownerOnly } from '../access'

/**
 * FooterContent — link blocks rendered in the public site footer.
 *
 * Each tab is one column of the footer. WhatsApp, contact email, social
 * handles, copyright + KRA PIN come from the Settings global so we never
 * duplicate values.
 */
export const FooterContent: GlobalConfig = {
  slug: 'footer-content',
  admin: {
    description: 'Site footer link columns. Each tab is one column on omnix.co.ke/footer.',
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
          label: 'Branding',
          description: 'Tagline + closing line under the brand name.',
          fields: [
            { name: 'branding', type: 'textarea', localized: true, admin: { description: 'Short pitch under the logo.' } },
            { name: 'copyrightLine', type: 'text', localized: true, admin: { description: 'e.g. "© 2026 Omnix Software Ltd."' } },
          ],
        },
        {
          label: 'Product links',
          fields: [
            { name: 'productHeading', type: 'text', localized: true, defaultValue: 'Product' },
            {
              name: 'productLinks',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'href', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Trades',
          fields: [
            { name: 'tradesHeading', type: 'text', localized: true, defaultValue: 'Trades' },
            {
              name: 'tradeLinks',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'href', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Company links',
          fields: [
            { name: 'companyHeading', type: 'text', localized: true, defaultValue: 'Company' },
            {
              name: 'companyLinks',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'href', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Legal links',
          fields: [
            { name: 'legalHeading', type: 'text', localized: true, defaultValue: 'Legal' },
            {
              name: 'legalLinks',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'href', type: 'text', required: true },
              ],
            },
          ],
        },
      ],
    },
  ],
}
