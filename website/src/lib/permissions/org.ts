/**
 * Better Auth access control statements + roles.
 *
 * Two planes:
 *   - Org plane (per organization): owner, admin, member
 *   - Platform plane (Omnix staff): platform_admin, support_agent, sales_rep, user
 *
 * A single user can hold roles from both planes — staff who happen to
 * also own a pharmacy through this product.
 */
import { createAccessControl } from 'better-auth/plugins/access'
import {
  defaultStatements as orgDefaults,
  adminAc as orgAdminAc,
  memberAc as orgMemberAc,
  ownerAc as orgOwnerAc,
} from 'better-auth/plugins/organization/access'

const orgStatement = {
  ...orgDefaults,
  machine: ['list', 'register', 'rebind', 'delete'],
  license: ['list', 'issue', 'rebind', 'transfer', 'cancel'],
  payment: ['list', 'refund'],
  ticket: ['list', 'create', 'reply', 'close'],
  backup: ['list', 'restore', 'delete'],
} as const

export const ac = createAccessControl(orgStatement)

export const owner = ac.newRole({
  ...orgOwnerAc.statements,
  machine: ['list', 'register', 'rebind', 'delete'],
  license: ['list', 'issue', 'rebind', 'transfer', 'cancel'],
  payment: ['list', 'refund'],
  ticket: ['list', 'create', 'reply', 'close'],
  backup: ['list', 'restore', 'delete'],
})

export const admin = ac.newRole({
  ...orgAdminAc.statements,
  machine: ['list', 'register', 'rebind'],
  license: ['list', 'issue', 'rebind'],
  payment: ['list'],
  ticket: ['list', 'create', 'reply'],
  backup: ['list', 'restore'],
})

export const member = ac.newRole({
  ...orgMemberAc.statements,
  machine: ['list'],
  license: ['list'],
  payment: ['list'],
  ticket: ['list', 'create'],
  backup: ['list'],
})
