import type { CollectionConfig } from 'payload'
import { allowSystem, ownerOnly } from '../access'

/**
 * Releases — each version of the desktop installer.
 *
 * Created automatically by CI (notify-payload job, see Plan 04 §4.2).
 * Owner reviews drafts and clicks "publish" to push to all customers.
 *
 * The /downloads marketing page reads where status='published' & channel='stable'.
 * The /api/releases/latest endpoint serves the Tauri auto-updater.
 */
export const Releases: CollectionConfig = {
  slug: 'releases',
  admin: {
    useAsTitle: 'version',
    defaultColumns: ['version', 'channel', 'status', 'publishedAt', 'downloadCount'],
    description: 'Desktop installer versions. Auto-created by CI; published manually unless autoPublish is on.',
  },
  access: {
    read: ({ req }) => {
      // Owner / support: full
      if (req.user?.collection === 'users') return true
      // Public + customers: only published releases
      return { status: { equals: 'published' } }
    },
    create: ({ req }) => allowSystem(req) || ownerOnly({ req } as never) === true,
    update: ({ req }) => allowSystem(req) || ownerOnly({ req } as never) === true,
    delete: ownerOnly,
  },
  fields: [
    // ── Identity ────────────────────────────────────────────────
    {
      name: 'version',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Semver. Set by CI from the git tag, e.g. "0.2.0", "1.0.0-beta.2".',
      },
    },
    {
      name: 'majorVersion',
      type: 'number',
      required: true,
      admin: {
        description: 'First number from version. Used to enforce per-license major-version cap.',
      },
    },
    {
      name: 'channel',
      type: 'select',
      defaultValue: 'stable',
      options: [
        { label: 'Stable', value: 'stable' },
        { label: 'Beta', value: 'beta' },
        { label: 'Alpha', value: 'alpha' },
      ],
    },
    {
      name: 'gitTag',
      type: 'text',
      admin: { description: 'e.g. "v0.2.0". Diagnostic only.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft (CI just created, not visible to customers)', value: 'draft' },
        { label: 'Published (live)', value: 'published' },
        { label: 'Rolled back (still in R2 but hidden)', value: 'rolled_back' },
        { label: 'Archived (replaced by newer)', value: 'archived' },
      ],
    },

    // ── Download artifacts ─────────────────────────────────────
    { name: 'windowsMsiUrl', type: 'text' },
    { name: 'windowsNsisUrl', type: 'text' },
    { name: 'windowsMsiSize', type: 'number', admin: { description: 'Bytes.' } },
    { name: 'windowsNsisSize', type: 'number' },
    { name: 'updaterSignature', type: 'text', admin: { description: 'Tauri updater signature for the NSIS bundle.' } },
    { name: 'sha256Msi', type: 'text' },
    { name: 'sha256Nsis', type: 'text' },

    // ── Release notes ──────────────────────────────────────────
    {
      name: 'title',
      type: 'text',
      admin: { description: 'e.g. "v0.2.0 — Banking & Recurring Invoices".' },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: { description: 'One-paragraph summary, shown on changelog page.' },
    },
    {
      name: 'changelog',
      type: 'richText',
      admin: { description: 'Full changelog. Markdown-style rich text.' },
    },
    {
      name: 'highlights',
      type: 'array',
      labels: { singular: 'Highlight', plural: 'Highlights' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'icon', type: 'text', admin: { description: 'Lucide icon name (e.g. "ShoppingCart").' } },
        { name: 'screenshot', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'breaking',
      type: 'array',
      labels: { singular: 'Breaking change', plural: 'Breaking changes' },
      fields: [{ name: 'description', type: 'textarea' }],
    },
    { name: 'requiresMigration', type: 'checkbox' },
    { name: 'migrationNotes', type: 'textarea' },

    // ── Distribution control ───────────────────────────────────
    {
      name: 'minMajorVersionToUpgrade',
      type: 'number',
      admin: {
        description: 'Customers with majorVersionCap below this cannot install — they need the major upgrade.',
      },
    },
    {
      name: 'requiresPaidLicense',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'When on, trial users cannot install this version. Default off so trials always get latest.',
      },
    },

    // ── Telemetry counters ─────────────────────────────────────
    { name: 'downloadCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'installCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },

    // ── Audit ──────────────────────────────────────────────────
    { name: 'publishedAt', type: 'date' },
    { name: 'publishedBy', type: 'relationship', relationTo: 'users' },
    { name: 'rolledBackAt', type: 'date' },
    { name: 'rolledBackReason', type: 'textarea' },
  ],
}
