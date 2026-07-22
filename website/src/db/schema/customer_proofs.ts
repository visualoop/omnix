import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { auditLog } from './audit_log'
import { user } from './auth'
import { platformMedia } from './platform_media'

/** Evidence retained internally for one exact publication envelope. */
export const customerProofEvidence = pgTable(
  'customer_proof_evidence',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull(),
    sourceType: text('source_type').notNull(),
    sourceLocation: text('source_location').notNull(),
    assertedPublicationSha256: text('asserted_publication_sha256').notNull().default(''),
    verificationState: text('verification_state').notNull().default('pending'),
    verifiedBy: text('verified_by').references(() => user.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('customer_proof_evidence_reference_uidx').on(table.reference),
    stateIdx: index('customer_proof_evidence_state_idx').on(table.verificationState),
  }),
)

/** Customer grant authorising publication of one exact publication envelope. */
export const customerProofPermissions = pgTable(
  'customer_proof_permissions',
  {
    id: text('id').primaryKey(),
    customerName: text('customer_name').notNull(),
    grantorName: text('grantor_name').notNull(),
    documentReference: text('document_reference').notNull(),
    authorisedPublicationSha256: text('authorised_publication_sha256').notNull().default(''),
    permissionState: text('permission_state').notNull().default('pending'),
    grantedAt: timestamp('granted_at'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    documentUnique: uniqueIndex('customer_proof_permissions_document_uidx').on(table.documentReference),
    stateIdx: index('customer_proof_permissions_state_idx').on(table.permissionState),
  }),
)

/** Public claim candidate. `content` is validated by kind before rendering. */
export const verifiedCustomerProofs = pgTable(
  'verified_customer_proofs',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    product: text('product').notNull(),
    customerName: text('customer_name').notNull(),
    content: jsonb('content').notNull(),
    publicationSha256: text('publication_sha256').notNull().default(''),
    evidenceId: text('evidence_id').notNull().references(() => customerProofEvidence.id, { onDelete: 'restrict' }),
    publicPermissionId: text('public_permission_id').notNull().references(() => customerProofPermissions.id, { onDelete: 'restrict' }),
    mediaId: text('media_id').references(() => platformMedia.id, { onDelete: 'set null' }),
    approvalState: text('approval_state').notNull().default('pending'),
    approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approvalAuditId: text('approval_audit_id').references(() => auditLog.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    publicationIdx: index('verified_customer_proofs_publication_idx').on(table.approvalState, table.kind, table.displayOrder),
    evidenceIdx: index('verified_customer_proofs_evidence_idx').on(table.evidenceId),
    permissionIdx: index('verified_customer_proofs_permission_idx').on(table.publicPermissionId),
  }),
)
