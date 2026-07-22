import { createHash } from 'node:crypto'
import { and, asc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  auditLog,
  customerProofEvidence,
  customerProofPermissions,
  db,
  user,
  verifiedCustomerProofs,
} from '@/db'
import { getApprovedMediaById } from '@/lib/media-slots'

export const CUSTOMER_PROOF_KINDS = ['testimonial', 'customer-logo', 'outcome', 'case-study', 'rating'] as const
export const CUSTOMER_PROOF_PRODUCTS = ['pharmacy', 'retail', 'hospitality', 'hardware', 'salon'] as const

export type CustomerProofKind = (typeof CUSTOMER_PROOF_KINDS)[number]
export type CustomerProofProduct = (typeof CUSTOMER_PROOF_PRODUCTS)[number]

interface ProofBase {
  id: string
  customerName: string
  product: CustomerProofProduct
}
export interface TestimonialProof extends ProofBase { kind: 'testimonial'; quote: string; attributionName: string; attributionRole: string }
export interface CustomerLogoProof extends ProofBase { kind: 'customer-logo'; logoUrl: string; logoAlt: string }
export interface OutcomeProof extends ProofBase { kind: 'outcome'; metric: string; description: string; methodology: string }
export interface CaseStudyProof extends ProofBase { kind: 'case-study'; title: string; summary: string; href: string }
export interface RatingProof extends ProofBase { kind: 'rating'; ratingValue: number; ratingScale: number; reviewCount: number; source: string; sourceUrl: string }
export type CustomerProof = TestimonialProof | CustomerLogoProof | OutcomeProof | CaseStudyProof | RatingProof

interface ProofContentRegistryEntry {
  requiredFields: readonly string[]
  customerClaim: boolean
}

/** Typed shape registry only. It deliberately contains no customer claims. */
export const VERIFIED_CUSTOMER_PROOF_REGISTRY = {
  testimonial: { requiredFields: ['quote', 'attributionName', 'attributionRole'], customerClaim: true },
  'customer-logo': { requiredFields: ['logoAlt'], customerClaim: true },
  outcome: { requiredFields: ['metric', 'description', 'methodology'], customerClaim: true },
  'case-study': { requiredFields: ['title', 'summary', 'href'], customerClaim: true },
  rating: { requiredFields: ['ratingValue', 'ratingScale', 'reviewCount', 'source', 'sourceUrl'], customerClaim: true },
} as const satisfies Record<CustomerProofKind, ProofContentRegistryEntry>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, maxLength = 2_000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maxLength ? trimmed : null
}

function safePublicHref(value: unknown): string | null {
  const href = text(value, 2_000)
  if (!href) return null
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    return new URL(href).protocol === 'https:' ? href : null
  } catch {
    return null
  }
}

function isProduct(value: string): value is CustomerProofProduct {
  return CUSTOMER_PROOF_PRODUCTS.includes(value as CustomerProofProduct)
}

