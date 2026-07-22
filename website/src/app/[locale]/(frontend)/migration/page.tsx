import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/icons'
import { buildAlternatesLanguages } from '@/lib/hreflang'
import { buildSocialMetadata } from '@/lib/seo-metadata'
import { getSiteSettings } from '@/lib/site-settings'

import styles from './migration.module.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omnix.co.ke'

const SOURCES = [
  {
    label: 'Books',
    title: 'Paper stock and account books',
    body: 'We first agree what must be keyed in, what can remain as an archive and who will verify the resulting opening figures.',
  },
  {
    label: 'Sheets',
    title: 'Excel or CSV spreadsheets',
    body: 'We inspect headers, units, duplicates and missing fields before agreeing a mapping. The original files remain untouched.',
  },
  {
    label: 'POS',
    title: 'Another point-of-sale system',
    body: 'Migration depends on the exports your current provider makes available and the quality of the records inside them.',
  },
] as const

const PROCESS = [
  {
    title: 'Discover the scope',
    body: 'List the records you need on day one, the history you need only for reference, your branches and the intended cutover date.',
    output: 'Written scope and owner',
  },
  {
    title: 'Preserve the source',
    body: 'Take source-system exports and backups before changing or cleaning anything. Paper records are photographed or retained as agreed.',
    output: 'Untouched source copy',
  },
  {
    title: 'Map a sample',
    body: 'Match source columns and categories to Omnix fields using a representative sample. Unclear values are flagged instead of guessed.',
    output: 'Mapping and exception list',
  },
  {
    title: 'Import and validate',
    body: 'Load the agreed records, then compare counts, stock values, balances and spot checks against the preserved source.',
    output: 'Validation worksheet',
  },
  {
    title: 'Cut over deliberately',
    body: 'Choose the final trading boundary, capture changes since the sample and have the business owner approve opening figures before live use.',
    output: 'Owner sign-off',
  },
] as const

const BOUNDARIES = [
  'We do not promise that every POS can export every record or that proprietary history can be reconstructed.',
  'We do not guess missing tax classes, balances, units, patient details or other business-critical values.',
  'We do not guarantee a same-day cutover. Timing depends on volume, source quality, exceptions and owner availability.',
  'A successful import is not an accounting audit. Your business and accountant remain responsible for validating opening figures.',
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const canonical = `${SITE_URL}/${locale}/migration`
  return {
    title: 'Plan your move to Omnix · Books, spreadsheets or another POS',
    description:
      'An honest Omnix migration process covering scope discovery, source backups, sample mapping, validation, cutover and practical boundaries.',
    alternates: { canonical, languages: buildAlternatesLanguages('/migration') },
    ...buildSocialMetadata({
      locale,
      url: canonical,
      title: 'Move to Omnix with the source preserved and the result checked',
      description:
        'Plan migration from books, spreadsheets or another POS without pretending every source maps cleanly.',
      type: 'website',
    }),
  }
}

