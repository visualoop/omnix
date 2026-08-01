import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { AndroidRelease } from '@/lib/android-release'

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AndroidDownloadSection({ release }: { release: AndroidRelease | undefined }) {
  return (
    <section aria-labelledby="android-download-title" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] pb-2">
        <h2
          id="android-download-title"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]"
        >
          Android app
        </h2>
        <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">Signed APK</span>
      </header>

      {release?.apkUrl && release.sha256 ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14px] font-medium text-[var(--color-fg)]">Omnix for Android</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                Current signed release · v{release.version} ·{' '}
                {release.apkSize ? formatMegabytes(release.apkSize) : 'Size unavailable'}
              </div>
            </div>
            <Button asChild size="xs" variant="outline">
              <a href={release.apkUrl} rel="noopener noreferrer" download>
                Download Android APK
              </a>
            </Button>
          </div>

          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)]">
              SHA-256
            </div>
            <code className="mt-1 block break-all font-mono text-[11px] leading-5 text-[var(--color-fg-muted)]">
              {release.sha256}
            </code>
          </div>

          <div className="border-t border-[var(--color-border)] pt-3 text-[12px] leading-5 text-[var(--color-fg-muted)]">
            <h3 className="font-medium text-[var(--color-fg)]">Install on your phone or tablet</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Download this signed APK only from the Omnix website.</li>
              <li>Allow your browser to install it when Android asks, then open the downloaded APK.</li>
              <li>Open Omnix and enrol the device from the Windows desktop hub.</li>
            </ol>
            <p className="mt-3 text-[11px] text-[var(--color-fg-subtle)]">
              Google Play distribution is not live, and iOS is not available.{' '}
              <Link
                href="/ke/docs/android-app"
                className="text-[var(--color-fg-muted)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
              >
                Read the Android installation guide →
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
          <p className="text-[13px] font-medium text-[var(--color-fg)]">No signed Android release is available yet</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">
            Return here for the official Omnix website download when the signed APK is published. Google Play
            distribution is not live, and iOS is not available.
          </p>
          <Link
            href="/ke/docs/android-app"
            className="mt-3 inline-block text-[11px] text-[var(--color-fg-muted)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
          >
            Read the Android installation guide →
          </Link>
        </div>
      )}
    </section>
  )
}