function isKind(value: string): value is CustomerProofKind {
  return CUSTOMER_PROOF_KINDS.includes(value as CustomerProofKind)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export interface CustomerProofPublicationEnvelope {
  kind: CustomerProofKind
  product: CustomerProofProduct
  customerName: string
  content: unknown
  mediaId: string | null
}

/** Digest of every public identity-bearing field, including logo media identity. */
export function customerProofPublicationSha256(envelope: CustomerProofPublicationEnvelope): string {
  return createHash('sha256').update(canonicalJson(envelope)).digest('hex')
}

interface PersistedProofCandidate {
  id: string
  kind: string
  product: string
  customerName: string
  content: unknown
  publicationSha256: string
  mediaId: string | null
  approvedAt: Date | null
}

/** Kind-specific parser; invalid digests, ratings, URLs, and incomplete claims fail closed. */
export async function validatePersistedProof(candidate: PersistedProofCandidate): Promise<CustomerProof | null> {
  if (!candidate.id.trim() || !candidate.customerName.trim()) return null
  if (!isKind(candidate.kind) || !isProduct(candidate.product) || !isRecord(candidate.content)) return null
  if (!(candidate.approvedAt instanceof Date) || !Number.isFinite(candidate.approvedAt.getTime())) return null

  const publicationSha256 = customerProofPublicationSha256({
    kind: candidate.kind,
    product: candidate.product,
    customerName: candidate.customerName,
    content: candidate.content,
    mediaId: candidate.mediaId,
  })
  if (publicationSha256 !== candidate.publicationSha256) return null

  const base = { id: candidate.id, customerName: candidate.customerName.trim(), product: candidate.product }
  switch (candidate.kind) {
    case 'testimonial': {
      const quote = text(candidate.content.quote)
      const attributionName = text(candidate.content.attributionName, 200)
      const attributionRole = text(candidate.content.attributionRole, 300)
      return quote && attributionName && attributionRole ? { ...base, kind: candidate.kind, quote, attributionName, attributionRole } : null
    }
    case 'customer-logo': {
      const logoAlt = text(candidate.content.logoAlt, 300)
      if (!logoAlt || !candidate.mediaId) return null
      const media = await getApprovedMediaById(candidate.mediaId)
      return media && media.mimeType.startsWith('image/') ? { ...base, kind: candidate.kind, logoUrl: media.url, logoAlt } : null
    }
    case 'outcome': {
      const metric = text(candidate.content.metric, 200)
      const description = text(candidate.content.description)
      const methodology = text(candidate.content.methodology)
      return metric && description && methodology ? { ...base, kind: candidate.kind, metric, description, methodology } : null
    }
    case 'case-study': {
      const title = text(candidate.content.title, 300)
      const summary = text(candidate.content.summary)
      const href = safePublicHref(candidate.content.href)
      return title && summary && href ? { ...base, kind: candidate.kind, title, summary, href } : null
    }
    case 'rating': {
      const { ratingValue, ratingScale, reviewCount } = candidate.content
      const source = text(candidate.content.source, 300)
      const sourceUrl = safePublicHref(candidate.content.sourceUrl)
      const validNumbers = typeof ratingValue === 'number' && Number.isFinite(ratingValue)
        && typeof ratingScale === 'number' && Number.isFinite(ratingScale)
        && ratingScale > 0 && ratingScale <= 10 && ratingValue >= 0 && ratingValue <= ratingScale
        && typeof reviewCount === 'number' && Number.isInteger(reviewCount) && reviewCount > 0
      return validNumbers && source && sourceUrl
        ? { ...base, kind: candidate.kind, ratingValue, ratingScale, reviewCount, source, sourceUrl }
        : null
    }
  }
}

/**
 * The only public proof loader. Inner joins make invented/nonexistent evidence,
 * permission, reviewer, or audit IDs unqueryable. Exact SHA-256 equality binds
 * evidence and permission to the full publication envelope being rendered.
 */
export async function getApprovedCustomerProofs(kinds?: readonly CustomerProofKind[]): Promise<CustomerProof[]> {
  try {
    const approver = alias(user, 'customer_proof_approver')
    const evidenceVerifier = alias(user, 'customer_proof_evidence_verifier')
    const approvalAudit = alias(auditLog, 'customer_proof_approval_audit')
    const now = new Date()
    const rows = await db
      .select({
        id: verifiedCustomerProofs.id,
        kind: verifiedCustomerProofs.kind,
        product: verifiedCustomerProofs.product,
        customerName: verifiedCustomerProofs.customerName,
        content: verifiedCustomerProofs.content,
        publicationSha256: verifiedCustomerProofs.publicationSha256,
        mediaId: verifiedCustomerProofs.mediaId,
        approvedAt: verifiedCustomerProofs.approvedAt,
      })
      .from(verifiedCustomerProofs)
      .innerJoin(customerProofEvidence, eq(verifiedCustomerProofs.evidenceId, customerProofEvidence.id))
      .innerJoin(customerProofPermissions, eq(verifiedCustomerProofs.publicPermissionId, customerProofPermissions.id))
      .innerJoin(approver, eq(verifiedCustomerProofs.approvedBy, approver.id))
      .innerJoin(evidenceVerifier, eq(customerProofEvidence.verifiedBy, evidenceVerifier.id))
      .innerJoin(approvalAudit, eq(verifiedCustomerProofs.approvalAuditId, approvalAudit.id))
      .where(and(
        eq(verifiedCustomerProofs.approvalState, 'approved'),
        isNotNull(verifiedCustomerProofs.approvedBy),
        isNotNull(verifiedCustomerProofs.approvalAuditId),
        isNotNull(verifiedCustomerProofs.approvedAt),
        eq(approver.role, 'platform_admin'),
        eq(customerProofEvidence.verificationState, 'verified'),
        isNotNull(customerProofEvidence.verifiedBy),
        isNotNull(customerProofEvidence.verifiedAt),
        eq(evidenceVerifier.role, 'platform_admin'),
        eq(customerProofPermissions.permissionState, 'granted'),
        isNotNull(customerProofPermissions.grantedAt),
        isNull(customerProofPermissions.revokedAt),
        or(isNull(customerProofPermissions.expiresAt), gt(customerProofPermissions.expiresAt, now)),
        eq(customerProofPermissions.customerName, verifiedCustomerProofs.customerName),
        eq(customerProofEvidence.assertedPublicationSha256, verifiedCustomerProofs.publicationSha256),
        eq(customerProofPermissions.authorisedPublicationSha256, verifiedCustomerProofs.publicationSha256),
        eq(approvalAudit.actorId, verifiedCustomerProofs.approvedBy),
        eq(approvalAudit.action, 'customer_proof.approve'),
        eq(approvalAudit.resource, sql<string>`'verified_customer_proof:' || ${verifiedCustomerProofs.id}`),
      ))
      .orderBy(asc(verifiedCustomerProofs.displayOrder), asc(verifiedCustomerProofs.createdAt))
      .limit(100)

    const requested = kinds ? new Set(kinds) : null
    const approved: CustomerProof[] = []
    for (const row of rows) {
      if (requested && (!isKind(row.kind) || !requested.has(row.kind))) continue
      const proof = await validatePersistedProof(row)
      if (proof) approved.push(proof)
    }
    return approved
  } catch {
    return []
  }
}
