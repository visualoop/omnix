import Link from 'next/link'
import {
  getApprovedCustomerProofs,
  type CustomerProof,
  type CustomerProofKind,
} from '@/lib/verified-customer-proof'

export async function VerifiedCustomerProof({ kinds }: { kinds?: readonly CustomerProofKind[] }) {
  const approved = await getApprovedCustomerProofs(kinds)
  if (approved.length === 0) return null

  return (
    <section className="section border-y border-[var(--color-border)]" aria-labelledby="verified-customer-proof-title">
      <div className="container-wide">
        <div className="mb-12 max-w-[42rem]">
          <span className="eyebrow">Verified customer proof</span>
          <h2 id="verified-customer-proof-title" className="headline-section mt-5 text-balance">
            Published with <em>permission.</em>
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-2">
          {approved.map((proof) => (
            <li key={proof.id} className="bg-[var(--color-bg)] p-7">
              <ProofBody proof={proof} />
              <p className="caption-mono mt-6">{proof.customerName}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ProofBody({ proof }: { proof: CustomerProof }) {
  switch (proof.kind) {
    case 'testimonial':
      return (
        <>
          <blockquote className="font-[family-name:var(--font-display)] text-[24px] leading-[1.35]">“{proof.quote}”</blockquote>
          <p className="mt-4 text-[13px] text-[var(--color-fg-muted)]">{proof.attributionName} · {proof.attributionRole}</p>
        </>
      )
    case 'customer-logo':
      return (
        // Reserve a fixed 48px-tall plate so the row does not shift while the
        // approved logo loads (CLS). Width stays auto inside the fixed-width
        // grid cell; the reserved height is the reliable dimension here.
        <span className="flex h-12 items-center">
          {/* This URL can only come from an independently approved media record. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proof.logoUrl}
            alt={proof.logoAlt}
            height={48}
            className="h-12 w-auto max-w-full object-contain"
          />
        </span>
      )
    case 'outcome':
      return (
        <>
          <p className="font-mono text-[28px] tabular-nums">{proof.metric}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">{proof.description}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">Method: {proof.methodology}</p>
        </>
      )
    case 'case-study':
      return (
        <>
          <h3 className="font-[family-name:var(--font-display)] text-[24px]">{proof.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">{proof.summary}</p>
          <Link href={proof.href} className="mt-5 inline-block text-[13px] underline underline-offset-4">Read the verified case study</Link>
        </>
      )
    case 'rating':
      return (
        <>
          <p className="font-mono text-[28px] tabular-nums">{proof.ratingValue.toFixed(1)} / {proof.ratingScale.toFixed(1)}</p>
          <p className="mt-3 text-[13px] text-[var(--color-fg-muted)]">
            {proof.reviewCount.toLocaleString()} reviews reported by{' '}
            <a href={proof.sourceUrl} rel="noopener noreferrer" className="underline underline-offset-4">{proof.source}</a>
          </p>
        </>
      )
  }
}
