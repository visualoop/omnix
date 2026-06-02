import type { CollectionConfig } from 'payload'
import { allowSystem, ownerOnly } from '../access'

/**
 * Activations — append-only audit log of every licensing event the server
 * processes: activate, validate (heartbeat), rebind, and rejections.
 *
 * Written by the activation/validate/rebind endpoints (system-token auth).
 * Read by owner/support for fraud investigation; customers never see it.
 */
export const Activations: CollectionConfig = {
  slug: 'activations',
  admin: {
    useAsTitle: 'event',
    defaultColumns: ['event', 'license', 'machineId', 'outcome', 'createdAt'],
    description: 'Append-only licensing event log (activate / validate / rebind / reject).',
  },
  access: {
    read: ({ req }) => req.user?.collection === 'users',
    create: ({ req }) => allowSystem(req) || ownerOnly({ req } as never) === true,
    update: () => false, // append-only
    delete: ownerOnly,
  },
  fields: [
    {
      name: 'license',
      type: 'relationship',
      relationTo: 'licenses',
      admin: { description: 'Empty when the key did not resolve to a known license.' },
    },
    {
      name: 'machine',
      type: 'relationship',
      relationTo: 'machines',
    },
    { name: 'fingerprint', type: 'text', admin: { description: 'Hardware fingerprint string presented by the client.' } },
    {
      name: 'event',
      type: 'select',
      required: true,
      options: [
        { label: 'Activate', value: 'activate' },
        { label: 'Validate (heartbeat)', value: 'validate' },
        { label: 'Rebind', value: 'rebind' },
        { label: 'Deactivate', value: 'deactivate' },
      ],
    },
    {
      name: 'outcome',
      type: 'select',
      required: true,
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Rejected — seat limit', value: 'rejected_seats' },
        { label: 'Rejected — rebind cooldown', value: 'rejected_cooldown' },
        { label: 'Rejected — invalid/unknown key', value: 'rejected_invalid' },
        { label: 'Rejected — license suspended/revoked', value: 'rejected_revoked' },
      ],
    },
    { name: 'detail', type: 'text', admin: { description: 'Human-readable reason / error string.' } },
    { name: 'ip', type: 'text' },
  ],
}
