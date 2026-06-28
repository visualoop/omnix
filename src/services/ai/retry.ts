/**
 * Retry + timeout primitives for the AI router.
 *
 * Two failure modes we hit a lot:
 *
 *   1. **Rate-limit (HTTP 429).** Free-tier providers send a `Retry-After`
 *      header telling us exactly when to try again. Falling straight
 *      through to the next provider wastes a working route. Honouring
 *      `Retry-After` lets us keep using the user's preferred model when
 *      the wait is short.
 *
 *   2. **Stalled stream.** A provider accepts the request, opens the
 *      stream, then never sends a token (typically because the upstream
 *      model is overloaded or the gateway is buffering). The user sees a
 *      spinner forever. A per-stream idle watchdog cuts off after
 *      `STREAM_IDLE_TIMEOUT_MS` of silence so the fallback chain can run.
 */

/** Per-stream idle timeout — abort if no event in this long. */
export const STREAM_IDLE_TIMEOUT_MS = 30_000;

/** How often the idle watchdog wakes up to check. */
export const STREAM_WATCHDOG_INTERVAL_MS = 2_000;

/** Max retries on the SAME route after a 429 before falling through. */
export const MAX_SAME_ROUTE_RETRIES = 2;

/** Hard cap on the wait we honour from `Retry-After` — anything longer
 * and we fall through to the next provider rather than block the UI. */
export const MAX_RETRY_AFTER_MS = 10_000;

/** Header shape we accept — covers both `fetch` Headers and plain records. */
export interface HeaderLike {
  get?: (name: string) => string | null;
}

/**
 * Parse the `Retry-After` header per RFC 7231 §7.1.3 — either a
 * non-negative integer number of seconds, or an HTTP-date.
 *
 * Returns milliseconds, or `null` if the header is absent / unparseable.
 */
export function parseRetryAfter(headers: HeaderLike | Record<string, string | undefined>): number | null {
  let raw: string | null | undefined;
  if (typeof (headers as HeaderLike).get === "function") {
    raw = (headers as HeaderLike).get!("retry-after");
  } else {
    const h = headers as Record<string, string | undefined>;
    raw = h["retry-after"] ?? h["Retry-After"];
  }
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Form 1: bare seconds (most common, all major providers).
  // If the value parses as a finite number, trust that classification
  // and don't fall through to date parsing — Date.parse("-1") happens
  // to return 0 in V8, which would mask a clearly-bad header.
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    if (seconds < 0) return null;
    return Math.floor(seconds * 1000);
  }

  // Form 2: HTTP-date.
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }

  return null;
}

/** Promise-based sleep. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Per-stream idle watchdog. Returns an object exposing:
 *   - `signal`: pass to whatever supports AbortSignal.
 *   - `kick()`: call on every stream event to keep the timer alive.
 *   - `dispose()`: clear the watchdog (always call in finally).
 *   - `timedOut()`: true if the watchdog fired.
 *
 * Idle timer fires when no `kick()` happens for `idleMs`. On fire, the
 * AbortController is aborted; downstream `for await` loops will throw.
 */
export interface IdleWatchdog {
  signal: AbortSignal;
  kick: () => void;
  dispose: () => void;
  timedOut: () => boolean;
}

export function createIdleWatchdog(
  idleMs: number = STREAM_IDLE_TIMEOUT_MS,
  pollMs: number = STREAM_WATCHDOG_INTERVAL_MS,
): IdleWatchdog {
  const controller = new AbortController();
  let lastEventAt = Date.now();
  let fired = false;

  const interval: ReturnType<typeof setInterval> = setInterval(() => {
    if (fired) return;
    if (Date.now() - lastEventAt > idleMs) {
      fired = true;
      controller.abort();
      clearInterval(interval);
    }
  }, pollMs);

  return {
    signal: controller.signal,
    kick: () => {
      lastEventAt = Date.now();
    },
    dispose: () => {
      clearInterval(interval);
    },
    timedOut: () => fired,
  };
}
