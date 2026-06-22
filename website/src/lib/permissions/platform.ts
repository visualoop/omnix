/**
 * Platform-level permissions — for Omnix staff.
 * platform_admin · support_agent · sales_rep · user
 */
import { createAccessControl } from 'better-auth/plugins/access'
import {
  defaultStatements as adminDefaults,
  adminAc as platAdminAc,
} from 'better-auth/plugins/admin/access'

const statement = {
  ...adminDefaults,
  release: ['publish', 'rollback'],
  customer: ['view', 'edit', 'delete'],
  org: ['view', 'edit', 'delete'],
  payment: ['view', 'refund'],
  ticket: ['view', 'reply', 'close', 'reassign'],
  audit: ['view'],
} as const

export const platformAc = createAccessControl(statement)

export const platform_admin = platformAc.newRole({
  ...platAdminAc.statements,
  release: ['publish', 'rollback'],
  customer: ['view', 'edit', 'delete'],
  org: ['view', 'edit', 'delete'],
  payment: ['view', 'refund'],
  ticket: ['view', 'reply', 'close', 'reassign'],
  audit: ['view'],
})

export const support_agent = platformAc.newRole({
  user: ['list', 'get'],
  customer: ['view', 'edit'],
  ticket: ['view', 'reply', 'close', 'reassign'],
  audit: ['view'],
})

export const sales_rep = platformAc.newRole({
  user: ['list', 'get'],
  customer: ['view'],
  payment: ['view'],
})
