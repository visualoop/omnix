import { DownloadSimple, Package, Terminal } from '@phosphor-icons/react/dist/ssr'

interface ReleaseLike {
  id: string
  version: string
  channel: string
  publishedAt: Date
  notes: string | null
  exeUrl: string | null
  msiUrl: string | null
  signature?: string | null
  androidPlatform: string | null
  androidApkUrl: string | null
  androidAabUrl: string | null
  androidApkSize: number | null
  sha256Apk: string | null
  androidSigningCertificateSha256: string | null
}

function formatBytes(bytes: number | null): string {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : 'size unavailable'
}

/**
 * ReleaseEntry — a single release in the timeline. Drawn as a rectangle
 * with a `>` terminal prompt on the left, version + channel chip in
 * mono, asset links on the right (each one a download chip).
 *
 * The latest release gets a "Current" badge in copper.
 */
export function ReleaseEntry({ r, isLatest = false }: { r: ReleaseLike; isLatest?: boolean }) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
      <Terminal weight="regular" className="size-4 text-[var(--color-fg-subtle)]" />

      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <code className="font-mono text-[14px] tabular-nums text-[var(--color-fg)]">
            v{r.version}
          </code>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{
              color: r.channel === 'stable' ? 'var(--color-positive)' : r.channel === 'beta' ? 'var(--color-caution)' : 'var(--color-fg-subtle)',
            }}
          >
            {r.channel}
          </span>
          {isLatest && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.22em] rounded-sm border px-1.5 py-0.5"
              style={{
                color: 'var(--color-accent)',
                borderColor: 'var(--color-accent-line)',
                background: 'var(--color-accent-soft)',
              }}
            >
              Current
            </span>
          )}
        </div>
        {r.notes && (
          <div className="text-[12px] text-[var(--color-fg-muted)] truncate max-w-[60ch]">
            {r.notes.split('\n')[0]}
          </div>
        )}
        {r.androidPlatform === 'android' && r.androidApkUrl ? (
          <details className="text-[10px] text-[var(--color-fg-subtle)]">
            <summary className="w-fit cursor-pointer font-mono uppercase tracking-[0.14em] hover:text-[var(--color-accent)]">
              Android · {formatBytes(r.androidApkSize)} · verification
            </summary>
            <dl className="mt-2 grid max-w-[72ch] gap-1 font-mono">
              <div>
                <dt className="inline text-[var(--color-fg-muted)]">APK SHA-256: </dt>
                <dd className="inline break-all">{r.sha256Apk ?? 'unavailable'}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--color-fg-muted)]">Signing certificate: </dt>
                <dd className="inline break-all">
                  {r.androidSigningCertificateSha256 ?? 'unavailable'}
                </dd>
              </div>
            </dl>
          </details>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
        {r.exeUrl && (
          <a
            href={r.exeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] text-[var(--color-fg-muted)] transition-colors"
            title="NSIS installer"
          >
            <DownloadSimple weight="regular" className="size-3" />
            .exe
          </a>
        )}
        {r.msiUrl && (
          <a
            href={r.msiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] text-[var(--color-fg-muted)] transition-colors"
            title="MSI installer"
          >
            <Package weight="regular" className="size-3" />
            .msi
          </a>
        )}
        {r.androidApkUrl && (
          <a
            href={r.androidApkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] text-[var(--color-fg-muted)] transition-colors"
            title="Signed universal Android installer"
          >
            <DownloadSimple weight="regular" className="size-3" />
            .apk
          </a>
        )}
        {r.androidAabUrl && (
          <a
            href={r.androidAabUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 hover:border-[var(--color-accent-line)] hover:text-[var(--color-accent)] text-[var(--color-fg-muted)] transition-colors"
            title="Signed Android App Bundle"
          >
            <Package weight="regular" className="size-3" />
            .aab
          </a>
        )}
        <time className="text-[var(--color-fg-subtle)] tabular-nums ml-2">
          {r.publishedAt.toISOString().slice(0, 10)}
        </time>
      </div>
    </div>
  )
}
