import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/page-hero';
import { PartnersForm } from '@/components/marketing/partners-form';

export const metadata: Metadata = {
  title: 'Partners — reselling & integration',
  description:
    'Omnix is private commercial software. Resellers, regional distributors, integrators and OEMs work with us under a written agreement. Submit an enquiry to start a conversation.',
};

export default function PartnersPage() {
  return (
    <>
      <PageHero
        eyebrow="Partnerships"
        title="Carry Omnix to your market."
        description="Omnix is private commercial software — not open source. Resellers, regional distributors, integrators and OEMs work with us under a written agreement. Tell us what you're working on and we'll come back within two business days."
      />

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
          <aside className="space-y-8 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground mb-3">
                Who we work with
              </h2>
              <ul className="space-y-2.5">
                <li>
                  <span className="text-foreground font-medium">Resellers</span> —
                  selling licences and onboarding businesses in your county / region.
                </li>
                <li>
                  <span className="text-foreground font-medium">Integrators</span> —
                  building deployments that connect Omnix to a specific industry
                  workflow.
                </li>
                <li>
                  <span className="text-foreground font-medium">OEM</span> — bundling
                  Omnix into a hardware kit (POS terminals, mini PCs, kiosks).
                </li>
                <li>
                  <span className="text-foreground font-medium">Referral</span> —
                  introducing customers in exchange for revenue share.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground mb-3">
                Our terms in one paragraph
              </h2>
              <p>
                Omnix is the proprietary commercial software of Omnix. You cannot
                fork it, white-label it, host a clone, or resell it without a
                signed agreement. The agreement covers margin, territory, support
                expectations and brand use. It is straightforward and we sign
                quickly when the fit is clear.
              </p>
            </div>

            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground mb-3">
                What to include
              </h2>
              <p>
                Country and region, the industries you serve, an estimate of monthly
                deployments, and anything unique about your distribution muscle —
                physical stores, training centres, integration team, etc.
              </p>
            </div>
          </aside>

          <div>
            <PartnersForm />
          </div>
        </div>
      </section>
    </>
  );
}
