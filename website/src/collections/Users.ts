import type { CollectionConfig } from 'payload'
import { ownerOnly, ownerOrSupport } from '../access'

/**
 * Users — internal staff accounts (the owner + any support).
 * Customers have their own auth-enabled collection ('customers').
 *
 * Auth is via Payload's email + password. Login at /admin.
 * Roles control what a logged-in staff member can do across collections.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    description: 'Internal staff accounts (owner + support). Customers live in the Customers collection.',
  },
  auth: true,
  access: {
    read: ownerOrSupport,
    create: ownerOnly,
    update: ({ req, id }) => {
      // Owner can manage anyone; support can edit themselves only.
      if (req.user?.collection === 'users') {
        const role = (req.user as unknown as { role?: string }).role
        if (role === 'owner') return true
        if (role === 'support') return { id: { equals: req.user.id } }
      }
      return false
    },
    delete: ownerOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'support',
      options: [
        { label: 'Owner — full admin access', value: 'owner' },
        { label: 'Support — read all, reply to tickets', value: 'support' },
      ],
      access: {
        update: ({ req }) => {
          // Only owners can change roles
          if (req.user?.collection !== 'users') return false
          return (req.user as unknown as { role?: string }).role === 'owner'
        },
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Optional. For internal contact only.',
      },
    },
  ],
}
