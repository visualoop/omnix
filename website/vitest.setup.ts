// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// jsdom ships no media pipeline and no window.matchMedia. Provide inert
// defaults so components that read prefers-reduced-motion or drive <video>
// playback (e.g. DecorativeVideo) render without "Not implemented" noise.
// Individual tests may override window.matchMedia to exercise the
// reduced-motion branches, and may spy on play/pause.
if (typeof window !== 'undefined') {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    })
  }
  // No-op media controls (jsdom otherwise reports "Not implemented").
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve()
  }
  HTMLMediaElement.prototype.pause = function pause() {}

  // jsdom ships no ResizeObserver. Radix primitives (e.g. the Checkbox's
  // hidden bubble input via useSize) construct one on render and throw
  // "ResizeObserver is not defined" without it. Provide an inert no-op that
  // satisfies the API surface (observe/unobserve/disconnect) — it only fills
  // the missing browser API and never changes component logic, since jsdom
  // reports zero-size layout regardless.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverStub,
    })
  }
}