function whatsappHref(base: string | null): string | null {
  if (!base) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}text=${encodeURIComponent('Hi Omnix, I would like to discuss moving my records from my current books or system.')}`
}

export default async function MigrationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const settings = await getSiteSettings()
  const demoHref = `/${locale}/contact?type=demo`
  const whatsapp = whatsappHref(settings.whatsappUrl)

  return (
    <div className={styles.page} data-migration-page>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Migration planning</p>
              <h1>
                Move the records you trust. <span>Keep the source intact.</span>
              </h1>
              <p className={styles.lede}>
                From paper books, spreadsheets or another POS, the safe move starts by deciding what
                matters, preserving the original and checking the result before the first live sale.
              </p>
              <div className={styles.actions} data-acquisition-actions>
                <Link className={styles.primaryAction} href={demoHref}>
                  Book a migration demo <Icon.ArrowRight aria-hidden weight="bold" />
                </Link>
                {whatsapp ? (
                  <a
                    className={styles.secondaryAction}
                    href={whatsapp}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Ask on WhatsApp
                  </a>
                ) : null}
              </div>
            </div>

            <aside className={styles.scopeSheet} aria-labelledby="scope-sheet-title">
              <div className={styles.sheetTop}>
                <span>Migration brief</span>
                <span>Prepared before import</span>
              </div>
              <h2 id="scope-sheet-title">Four questions before a file moves.</h2>
              <ol>
                <li>
                  <span>01</span>
                  <p>Which records must be ready for opening day?</p>
                </li>
                <li>
                  <span>02</span>
                  <p>What can remain in the old system or archive?</p>
                </li>
                <li>
                  <span>03</span>
                  <p>Who can confirm stock, balances and tax treatment?</p>
                </li>
                <li>
                  <span>04</span>
                  <p>When does the old record stop and Omnix begin?</p>
                </li>
              </ol>
              <p className={styles.sheetNote}>
                The answer determines effort and risk. File size alone does not.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.sources} aria-labelledby="sources-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Starting points</p>
              <h2 id="sources-title">Three common sources. Three different jobs.</h2>
            </div>
            <p>
              We do not describe manual transcription, spreadsheet cleanup and system exports as if
              they were the same migration.
            </p>
          </header>
          <div className={styles.sourceGrid}>
            {SOURCES.map((source) => (
              <article key={source.label}>
                <span>{source.label}</span>
                <h3>{source.title}</h3>
                <p>{source.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.process} aria-labelledby="process-title">
        <div className={styles.container}>
          <div className={styles.processGrid}>
            <header>
              <p className={styles.kicker}>Controlled cutover</p>
              <h2 id="process-title">A move you can inspect at every stage.</h2>
              <p>
                Each step leaves something reviewable behind. Exceptions stay visible until a person
                with business context resolves them.
              </p>
            </header>
            <ol className={styles.processList}>
              {PROCESS.map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <small>Output · {step.output}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.validation} aria-labelledby="validation-title">
        <div className={styles.container}>
          <div className={styles.validationGrid}>
            <div>
              <p className={styles.kicker}>Validation</p>
              <h2 id="validation-title">Imported is not the same as correct.</h2>
              <p>
                Before cutover, compare the new records with the preserved source. The checks depend
                on scope, but they normally include counts, totals and a sample of individual
                records.
              </p>
            </div>
            <dl>
              <div>
                <dt>Catalogues</dt>
                <dd>
                  Product, customer and supplier counts; required fields; duplicates; units and
                  prices.
                </dd>
              </div>
              <div>
                <dt>Opening position</dt>
                <dd>
                  Stock quantities and values, customer or supplier balances, and the agreed
                  effective date.
                </dd>
              </div>
              <div>
                <dt>Exceptions</dt>
                <dd>Rows skipped, changed or held for review, with a reason and a named owner.</dd>
              </div>
              <div>
                <dt>Live check</dt>
                <dd>A short counter walkthrough before the old process is retired.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className={styles.boundaries} aria-labelledby="boundaries-title">
        <div className={styles.container}>
          <div className={styles.boundaryGrid}>
            <div>
              <p className={styles.kicker}>Honest boundaries</p>
              <h2 id="boundaries-title">What we will not promise.</h2>
              <p>
                Discovery is where we find these limits—not after you have committed to a cutover
                date.
              </p>
            </div>
            <ul>
              {BOUNDARIES.map((boundary) => (
                <li key={boundary}>
                  <Icon.Warning aria-hidden weight="bold" />
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.preparation} aria-labelledby="preparation-title">
        <div className={styles.container}>
          <header className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>For discovery</p>
              <h2 id="preparation-title">Bring a sample, not a cleaned-up story.</h2>
            </div>
            <p>
              A representative sample lets us see the exceptions early and discuss a realistic
              scope.
            </p>
          </header>
          <div className={styles.prepList}>
            <div>
              <Icon.Files aria-hidden weight="bold" />
              <span>
                <strong>Original sample</strong>A real export, spreadsheet or clear pages from the
                books.
              </span>
            </div>
            <div>
              <Icon.ClipboardList aria-hidden weight="bold" />
              <span>
                <strong>Required records</strong>What must exist in Omnix on the first trading day.
              </span>
            </div>
            <div>
              <Icon.UserCircle aria-hidden weight="bold" />
              <span>
                <strong>Validator</strong>The owner or accountant who can approve figures and
                resolve unclear entries.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.container}>
          <div className={styles.closingPanel}>
            <div>
              <p className={styles.kicker}>Start with the source</p>
              <h2>Show us how your records look today.</h2>
            </div>
            <div className={styles.closingActions}>
              <Link className={styles.primaryAction} href={demoHref}>
                Book a migration demo <Icon.ArrowRight aria-hidden weight="bold" />
              </Link>
              {whatsapp ? (
                <a
                  className={styles.textAction}
                  href={whatsapp}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Ask on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
